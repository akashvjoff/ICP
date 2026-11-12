import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDodoHostedUrl, createCheckout, processDodoWebhook } from '../billingService';

// Synthetic credentials generated per run; never real values.
const secretBytes = randomBytes(24);
const env = {
  DODO_PAYMENTS_API_KEY: 'test-only-key',
  DODO_ENVIRONMENT: 'test_mode',
  DODO_WEBHOOK_SECRET: `whsec_${secretBytes.toString('base64')}`,
  DODO_PRODUCT_STARTER_MONTHLY: 'pdt_starter_m',
  DODO_PRODUCT_STARTER_YEARLY: 'pdt_starter_y',
  DODO_PRODUCT_PRO_MONTHLY: 'pdt_pro_m',
  DODO_PRODUCT_PRO_YEARLY: 'pdt_pro_y',
} as NodeJS.ProcessEnv;
const userId = randomUUID();

function sign(body: string, id = `evt_${randomUUID()}`, secret = secretBytes) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` };
}

function fakeClient(options: { applied?: boolean; userExists?: boolean } = {}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return { data: options.applied ?? true, error: null }; },
    auth: { admin: { getUserById: async () => ({ data: { user: options.userExists === false ? null : { id: userId } }, error: null }) } },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function event(type: string, data: Record<string, unknown> = {}) {
  return JSON.stringify({
    business_id: 'bus_test', type, timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Subscription', subscription_id: 'sub_123', product_id: 'pdt_pro_y', status: 'active',
      next_billing_date: '2027-11-12T00:00:00Z', cancel_at_next_billing_date: false,
      customer: { customer_id: 'cus_1', email: 'synthetic@example.com' }, metadata: { user_id: userId }, ...data,
    },
  });
}

const lifecycle: Array<[string, string, Record<string, unknown>?]> = [
  ['subscription.active', 'active'],
  ['subscription.renewed', 'active'],
  ['subscription.on_hold', 'on_hold'],
  ['subscription.cancelled', 'cancelled', { status: 'cancelled', cancel_at_next_billing_date: true }],
  ['subscription.failed', 'failed', { status: 'failed' }],
  ['subscription.expired', 'expired', { status: 'expired' }],
];

for (const [type, status, extra] of lifecycle) {
  test(`${type} is verified and applied as ${status}`, async () => {
    const { client, calls } = fakeClient();
    const body = event(type, extra);
    const headers = sign(body);
    assert.equal(await processDodoWebhook(client, body, headers, env), true);
    assert.equal(calls.length, 1);
    const args = calls[0].args;
    assert.equal(calls[0].fn, 'apply_dodo_billing_event');
    assert.equal(args.p_event_id, headers['webhook-id']);
    assert.equal(args.p_status, status);
    assert.equal(args.p_user_id, userId);
    assert.equal(args.p_subscription_id, 'sub_123');
    assert.equal(args.p_customer_id, 'cus_1');
    assert.equal(args.p_plan, 'pro');
    assert.equal(args.p_interval, 'annual');
    assert.equal(args.p_period_end, '2027-11-12T00:00:00Z');
    assert.equal(args.p_cancel_at_period_end, extra?.cancel_at_next_billing_date === true);
  });
}

test('subscription.updated carries the provider status through', async () => {
  const { client, calls } = fakeClient();
  const body = event('subscription.updated', { status: 'on_hold', product_id: 'pdt_starter_m' });
  await processDodoWebhook(client, body, sign(body), env);
  assert.equal(calls[0].args.p_status, 'on_hold');
  assert.equal(calls[0].args.p_plan, 'starter');
  assert.equal(calls[0].args.p_interval, 'monthly');
});

test('a replayed event ID is reported as already processed', async () => {
  const { client } = fakeClient({ applied: false });
  const body = event('subscription.renewed');
  assert.equal(await processDodoWebhook(client, body, sign(body, 'evt_dup'), env), false);
});

test('bad signatures, tampered bodies and missing secrets are rejected before any write', async () => {
  const { client, calls } = fakeClient();
  const body = event('subscription.active');
  await assert.rejects(processDodoWebhook(client, body, sign(body, 'evt_a', randomBytes(24)), env));
  await assert.rejects(processDodoWebhook(client, body.replace('pdt_pro_y', 'pdt_pro_m'), sign(body, 'evt_b'), env));
  await assert.rejects(processDodoWebhook(client, body, sign(body), { ...env, DODO_WEBHOOK_SECRET: '' }));
  assert.equal(calls.length, 0);
});

test('subscription events for unknown products or users are rejected', async () => {
  const { client, calls } = fakeClient();
  const unknownProduct = event('subscription.active', { product_id: 'pdt_other' });
  await assert.rejects(processDodoWebhook(client, unknownProduct, sign(unknownProduct), env));
  const noUser = event('subscription.active', { metadata: {} });
  await assert.rejects(processDodoWebhook(client, noUser, sign(noUser), env));
  assert.equal(calls.length, 0);
});

test('events for deleted users are recorded without granting access', async () => {
  const { client, calls } = fakeClient({ userExists: false });
  const body = event('subscription.renewed');
  await processDodoWebhook(client, body, sign(body), env);
  assert.equal(calls[0].args.p_user_id, null);
  assert.equal(calls[0].args.p_subscription_id, null);
});

test('only https Dodo-hosted links are accepted', () => {
  assert.equal(assertDodoHostedUrl('https://checkout.dodopayments.com/buy/abc'), 'https://checkout.dodopayments.com/buy/abc');
  assert.ok(assertDodoHostedUrl('https://test.checkout.dodopayments.com/session/1'));
  for (const bad of ['http://checkout.dodopayments.com/x', 'https://dodopayments.com.evil.test/x', 'https://evil.test/?dodopayments.com',
    'https://user:pass@checkout.dodopayments.com/x', 'javascript:alert(1)', 'not a url', '']) {
    assert.throws(() => assertDodoHostedUrl(bad), bad);
  }
});

test('checkout sends the selected currency and the mapped product', async (t) => {
  const bodies: Record<string, unknown>[] = [];
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ session_id: 'cks_1', checkout_url: 'https://test.checkout.dodopayments.com/session/cks_1' }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const user = { id: userId, email: 'synthetic@example.com' };
  assert.match(await createCheckout({ plan: 'starter', interval: 'annual', currency: 'USD' }, user, env), /dodopayments\.com/);
  await createCheckout({ plan: 'pro', interval: 'monthly' }, user, env);
  assert.equal(bodies[0].billing_currency, 'USD');
  assert.deepEqual(bodies[0].product_cart, [{ product_id: 'pdt_starter_y', quantity: 1 }]);
  assert.deepEqual(bodies[0].metadata, { user_id: userId });
  assert.equal(bodies[1].billing_currency, 'INR');
  await assert.rejects(createCheckout({ plan: 'pro', interval: 'monthly', currency: 'EUR' }, user, env));
});

test('checkout refuses a non-Dodo link from the provider', async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = (async () => new Response(JSON.stringify({ session_id: 'x', checkout_url: 'https://evil.test/pay' }),
    { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  await assert.rejects(createCheckout({ plan: 'pro', interval: 'monthly' }, { id: userId, email: 'synthetic@example.com' }, env), /unexpected link/);
});
