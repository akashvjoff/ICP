import type { SupabaseClient } from '@supabase/supabase-js';

export async function sendAnalysisFinishedEmail(client: SupabaseClient, job: {
  id: string; owner_user_id: string; dataset_id: string;
}, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const { data, error } = await client.auth.admin.getUserById(job.owner_user_id);
  if (error) throw error;
  const email = data.user?.email;
  if (!email) return;
  const base = new URL(env.APP_URL || 'https://figuredit.in');
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new Error('APP_URL must use HTTPS.');
  const report = new URL(`/icp/report/${encodeURIComponent(job.dataset_id)}`, base).toString();
  const exportUrl = new URL('/companies', base);
  exportUrl.searchParams.set('dataset', job.dataset_id);
  exportUrl.searchParams.set('export', 'tier1_contacts');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `analysis-finished/${job.id}`,
    },
    body: JSON.stringify({
      from: 'FiguredIt <notifications@figuredit.in>',
      to: [email],
      subject: 'Your FiguredIt analysis is finished',
      html: `<p>Your company analysis is finished.</p><p><a href="${report}">Open your ICP report</a></p><p><a href="${exportUrl.toString().replace(/&/g, '&amp;')}">Export Tier 1 contacts</a></p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
}
