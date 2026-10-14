import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';

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
  const datasetIds: string[] = [];
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
    const datasetId = dataset.id;
    datasetIds.push(datasetId);

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
      const expectedOwnerStatus = route.startsWith('/api/reports/') ? 404 : 200;
      if (own.status !== expectedOwnerStatus) {
        throw new Error(`Owner request failed at ${route}: HTTP ${own.status}`);
      }
      if (cross.status !== 404 || cross.text.includes('Synthetic authorization check')) {
        throw new Error(`Cross-user access was not hidden at ${route}: HTTP ${cross.status}`);
      }
      if (anonymous.status !== 401) {
        throw new Error(`Anonymous access was not rejected at ${route}: HTTP ${anonymous.status}`);
      }
      console.log(`${route}: owner ${own.status}, other user ${cross.status}, anonymous ${anonymous.status}`);
    }

    const csv = Buffer.from('Company Name,Domain,Industry\nAcme Cloud,acme-cloud.example,Software\nBeacon Ops,beacon-ops.example,Services\n');
    const uploaded = await request('/api/uploads', a.token, 'POST', {
      fileName: 'synthetic-acceptance.csv',
      fileSizeBytes: csv.length,
      fileBase64: csv.toString('base64'),
      mapping: { companyName: 'Company Name', domain: 'Domain', industry: 'Industry' },
      skipDuplicates: true,
    });
    if (uploaded.status !== 201) throw new Error(`Synthetic CSV upload failed: HTTP ${uploaded.status} ${uploaded.text}`);
    const uploadResult = JSON.parse(uploaded.text) as { datasetId: string; leadIds: string[] };
    datasetIds.push(uploadResult.datasetId);
    if (uploadResult.leadIds.length !== 2) throw new Error(`Expected two uploaded leads, got ${uploadResult.leadIds.length}`);
    console.log(`Synthetic CSV upload: HTTP 201, ${uploadResult.leadIds.length} leads`);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.addRow(['Company Name', 'Domain', 'Industry']);
    sheet.addRow(['Cedar Systems', 'cedar-systems.example', 'Software']);
    const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    const uploadedXlsx = await request('/api/uploads', a.token, 'POST', {
      fileName: 'synthetic-acceptance.xlsx',
      fileSizeBytes: xlsx.length,
      fileBase64: xlsx.toString('base64'),
      mapping: { companyName: 'Company Name', domain: 'Domain', industry: 'Industry' },
      skipDuplicates: true,
    });
    if (uploadedXlsx.status !== 201) throw new Error(`Synthetic XLSX upload failed: HTTP ${uploadedXlsx.status} ${uploadedXlsx.text}`);
    const xlsxResult = JSON.parse(uploadedXlsx.text) as { datasetId: string; leadIds: string[] };
    datasetIds.push(xlsxResult.datasetId);
    if (xlsxResult.leadIds.length !== 1) throw new Error(`Expected one XLSX lead, got ${xlsxResult.leadIds.length}`);
    console.log('Synthetic XLSX upload: HTTP 201, 1 lead');

    const sellerProfile = {
      id: 'synthetic-seller', companyName: 'Test Seller', productName: 'Workflow Monitor',
      productDescription: 'Software that monitors operational workflows and alerts teams to failures.',
      primaryProblemSolved: 'Manual monitoring of operational workflows',
      keyCapabilities: ['Workflow monitoring', 'Failure alerts'],
    };
    for (const [stage, path] of [
      ['Need Gap and 5C', `/api/strategic-analysis/dataset/${uploadResult.datasetId}/run`],
      ['STP', `/api/stp/dataset/${uploadResult.datasetId}/run`],
      ['scoring', `/api/scoring/dataset/${uploadResult.datasetId}/run`],
      ['report', `/api/reports/dataset/${uploadResult.datasetId}/generate`],
    ]) {
      const response = await request(path, a.token, 'POST', { sellerProfile });
      if (response.status !== 200) throw new Error(`${stage} failed: HTTP ${response.status} ${response.text.slice(0, 300)}`);
      console.log(`${stage}: HTTP 200`);
    }
    const storedReport = await request(`/api/reports/dataset/${uploadResult.datasetId}`, a.token);
    if (storedReport.status !== 200 || !JSON.parse(storedReport.text).report) {
      throw new Error(`Stored report was not available: HTTP ${storedReport.status}`);
    }
    console.log('Stored report after fresh request: HTTP 200');

    const invalidUpload = await request('/api/uploads', a.token, 'POST', {});
    if (invalidUpload.status < 400 || invalidUpload.status >= 500) {
      throw new Error(`Invalid upload expected a client error, got HTTP ${invalidUpload.status}`);
    }
    console.log(`Invalid upload: HTTP ${invalidUpload.status}`);
    const expiredSession = await request(`/api/scoring/dataset/${uploadResult.datasetId}`, 'expired.synthetic.token');
    if (expiredSession.status !== 401) throw new Error(`Expired session expected HTTP 401, got ${expiredSession.status}`);
    console.log('Expired session: HTTP 401');
  } finally {
    const cleanupErrors: string[] = [];
    for (const datasetId of datasetIds) {
      const { error } = await admin.from('datasets').delete().eq('id', datasetId);
      if (error) cleanupErrors.push(`dataset: ${error.message}`);
    }
    for (const userId of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) cleanupErrors.push(`user: ${error.message}`);
    }
    for (const datasetId of datasetIds) {
      const { count, error } = await admin.from('datasets').select('id', { count: 'exact', head: true }).eq('id', datasetId);
      if (error || count !== 0) cleanupErrors.push(`dataset verification: ${error?.message || count}`);
    }
    if (cleanupErrors.length) throw new Error(`Synthetic cleanup failed: ${cleanupErrors.join('; ')}`);
  }
  console.log('Live app acceptance passed; synthetic users and datasets removed.');
}

main().catch((error) => {
  console.error(`Live app authorization acceptance failed: ${error.message}`);
  process.exitCode = 1;
});
