import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelDodoSubscription } from './billingService';

const OWNED_TABLES = [
  'seller_profiles', 'datasets', 'leads', 'lead_contacts', 'company_analyses',
  'analysis_jobs', 'segments', 'scoring_configs', 'lead_scores', 'icp_reports',
  'dataset_strategic_analyses', 'dataset_stp_analyses', 'ai_daily_usage', 'subscriptions', 'usage',
] as const;

export async function exportAccountData(client: SupabaseClient, userId: string, email?: string) {
  const tables: Record<string, unknown[]> = {};
  for (const table of OWNED_TABLES) {
    const rows: unknown[] = [];
    const sortColumn = table === 'ai_daily_usage' ? 'usage_date' : table === 'usage' ? 'period_start' : 'id';
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(table).select('*')
        .eq(table === 'subscriptions' || table === 'usage' ? 'user_id' : 'owner_user_id', userId).order(sortColumn).range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    tables[table] = rows;
  }
  if (email) {
    const { data, error } = await client.from('waitlist').select('email, plan, created_at')
      .eq('email', email.toLowerCase());
    if (error) throw error;
    tables.waitlist = data || [];
  }
  const { data: auth, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError) throw authError;
  return {
    exported_at: new Date().toISOString(),
    account: auth.user,
    tables,
  };
}

export async function deleteAccountData(client: SupabaseClient, userId: string, email?: string): Promise<void> {
  await cancelDodoSubscription(client, userId, false);
  if (email) {
    const { error } = await client.from('waitlist').delete().eq('email', email.toLowerCase());
    if (error) throw error;
  }
  // Every owned workspace table references auth.users with ON DELETE CASCADE.
  const { error } = await client.auth.admin.deleteUser(userId, false);
  if (error) throw error;
}
