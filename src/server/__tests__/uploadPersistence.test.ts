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
  assert.deepEqual(calls[2].values, { totalCount: 1 });
});

test('rolls back the dataset if lead persistence fails', async () => {
  const prepared = await prepareUpload(uploadBody('Company,Domain,Employees\nSynthetic Rollback Co,rollback.test,10'));
  let deleted: { owner: string; dataset: string } | undefined;
  const repository: UploadRepository = {
    async createDataset() { return { id: 'dataset-rollback' }; },
    async insertLeads() { throw new Error('synthetic database failure'); },
    async createQueuedJob() { return { id: 'unused', status: 'queued' }; },
    async deleteDataset(owner, dataset) { deleted = { owner, dataset }; },
  };
  await assert.rejects(() => persistPreparedUpload(repository, 'verified-user-id', prepared), /synthetic database failure/);
  assert.deepEqual(deleted, { owner: 'verified-user-id', dataset: 'dataset-rollback' });
});
