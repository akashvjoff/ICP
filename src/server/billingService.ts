import DodoPayments from 'dodopayments';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PLANS, type BillingInterval, type PaidPlanId } from '../config/plans';

const checkoutSchema = z.object({ plan: z.enum(['starter', 'pro']), interval: z.enum(['monthly', 'annual']) });
const webhookSchema = z.object({
  type: z.string(), timestamp: z.string(), data: z.record(z.string(), z.unknown()),
});
const uuid = z.uuid();
export class PlanLimitError extends Error { constructor(message: string) { super(message); } }

export function dodoClient(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DODO_PAYMENTS_API_KEY) throw new Error('Billing is not configured.');
  if (env.DODO_ENVIRONMENT !== 'test_mode' && env.DODO_ENVIRONMENT !== 'live_mode') throw new Error('DODO_ENVIRONMENT must be test_mode or live_mode.');
  return new DodoPayments({ bearerToken: env.DODO_PAYMENTS_API_KEY, environment: env.DODO_ENVIRONMENT });
}

function productMap(env: NodeJS.ProcessEnv = process.env): Record<PaidPlanId, Record<BillingInterval, string | undefined>> {
  return {
    starter: { monthly: env.DODO_PRODUCT_STARTER_MONTHLY, annual: env.DODO_PRODUCT_STARTER_YEARLY },
    pro: { monthly: env.DODO_PRODUCT_PRO_MONTHLY, annual: env.DODO_PRODUCT_PRO_YEARLY },
  };
}

export async function createCheckout(input: unknown, user: { id: string; email?: string; name?: string }, env = process.env) {
  const { plan, interval } = checkoutSchema.parse(input);
  if (!user.email) throw new Error('Add an email address before checkout.');
  const productId = productMap(env)[plan][interval];
  if (!productId) throw new Error('This plan is not configured for checkout.');
  const session = await dodoClient(env).checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email: user.email, ...(user.name ? { name: user.name } : {}) },
    metadata: { user_id: user.id },
    return_url: 'https://figuredit.in/settings/billing?status=success',
    cancel_url: 'https://figuredit.in/pricing',
  });
  if (!session.checkout_url) throw new Error('Checkout did not return a link.');
  return session.checkout_url;
}

export async function getEntitlements(client: SupabaseClient, userId: string, now = new Date()) {
  const { data, error } = await client.from('subscriptions').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(5);
  if (error) throw error;
  const subscription = (data || []).find(row => {
    const end = row.current_period_end ? Date.parse(row.current_period_end) : 0;
    if (row.status === 'active') return end > now.getTime();
    if (row.status === 'cancelled') return end > now.getTime();
    if (row.status === 'on_hold') return Date.parse(row.status_changed_at) + 3 * 86400_000 > now.getTime();
    return false;
  });
  const planId = subscription?.plan === 'starter' || subscription?.plan === 'pro' ? subscription.plan : 'free';
  return { plan: PLANS.find(plan => plan.id === planId)!, subscription: subscription || null };
}

export async function getBillingUsage(client: SupabaseClient, userId: string, periodStart: string) {
  const [datasets, analyses] = await Promise.all([
    client.from('datasets').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId).gte('created_at', periodStart),
    client.from('company_analyses').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId).eq('analysis_status', 'completed').gte('analyzed_at', periodStart),
  ]);
  if (datasets.error) throw datasets.error;
  if (analyses.error) throw analyses.error;
  return { datasets_count: datasets.count || 0, ai_companies_used: analyses.count || 0 };
}

export async function canAnalyzeCompany(client: SupabaseClient, userId: string, datasetId: string) {
  const { plan } = await getEntitlements(client, userId);
  const { count, error } = await client.from('leads').select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId).eq('dataset_id', datasetId).eq('analysis_status', 'completed');
  if (error) throw error;
  return (count || 0) < plan.companiesPerDataset;
}

export function billingPeriodStart(interval: BillingInterval | null, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (interval === 'annual') start.setUTCMonth(0);
  return start.toISOString();
}

export async function processDodoWebhook(client: SupabaseClient, rawBody: string, headers: Record<string, string>, env = process.env) {
  if (!env.DODO_WEBHOOK_SECRET) throw new Error('Webhook secret is missing.');
  const id = headers['webhook-id'];
  if (!id) throw new Error('Webhook ID is missing.');
  const verified = dodoClient(env).webhooks.unwrap(rawBody, { headers, key: env.DODO_WEBHOOK_SECRET });
  const event = webhookSchema.parse(verified);
  const data = event.data;
  const isSubscription = event.type.startsWith('subscription.');
  const subscriptionId = typeof data.subscription_id === 'string' ? data.subscription_id : null;
  const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {};
  const userId = uuid.safeParse(metadata.user_id).success ? metadata.user_id as string : null;
  const matched = Object.entries(productMap(env)).flatMap(([plan, intervals]) =>
    Object.entries(intervals).map(([interval, product]) => ({ plan, interval, product }))
  ).find(item => item.product && item.product === data.product_id);
  if (isSubscription && (!subscriptionId || !userId || !matched)) throw new Error('Subscription webhook lacks a known product, user, or subscription ID.');
  let deletedUser = false;
  if (isSubscription && userId) {
    const lookup = await client.auth.admin.getUserById(userId);
    if (lookup.error && lookup.error.status !== 404) throw lookup.error;
    deletedUser = !lookup.data.user;
  }
  const customer = data.customer && typeof data.customer === 'object' ? data.customer as Record<string, unknown> : {};
  const statuses: Record<string, string> = {
    'subscription.active': 'active', 'subscription.renewed': 'active', 'subscription.on_hold': 'on_hold',
    'subscription.past_due': 'on_hold', 'subscription.cancelled': 'cancelled', 'subscription.failed': 'failed',
    'subscription.expired': 'expired',
  };
  const status = statuses[event.type] || (event.type === 'subscription.updated' && typeof data.status === 'string' ? data.status : null);
  const { data: applied, error } = await client.rpc('apply_dodo_billing_event', {
    p_event_id: id, p_type: event.type, p_payload: event,
    p_user_id: isSubscription && !deletedUser ? userId : null,
    p_subscription_id: isSubscription && !deletedUser ? subscriptionId : null,
    p_customer_id: typeof customer.customer_id === 'string' ? customer.customer_id : null,
    p_plan: isSubscription ? matched!.plan : null,
    p_interval: isSubscription ? matched!.interval : null,
    p_status: status,
    p_period_end: typeof data.next_billing_date === 'string' ? data.next_billing_date : null,
    p_cancel_at_period_end: data.cancel_at_next_billing_date === true,
    p_event_at: event.timestamp,
  });
  if (error) throw error;
  return applied === true;
}

export async function cancelDodoSubscription(client: SupabaseClient, userId: string, atPeriodEnd = true, env = process.env) {
  const { data, error } = await client.from('subscriptions').select('provider_subscription_id,status')
    .eq('user_id', userId).in('status', ['active', 'on_hold']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (data?.provider_subscription_id) await dodoClient(env).subscriptions.update(data.provider_subscription_id, {
    status: 'cancelled', cancel_at_next_billing_date: atPeriodEnd, cancel_reason: 'cancelled_by_customer',
  });
}

export async function createPortalLink(client: SupabaseClient, userId: string, env = process.env) {
  const { data, error } = await client.from('subscriptions').select('provider_customer_id').eq('user_id', userId)
    .not('provider_customer_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.provider_customer_id) throw new Error('No billing customer is linked to this account.');
  const portal = await dodoClient(env).customers.customerPortal.create(data.provider_customer_id, {
    return_url: 'https://figuredit.in/settings/billing',
  });
  return portal.link;
}
