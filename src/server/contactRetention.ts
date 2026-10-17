import type { SupabaseClient } from '@supabase/supabase-js';

export function contactRetentionCutoff(env: NodeJS.ProcessEnv, now = Date.now()): string {
  const configured = Number(env.DATA_RETENTION_DAYS);
  // The existing pg_cron policy clears raw rows at day 90; this setting may shorten it.
  const days = Number.isInteger(configured) && configured > 0 && configured <= 90 ? configured : 90;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function clearExpiredContacts(client: SupabaseClient, env: NodeJS.ProcessEnv): Promise<void> {
  const cutoff = contactRetentionCutoff(env);
  const { error } = await client.from('lead_contacts').delete()
    .lt('created_at', cutoff);
  if (error) throw error;
  const { error: rawError } = await client.from('leads').update({ raw_row: {} })
    .lt('created_at', cutoff).neq('raw_row', '{}');
  if (rawError) throw rawError;
}
