import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const projectRef = process.env.ICP_LIVE_TEST_PROJECT_REF;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.ICP_ACCEPTANCE_APP_URL || 'https://icp-mode.onrender.com';

if (!projectRef || !supabaseUrl || !anonKey || !serviceRoleKey ||
    new URL(supabaseUrl).hostname !== `${projectRef}.supabase.co`) {
  throw new Error('Set ICP_LIVE_TEST_PROJECT_REF and the matching Supabase test project credentials.');
}
if (!['https://icp-mode.onrender.com', 'http://127.0.0.1:3000'].includes(appUrl)) {
  throw new Error('ICP_ACCEPTANCE_APP_URL must be the deployed app or the local test server.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const userAClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const userBClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const createdUserIds: string[] = [];

async function makeUser(label: string, client: typeof userAClient) {
  const nonce = randomBytes(8).toString('hex');
  const email = `icp-acceptance-${label}-${nonce}@example.com`;
  const password = `Synthetic!${randomBytes(18).toString('base64url')}`;
  const { data: created, error: creationError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (creationError || !created.user) throw creationError || new Error('Synthetic user creation failed.');
  createdUserIds.push(created.user.id);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error('Synthetic sign-in failed.');
  return { id: created.user.id, token: data.session.access_token };
}

async function request(path: string, token?: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${appUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function main() {
  let datasetId: string | undefined;
  try {
    const a = await makeUser('a', userAClient);
    const b = await makeUser('b', userBClient);
    const { data: dataset, error } = await userAClient.from('datasets').insert({
      owner_user_id: a.id,
      name: 'Synthetic authorization check',
      original_filename: 'synthetic.csv',
      row_count: 0,
      status: 'uploaded',
    }).select('id').single();
    if (error || !dataset) throw error || new Error('Synthetic dataset creation failed.');
    datasetId = dataset.id;

    const routes = [
      `/api/strategic-analysis/dataset/${datasetId}`,
      `/api/stp/dataset/${datasetId}`,
      `/api/scoring/dataset/${datasetId}`,
      `/api/reports/dataset/${datasetId}`,
      `/api/analysis-jobs/by-dataset/${datasetId}`,
    ];
    for (const route of routes) {
      const own = await request(route, a.token);
      const cross = await request(route, b.token);
      const anonymous = await request(route);
      if (cross.status !== 404 || cross.text.includes('Synthetic authorization check')) {
        throw new Error(`Cross-user access was not hidden at ${route}: HTTP ${cross.status}`);
      }
      if (anonymous.status !== 401) {
        throw new Error(`Anonymous access was not rejected at ${route}: HTTP ${anonymous.status}`);
      }
      console.log(`${route}: owner ${own.status}, other user ${cross.status}, anonymous ${anonymous.status}`);
    }

    const invalidUpload = await request('/api/uploads', a.token, 'POST', {});
    if (invalidUpload.status < 400 || invalidUpload.status >= 500) {
      throw new Error(`Invalid upload expected a client error, got HTTP ${invalidUpload.status}`);
    }
    console.log(`Invalid upload: HTTP ${invalidUpload.status}`);
  } finally {
    const cleanupErrors: string[] = [];
    if (datasetId) {
      const { error } = await admin.from('datasets').delete().eq('id', datasetId);
      if (error) cleanupErrors.push(`dataset: ${error.message}`);
    }
    for (const userId of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) cleanupErrors.push(`user: ${error.message}`);
    }
    if (cleanupErrors.length) throw new Error(`Synthetic cleanup failed: ${cleanupErrors.join('; ')}`);
  }
  console.log('Live app authorization acceptance passed; synthetic users and dataset removed.');
}

main().catch((error) => {
  console.error(`Live app authorization acceptance failed: ${error.message}`);
  process.exitCode = 1;
});
