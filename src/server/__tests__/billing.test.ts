import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEntitlements } from '../billingService';

function clientWith(rows: Record<string, unknown>[]) {
  return { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }) }) } as unknown as SupabaseClient;
}

const now = new Date('2026-10-15T00:00:00Z');
const future = '2026-11-15T00:00:00Z';
test('only webhook-backed active and unexpired cancelled subscriptions grant paid access', async () => {
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'active', current_period_end: future }]), 'u', now)).plan.id, 'pro');
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'cancelled', current_period_end: future }]), 'u', now)).plan.id, 'starter');
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'expired', current_period_end: future }]), 'u', now)).plan.id, 'free');
  assert.equal((await getEntitlements(clientWith([{ plan: 'pro', status: 'cancelled', current_period_end: '2026-10-14T00:00:00Z' }]), 'u', now)).plan.id, 'free');
});

test('on hold has a three-day grace period', async () => {
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'on_hold', status_changed_at: '2026-10-13T00:00:00Z' }]), 'u', now)).plan.id, 'starter');
  assert.equal((await getEntitlements(clientWith([{ plan: 'starter', status: 'on_hold', status_changed_at: '2026-10-11T00:00:00Z' }]), 'u', now)).plan.id, 'free');
});
