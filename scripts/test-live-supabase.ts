import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { randomBytes } from 'node:crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedProjectRef = process.env.ICP_LIVE_TEST_PROJECT_REF;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

if (!serviceRoleKey || !expectedProjectRef || new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY and ICP_LIVE_TEST_PROJECT_REF for the intended test project.');
  process.exit(1);
}

const adminClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const clientA = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
const clientB = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function getOrCreateTestUser(client: any, email: string, pass: string, onCreated: (id: string) => void) {
  if (adminClient) {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
    });
    if (createError) {
      throw new Error(`Admin create user failed: ${createError.message}`);
    }
    if (created.user?.id) onCreated(created.user.id);
  }

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (signInError) {
    throw new Error(`Failed to sign in test user ${email}: ${signInError.message}`);
  }

  return signInData;
}

async function runLiveAcceptanceTest() {
  console.log('================================================================');
  console.log('FIGUREDIT: RUNNING LIVE SUPABASE ACCEPTANCE & ISOLATION TEST');
  console.log(`Target Project Ref: ${expectedProjectRef}`);
  console.log('================================================================');

  // 1. Create/Authenticate User A & User B
  const testPass = `LiveTest-${randomBytes(24).toString('base64url')}!`;
  const userAEmail = `synthetic_user_a_${Date.now()}@synthetic-test.org`;
  const userBEmail = `synthetic_user_b_${Date.now()}@synthetic-test.org`;
  let userIdA: string | undefined;
  let userIdB: string | undefined;
  let datasetId: string | undefined;

  try {

  console.log(`[AUTH] Authenticating User A (${userAEmail})...`);
  const authA = await getOrCreateTestUser(clientA, userAEmail, testPass, id => { userIdA = id; });
  userIdA = authA.user.id;
  console.log(`[PASS] User A authenticated. UID: ${userIdA}`);

  console.log(`[AUTH] Authenticating User B (${userBEmail})...`);
  const authB = await getOrCreateTestUser(clientB, userBEmail, testPass, id => { userIdB = id; });
  userIdB = authB.user.id;
  console.log(`[PASS] User B authenticated. UID: ${userIdB}`);

  // 2. User A creates a seller profile
  console.log('[RLS] User A upserting seller profile...');
  const { error: profileError } = await clientA
    .from('seller_profiles')
    .upsert({
      owner_user_id: userIdA,
      company_name: 'Synthetic Observability Inc',
      website: 'https://synthetic-observability.test',
      product_description: 'Automated data pipeline quality testing and SLA verification.',
      target_market: 'B2B Enterprise SaaS',
      offering_type: 'Subscription',
      price_range: '$36,000 / year',
      primary_buyer: 'VP of Data & Analytics',
      main_customer_problem: 'Corrupted executive reporting caused by undocumented schema breaks.',
    });

  if (profileError) throw new Error(`User A seller profile creation failed: ${profileError.message}`);
  console.log('[PASS] User A seller profile persisted successfully.');

  // 3. User A creates a dataset
  console.log('[RLS] User A creating target prospect dataset...');
  const { data: datasetA, error: datasetError } = await clientA
    .from('datasets')
    .insert({
      owner_user_id: userIdA,
      name: 'Q4 Pipeline Accounts',
      original_filename: 'q4_accounts.csv',
      row_count: 2,
      status: 'uploaded',
    })
    .select()
    .single();

  if (datasetError || !datasetA) throw new Error(`Dataset creation failed: ${datasetError?.message}`);
  datasetId = datasetA.id;
  console.log(`[PASS] User A dataset created. Dataset ID: ${datasetId}`);

  // 4. User A inserts leads into dataset
  console.log('[RLS] User A inserting prospect leads...');
  const { data: leads, error: leadsError } = await clientA
    .from('leads')
    .insert([
      {
        dataset_id: datasetId,
        owner_user_id: userIdA,
        company_name: 'Acme Data Systems',
        normalized_domain: 'acmedata.test',
        website: 'https://acmedata.test',
        industry_raw: 'Enterprise Software',
        employee_count: 350,
        notes: 'Frequent dbt pipeline breaks on Snowflake.',
        analysis_eligible: true,
        analysis_status: 'pending',
      },
      {
        dataset_id: datasetId,
        owner_user_id: userIdA,
        company_name: 'Peak Analytics Cloud',
        normalized_domain: 'peakanalytics.test',
        website: 'https://peakanalytics.test',
        industry_raw: 'Fintech',
        employee_count: 500,
        notes: 'High regulatory reporting compliance pressure.',
        analysis_eligible: true,
        analysis_status: 'pending',
      },
    ])
    .select();

  if (leadsError || !leads?.length) throw new Error(`Lead insertion failed: ${leadsError?.message}`);
  console.log(`[PASS] User A inserted ${leads.length} leads successfully.`);

  // 5. TEST CROSS-TENANT ISOLATION: User B queries User A's dataset
  console.log('[ISOLATION TEST] User B attempting to select User A dataset...');
  const { data: userBViewDataset, error: bReadError } = await clientB
    .from('datasets')
    .select('*')
    .eq('id', datasetId);

  if (bReadError) throw new Error(`Unexpected error on User B read: ${bReadError.message}`);
  if (userBViewDataset && userBViewDataset.length > 0) {
    throw new Error('SECURITY VIOLATION: User B was able to see User A dataset!');
  }
  console.log('[PASS] RLS verified: User B cannot see User A dataset (returned 0 rows).');

  // 6. TEST CROSS-TENANT ISOLATION: User B queries User A's leads
  console.log('[ISOLATION TEST] User B attempting to select User A leads...');
  const { data: userBViewLeads, error: bLeadsReadError } = await clientB
    .from('leads')
    .select('*')
    .eq('dataset_id', datasetId);

  if (bLeadsReadError) throw new Error(`Unexpected error on User B leads read: ${bLeadsReadError.message}`);
  if (userBViewLeads && userBViewLeads.length > 0) {
    throw new Error('SECURITY VIOLATION: User B was able to see User A leads!');
  }
  console.log('[PASS] RLS verified: User B cannot see User A leads (returned 0 rows).');

  // 7. TEST CROSS-TENANT SPOOFING: User B attempts to insert lead under User A's ID
  console.log('[ISOLATION TEST] User B attempting to insert lead with owner_user_id = User A...');
  const { error: spoofError } = await clientB
    .from('leads')
    .insert({
      dataset_id: datasetId,
      owner_user_id: userIdA,
      company_name: 'Malicious Injected Co',
    });

  if (!spoofError) {
    throw new Error('SECURITY VIOLATION: User B was allowed to insert lead with User A ownership!');
  }
  console.log(`[PASS] RLS policy blocked unauthorized insert with error: "${spoofError.message}"`);

  // 8. TEST RPC: User A claims batch via claim_next_analysis_batch
  console.log('[RPC TEST] User A claiming next batch using claim_next_analysis_batch RPC...');
  const { data: claimedBatch, error: rpcError } = await clientA
    .rpc('claim_next_analysis_batch', {
      p_dataset_id: datasetId,
      p_batch_size: 1,
    });

  if (rpcError) throw new Error(`RPC claim_next_analysis_batch failed: ${rpcError.message}`);
  if (!claimedBatch || claimedBatch.length !== 1) {
    throw new Error(`Expected 1 claimed lead, got ${claimedBatch?.length}`);
  }
  console.log(`[PASS] RPC successfully claimed 1 lead: ${claimedBatch[0].company_name} (Status: ${claimedBatch[0].analysis_status})`);

  // 9. TEST RPC ISOLATION: User B calls claim_next_analysis_batch on User A's dataset
  console.log('[RPC ISOLATION TEST] User B attempting to claim batch from User A dataset...');
  const { data: bClaimedBatch, error: bRpcError } = await clientB
    .rpc('claim_next_analysis_batch', {
      p_dataset_id: datasetId,
      p_batch_size: 1,
    });

  if (bRpcError) throw new Error(`Unexpected error on User B RPC: ${bRpcError.message}`);
  if (bClaimedBatch && bClaimedBatch.length > 0) {
    throw new Error('SECURITY VIOLATION: User B claimed leads from User A dataset!');
  }
  console.log('[PASS] RPC isolation verified: User B cannot claim User A leads (returned 0 rows).');

  } finally {
    console.log('[CLEANUP] Removing synthetic test records and users...');
    const cleanupErrors: string[] = [];
    if (datasetId && userIdA) {
      const { error } = await clientA.from('datasets').delete().eq('id', datasetId).eq('owner_user_id', userIdA);
      if (error) cleanupErrors.push(`Dataset deletion failed: ${error.message}`);
    }
    if (userIdA) {
      const { error } = await clientA.from('seller_profiles').delete().eq('owner_user_id', userIdA);
      if (error) cleanupErrors.push(`Seller profile deletion failed: ${error.message}`);
    }
    if (adminClient && userIdA) {
      const { error } = await adminClient.auth.admin.deleteUser(userIdA);
      if (error) cleanupErrors.push(`User A deletion failed: ${error.message}`);
    }
    if (adminClient && userIdB) {
      const { error } = await adminClient.auth.admin.deleteUser(userIdB);
      if (error) cleanupErrors.push(`User B deletion failed: ${error.message}`);
    }
    if (cleanupErrors.length) throw new Error(`Live test cleanup incomplete: ${cleanupErrors.join('; ')}`);
  }
  console.log('================================================================');
  console.log('ALL LIVE SUPABASE ACCEPTANCE & SECURITY TESTS PASSED!');
  console.log('================================================================');
}

runLiveAcceptanceTest().catch((err) => {
  console.error('\nLIVE TEST FAILED:', err.message);
  process.exit(1);
});
