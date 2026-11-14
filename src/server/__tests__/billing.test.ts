import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canAnalyzeCompany, getEntitlements } from '../billingService';
import { canExport } from '../exportService';

function clientWith(rows: Record<string, unknown>[], override: { unlimited: boolean } | null = null, completedLeads = 0) {
  return { from: (table: string) => {
    if (table === 'account_overrides') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: override, error: null }) }) }) };
    if (table === 'leads') return { select: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ count: completedLeads, error: null }) }) }) }) };
    return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }) };
  } } as unknown as SupabaseClient;
}

const now = new Date('2026-10-15T00:00:00Z');
const future = '2026-11-15T00:00:00Z';
test('only webhook-backed active and unexpired cancelled subscriptions grant paid access', async () => {
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'active', current_period_end: future }]), 'u', now)).plan.id, 'pro');
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'cancelled', current_period_end: future }]), 'u', now)).plan.id, 'starter');
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'expired', current_period_end: future }]), 'u', now)).plan.id, 'free');
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'cancelled', current_period_end: '2026-10-14T00:00:00Z' }]), 'u', now)).plan.id, 'free');
});

test('account overrides grant every Pro feature with no dataset or AI-company cap', async () => {
  const { plan, unlimited, subscription } = await getEntitlements(clientWith([], { unlimited: true }), 'u', now);
  assert.equal(unlimited, true);
  assert.equal(subscription, null);
  assert.equal(plan.id, 'pro');
  assert.equal(plan.datasetsPerMonth, null);
  assert.equal(plan.companiesPerDataset, Number.POSITIVE_INFINITY);
  assert.equal(JSON.parse(JSON.stringify({ c: plan.companiesPerDataset })).c, null);
  assert.equal(await canAnalyzeCompany(clientWith([], { unlimited: true }, 100_000), 'u', 'd'), true);
  assert.equal(canExport({ id: 'u' }, 'contacts', 500, plan, { mode: 'contacts', format: 'xlsx' } as never), true);
});

test('a missing or disabled override leaves normal plan limits in place', async () => {
  for (const override of [null, { unlimited: false }]) {
    const result = await getEntitlements(clientWith([], override), 'u', now);
    assert.equal(result.plan.id, 'free');
    assert.equal(result.unlimited, false);
  }
  assert.equal(await canAnalyzeCompany(clientWith([], null, 25), 'u', 'd'), false);
});

test('on hold has a three-day grace period', async () => {
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'on_hold', status_changed_at: '2026-10-13T00:00:00Z' }]), 'u', now)).plan.id, 'starter');
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'on_hold', status_changed_at: '2026-10-11T00:00:00Z' }]), 'u', now)).plan.id, 'free');
});
