import test from 'node:test';
import assert from 'node:assert/strict';
import { getBearerToken, persistPreparedUpload, prepareUpload, type UploadRepository } from '../upload';

function uploadBody(csv: string) {
  const bytes = Buffer.from(csv, 'utf8');
  return {
    fileName: 'authorization-synthetic.csv',
    fileSizeBytes: bytes.byteLength,
    fileBase64: bytes.toString('base64'),
    mapping: { companyName: 'Company', domain: 'Domain', headcount: 'Employees' },
    skipDuplicates: true,
  };
}

test('requires a well-formed bearer token at the upload trust boundary', () => {
  assert.equal(getBearerToken(undefined), null);
  assert.equal(getBearerToken('Basic abc'), null);
  assert.equal(getBearerToken('Bearer   '), null);
  assert.equal(getBearerToken('Bearer verified-session-token'), 'verified-session-token');
});

test('re-parses the original bytes and persists rows under the server-verified owner', async () => {
  const prepared = await prepareUpload(uploadBody('Company,Domain,Employees\nSynthetic Secure Co,secure.test,0'));
  const calls: Array<{ operation: string; owner: string; values?: unknown }> = [];
  const repository: UploadRepository = {
    async createDataset(owner, values) {
      calls.push({ operation: 'dataset', owner, values });
      return { id: 'dataset-test' };
    },
    async insertLeads(owner, datasetId, values) {
      calls.push({ operation: `leads:${datasetId}`, owner, values });
      return values.map((_, index) => ({ id: `lead-${index}` }));
    },
    async insertContacts(owner, datasetId, values) {
      calls.push({ operation: `contacts:${datasetId}`, owner, values });
    },
    async createQueuedJob(owner, datasetId, totalCount) {
      calls.push({ operation: `job:${datasetId}`, owner, values: { totalCount } });
      return { id: 'job-test', status: 'queued' };
    },
    async deleteDataset() {
      assert.fail('rollback should not run for a successful upload');
    },
  };

  const result = await persistPreparedUpload(repository, 'verified-user-id', prepared);
  assert.equal(result.datasetId, 'dataset-test');
  assert.ok(calls.every((call) => call.owner === 'verified-user-id'));
  assert.equal((calls[0].values as Record<string, unknown>).status, 'processing');
  assert.deepEqual(calls[3].values, { totalCount: 1 });
});

test('rolls back the dataset if lead persistence fails', async () => {
  const prepared = await prepareUpload(uploadBody('Company,Domain,Employees\nSynthetic Rollback Co,rollback.test,10'));
  let deleted: { owner: string; dataset: string } | undefined;
  const repository: UploadRepository = {
    async createDataset() { return { id: 'dataset-rollback' }; },
    async insertLeads() { throw new Error('synthetic database failure'); },
    async insertContacts() { assert.fail('contacts should not be inserted after a lead failure'); },
    async createQueuedJob() { return { id: 'unused', status: 'queued' }; },
    async deleteDataset(owner, dataset) { deleted = { owner, dataset }; },
  };
  await assert.rejects(() => persistPreparedUpload(repository, 'verified-user-id', prepared), /synthetic database failure/);
  assert.deepEqual(deleted, { owner: 'verified-user-id', dataset: 'dataset-rollback' });
});

test('persists every contact under the merged company ID', async () => {
  const csv = 'Company,Domain,Employees,First Name,Last Name,Email,Job Title,Seniority,Lead Stage\nAcme,acme.test,201-500,Ana,Lee,ana@acme.test,VP,VP,Contacted\nAcme,https://www.acme.test,201-500,Ben,Ray,ben@acme.test,Director,Director,Replied';
  const body = uploadBody(csv);
  const contactBody = { ...body, mapping: { ...body.mapping, firstName: 'First Name', lastName: 'Last Name', email: 'Email', jobTitle: 'Job Title', seniority: 'Seniority', leadStage: 'Lead Stage' } };
  const prepared = await prepareUpload(contactBody);
  assert.equal(prepared.pipeline.validLeads.length, 1);
  let contacts: Array<Record<string, unknown>> = [];
  const repository: UploadRepository = {
    async createDataset() { return { id: 'dataset-test' }; },
    async insertLeads() { return [{ id: 'merged-lead' }]; },
    async insertContacts(_owner, _dataset, values) { contacts = values; },
    async createQueuedJob() { return { id: 'job-test', status: 'queued' }; },
    async deleteDataset() { assert.fail('rollback should not run'); },
  };
  await persistPreparedUpload(repository, 'owner-test', prepared);
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every(contact => contact.lead_id === 'merged-lead'));
  assert.equal(contacts[1].lead_stage, 'Replied');
});
