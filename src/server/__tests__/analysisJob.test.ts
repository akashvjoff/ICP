import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateJobProgress,
  cancelJob,
  pauseJob,
  processBatch,
  resumeJob,
  retryFailedLeads,
  startJob,
  InMemoryAnalysisJobRepository,
  type AnalysisJobRecord,
  type LeadForAnalysis,
} from '../analysisJobService';
import {
  CompanyAnalysisError,
  MockCompanyAnalyzer,
  type CompanyAnalyzer,
} from '../companyAnalyzer';
import {
  InMemoryCompanyAnalysisRepository,
} from '../companyIntelligenceService';
import { isTransientWorkerError, savedSellerContext } from '../analysisWorker';

test('worker retries temporary upstream failures without hiding permission errors', () => {
  assert.equal(isTransientWorkerError({ status: 502, message: 'Bad Gateway' }), true);
  assert.equal(isTransientWorkerError({ message: 'TypeError: fetch failed; read ECONNRESET' }), true);
  assert.equal(isTransientWorkerError({ status: 403, code: '42501', message: 'permission denied for table lead_contacts' }), false);
});

test('real analysis never inherits the fictional demo seller offering', () => {
  assert.equal(savedSellerContext(null), null);
  assert.equal(savedSellerContext({ company_name: 'My Company', onboarding_data: {} }), null);
  const context = savedSellerContext({
    company_name: 'Real Seller', product_description: 'Approval software', main_customer_problem: 'Manual approvals',
    onboarding_data: { productName: 'Flow', coreFeatures: ['Approval routing'] },
  });
  assert.equal(context?.companyName, 'Real Seller');
  assert.equal(context?.productName, 'Flow');
  assert.equal(context?.currentCustomerProblem, 'Manual approvals');
  assert.equal(context?.coreFeatures[0], 'Approval routing');
  assert.notEqual(context?.companyName, 'Synthetix Data Cloud');
});

function createSyntheticLeads(
  datasetId: string,
  ownerUserId: string,
  count: number,
  aiEligibleLimit = 100
): LeadForAnalysis[] {
  return Array.from({ length: count }, (_, i) => {
    const isEligible = i < aiEligibleLimit;
    return {
      id: `lead-syn-${i + 1}`,
      dataset_id: datasetId,
      owner_user_id: ownerUserId,
      company_name: `Company ${i + 1} Corp`,
      normalized_domain: `company${i + 1}.example.com`,
      website: `https://company${i + 1}.example.com`,
      industry_raw: i % 2 === 0 ? 'Enterprise Software' : 'HR Technology',
      employee_count: 50 + i * 10,
      company_size_raw: `${50 + i * 10}`,
      geography: 'United States',
      company_type_raw: 'B2B SaaS',
      business_model_raw: 'Subscription',
      product_raw: `Software platform ${i + 1}`,
      notes: `Notes for company ${i + 1}`,
      user_corrected_description: null,
      analysis_eligible: isEligible,
      analysis_status: isEligible ? 'pending' : 'skipped',
    };
  });
}

test('1. Job creation caps at 100 AI leads and records skipped leads', async () => {
  const repo = new InMemoryAnalysisJobRepository();
  const owner = 'user-001';
  const datasetId = 'dataset-100';

  const job = await repo.createJob(owner, datasetId, 150, 50);
  assert.equal(job.total_count, 100, 'Free tier caps AI analysis at 100 leads');
  assert.equal(job.skipped_count, 50);
  assert.equal(job.status, 'queued');
  assert.equal(job.completed_count, 0);
  assert.equal(job.failed_count, 0);
});

test('2. Progress calculation computes remaining leads and percentage', () => {
  const job: AnalysisJobRecord = {
    id: 'job-1',
    dataset_id: 'dataset-1',
    owner_user_id: 'user-1',
    status: 'running',
    total_count: 50,
    completed_count: 25,
    failed_count: 5,
    skipped_count: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const progress = calculateJobProgress(job);
  assert.equal(progress.remainingCount, 20);
  assert.equal(progress.percent, 50);

  const finishedJob = { ...job, completed_count: 50, failed_count: 0 };
  assert.equal(calculateJobProgress(finishedJob).remainingCount, 0);
  assert.equal(calculateJobProgress(finishedJob).percent, 100);
});

test('3. Batch processing analyzes companies in bounded chunks and completes', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-batch';
  const leads = createSyntheticLeads(datasetId, owner, 4);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();
  const analyzer = new MockCompanyAnalyzer();

  const job = await repo.createJob(owner, datasetId, 4, 0);

  // Batch 1: process 3 companies
  const batch1 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 3 });
  assert.equal(batch1.processedLeads.length, 3);
  assert.equal(batch1.job.completed_count, 3);
  assert.equal(batch1.remainingCount, 1);
  assert.equal(batch1.job.status, 'running');

  // Batch 2: process remaining 1 company
  const batch2 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 3 });
  assert.equal(batch2.processedLeads.length, 1);
  assert.equal(batch2.job.completed_count, 4);
  assert.equal(batch2.remainingCount, 0);
  assert.equal(batch2.job.status, 'completed');
});

test('4. One company failure transitions job to completed_with_errors without halting other leads', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-err';
  const leads = createSyntheticLeads(datasetId, owner, 3);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();

  let callCount = 0;
  const flakeyAnalyzer: CompanyAnalyzer = {
    providerName: 'mock-flakey',
    async analyze(input) {
      callCount++;
      if (input.companyName.includes('2')) {
        throw new CompanyAnalysisError('INVALID_STRUCTURED_OUTPUT', 'Malformed provider JSON [mocked]', 502);
      }
      return new MockCompanyAnalyzer().analyze(input);
    },
  };

  const job = await repo.createJob(owner, datasetId, 3, 0);
  const result = await processBatch(repo, analysisRepo, flakeyAnalyzer, owner, job.id, { batchSize: 5 });

  assert.equal(result.processedLeads.length, 3);
  assert.equal(result.job.completed_count, 2);
  assert.equal(result.job.failed_count, 1);
  assert.equal(result.job.status, 'completed_with_errors');
  assert.ok(result.job.last_error?.includes('Malformed'));
});

test('5. Pause and resume controls execution safely', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-pause';
  const leads = createSyntheticLeads(datasetId, owner, 5);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();
  const analyzer = new MockCompanyAnalyzer();

  const job = await repo.createJob(owner, datasetId, 5, 0);
  await startJob(repo, owner, job.id);

  // Process 2
  await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 2 });
  let currentJob = (await repo.getJob(owner, job.id))!;
  assert.equal(currentJob.completed_count, 2);

  // Pause
  const pausedJob = await pauseJob(repo, owner, job.id);
  assert.equal(pausedJob.status, 'paused');

  // Attempt process while paused -> no leads claimed
  const pausedResult = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 2 });
  assert.equal(pausedResult.processedLeads.length, 0);
  assert.equal(pausedResult.message, 'Job is paused.');

  // Resume
  const resumedJob = await resumeJob(repo, owner, job.id);
  assert.equal(resumedJob.status, 'running');

  // Process remaining 3
  const finalResult = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 5 });
  assert.equal(finalResult.job.completed_count, 5);
  assert.equal(finalResult.job.status, 'completed');
});

test('6. Browser refresh recovery: persists checkpoint and resumes without re-processing', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-refresh';
  const leads = createSyntheticLeads(datasetId, owner, 6);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();
  const analyzer = new MockCompanyAnalyzer();

  const job = await repo.createJob(owner, datasetId, 6, 0);

  // Step 1: Process 3 leads
  await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 3 });

  // Step 2: Simulate "browser closed / refreshed": reload job from repository
  const reloadedJob = await repo.getJob(owner, job.id);
  assert.ok(reloadedJob);
  assert.equal(reloadedJob.completed_count, 3);
  assert.equal(reloadedJob.status, 'running');

  // Step 3: Resume batch processing
  const nextBatch = await processBatch(repo, analysisRepo, analyzer, owner, reloadedJob.id, { batchSize: 5 });
  assert.equal(nextBatch.job.completed_count, 6);
  assert.equal(nextBatch.job.status, 'completed');

  // Verify none were duplicated
  const datasetLeads = await repo.getDatasetLeads(owner, datasetId);
  const completedLeads = datasetLeads.filter((l) => l.analysis_status === 'completed');
  assert.equal(completedLeads.length, 6);
});

test('7. Retry failed leads resets failed count and allows re-analysis', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-retry';
  const leads = createSyntheticLeads(datasetId, owner, 2);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();

  let shouldFail = true;
  const mockProvider: CompanyAnalyzer = {
    providerName: 'mock-toggle',
    async analyze(input) {
      if (shouldFail) throw new CompanyAnalysisError('TIMEOUT', 'Timeout occurred [mocked]', 504);
      return new MockCompanyAnalyzer().analyze(input);
    },
  };

  const job = await repo.createJob(owner, datasetId, 2, 0);

  // Process -> both fail
  await processBatch(repo, analysisRepo, mockProvider, owner, job.id, { batchSize: 2 });
  let jobState = (await repo.getJob(owner, job.id))!;
  assert.equal(jobState.failed_count, 2);
  assert.equal(jobState.status, 'failed');

  // Reset/retry failed
  shouldFail = false;
  const retriedJob = await retryFailedLeads(repo, owner, job.id);
  assert.equal(retriedJob.failed_count, 0);
  assert.equal(retriedJob.status, 'running');

  // Process again -> both succeed
  const result = await processBatch(repo, analysisRepo, mockProvider, owner, job.id, { batchSize: 2 });
  assert.equal(result.job.completed_count, 2);
  assert.equal(result.job.failed_count, 0);
  assert.equal(result.job.status, 'completed');
});

test('8. Job cancellation halts processing and prevents resumes', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-cancel';
  const leads = createSyntheticLeads(datasetId, owner, 3);
  const repo = new InMemoryAnalysisJobRepository([], leads);

  const job = await repo.createJob(owner, datasetId, 3, 0);
  const cancelled = await cancelJob(repo, owner, job.id);
  assert.equal(cancelled.status, 'cancelled');

  await assert.rejects(async () => {
    await startJob(repo, owner, job.id);
  }, /Cancelled analysis job cannot be started/);

  await assert.rejects(async () => {
    await resumeJob(repo, owner, job.id);
  }, /Cancelled analysis job cannot be resumed/);
});

test('9. Repeated process requests on completed job are idempotent', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-idempotent';
  const leads = createSyntheticLeads(datasetId, owner, 1);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();
  const analyzer = new MockCompanyAnalyzer();

  const job = await repo.createJob(owner, datasetId, 1, 0);
  await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 2 });

  const secondCall = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 2 });
  assert.equal(secondCall.processedLeads.length, 0);
  assert.equal(secondCall.job.completed_count, 1);
  assert.equal(secondCall.message, 'Job is already finished.');
});

test('10. Concurrent batch claims do not claim the same leads twice', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-concurrency';
  const leads = createSyntheticLeads(datasetId, owner, 6);
  const repo = new InMemoryAnalysisJobRepository([], leads);

  // Simulate two simultaneous claims of 3 leads
  const [claim1, claim2] = await Promise.all([
    repo.claimNextBatch(owner, datasetId, 3),
    repo.claimNextBatch(owner, datasetId, 3),
  ]);

  assert.equal(claim1.length, 3);
  assert.equal(claim2.length, 3);

  const ids1 = new Set(claim1.map((l) => l.id));
  const ids2 = new Set(claim2.map((l) => l.id));

  // Assert intersection is empty
  for (const id of ids1) {
    assert.equal(ids2.has(id), false, `Lead ${id} was claimed concurrently by two requests!`);
  }
});

test('11. AI quota exhaustion schedules automatic retry without losing the affected lead', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-quota';
  const leads = createSyntheticLeads(datasetId, owner, 4);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();

  let attempted = 0;
  const quotaExhaustedAnalyzer: CompanyAnalyzer = {
    providerName: 'mock-gemini-quota',
    async analyze() {
      attempted++;
      throw new CompanyAnalysisError(
        'RATE_LIMITED',
        'Quota exceeded for quota metric GenerateContentRequestsPerMinute [mocked]',
        429,
        true
      );
    },
  };

  const job = await repo.createJob(owner, datasetId, 4, 0);
  const result = await processBatch(repo, analysisRepo, quotaExhaustedAnalyzer, owner, job.id, { batchSize: 4 });

  assert.equal(result.quotaExceeded, true);
  assert.equal(result.job.status, 'waiting_for_quota');
  assert.ok(result.job.next_retry_at && Date.parse(result.job.next_retry_at) > Date.now());
  assert.equal(result.job.failed_count, 0);
  assert.equal(attempted, 1, 'Should stop immediately on quota error without burning more calls');

  // Verify remaining leads in batch were reset to 'pending'
  const datasetLeads = await repo.getDatasetLeads(owner, datasetId);
  const pendingLeads = datasetLeads.filter((l) => l.analysis_status === 'pending');
  assert.equal(pendingLeads.length, 4, 'The rate-limited lead and unattempted leads must be restored to pending');

  await repo.updateJob(owner, job.id, { next_retry_at: new Date(Date.now() - 1000).toISOString() });
  const resumed = await processBatch(repo, analysisRepo, new MockCompanyAnalyzer(), owner, job.id, { batchSize: 4 });
  assert.equal(resumed.job.status, 'completed');
  assert.equal(resumed.job.completed_count, 4);
});

test('daily company budget waits until the next UTC day without marking leads failed', async () => {
  const owner = 'budget-user';
  const repo = new InMemoryAnalysisJobRepository([], createSyntheticLeads('budget-dataset', owner, 2));
  const job = await repo.createJob(owner, 'budget-dataset', 2);
  const result = await processBatch(repo, new InMemoryCompanyAnalysisRepository(), new MockCompanyAnalyzer(), owner, job.id, {
    batchSize: 2, reserveDailyCompany: async () => false,
  });
  assert.equal(result.job.status, 'waiting_for_quota');
  assert.equal(result.job.failed_count, 0);
  assert.equal(result.remainingCount, 2);
  assert.ok(result.job.next_retry_at);
});

test('12. Authentication and cross-tenant ownership protection', async () => {
  const repo = new InMemoryAnalysisJobRepository();
  const ownerA = 'user-alice';
  const ownerB = 'user-bob';

  const jobA = await repo.createJob(ownerA, 'dataset-a', 5, 0);

  // Bob attempts to get or update Alice's job
  const bobFetch = await repo.getJob(ownerB, jobA.id);
  assert.equal(bobFetch, null);

  await assert.rejects(async () => {
    await startJob(repo, ownerB, jobA.id);
  }, /Analysis job not found/);
});

test('13. Content-hash caching reuses previously completed analyses', async () => {
  const owner = 'user-001';
  const datasetId = 'dataset-cache';
  const leads = createSyntheticLeads(datasetId, owner, 2);
  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();

  let providerCalls = 0;
  const countingAnalyzer: CompanyAnalyzer = {
    providerName: 'mock-counting',
    async analyze(input) {
      providerCalls++;
      return new MockCompanyAnalyzer().analyze(input);
    },
  };

  const job = await repo.createJob(owner, datasetId, 2, 0);
  await processBatch(repo, analysisRepo, countingAnalyzer, owner, job.id, { batchSize: 2 });
  assert.equal(providerCalls, 2);

  // Reset leads to pending and re-process -> should be served from cache
  await repo.updateLeadAnalysisStatus(owner, leads[0].id, 'pending');
  await repo.updateLeadAnalysisStatus(owner, leads[1].id, 'pending');

  const cachedJob = await repo.createJob(owner, datasetId, 2, 0);
  const cachedBatch = await processBatch(repo, analysisRepo, countingAnalyzer, owner, cachedJob.id, { batchSize: 2 });

  assert.equal(providerCalls, 2, 'Provider should not be re-called for identical cached content');
  assert.equal(cachedBatch.processedLeads[0].envelope?.cached, true);
});

// ==============================================================================
// SYNTHETIC 20-ROW DATASET END-TO-END DEMONSTRATION TEST
// Contract: Start -> process 8 companies -> pause -> resume -> process remaining 12.
// Verify 20 completed analyses and no duplicates.
// ==============================================================================

test('14. Explicit Milestone Requirement: 20-Row Synthetic Dataset (Start -> 8 -> Pause -> Resume -> 12)', async () => {
  const owner = 'user-alex-vance';
  const datasetId = 'dataset-synthetic-20';

  // 1. Create synthetic 20-row dataset
  const leads = createSyntheticLeads(datasetId, owner, 20);
  assert.equal(leads.length, 20);

  const repo = new InMemoryAnalysisJobRepository([], leads);
  const analysisRepo = new InMemoryCompanyAnalysisRepository();
  const analyzer = new MockCompanyAnalyzer();

  // 2. Job created in queued state
  const job = await repo.createJob(owner, datasetId, 20, 0);
  assert.equal(job.status, 'queued');
  assert.equal(job.total_count, 20);

  // 3. User clicks START ANALYSIS
  await startJob(repo, owner, job.id);
  let liveJob = (await repo.getJob(owner, job.id))!;
  assert.equal(liveJob.status, 'running');

  // 4. Process Batch 1 (4 companies)
  const b1 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(b1.processedLeads.length, 4);
  assert.equal(b1.job.completed_count, 4);

  // 5. Process Batch 2 (4 companies) -> Exactly 8 companies completed
  const b2 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(b2.processedLeads.length, 4);
  assert.equal(b2.job.completed_count, 8);
  assert.equal(b2.remainingCount, 12);

  // 6. User clicks PAUSE
  const paused = await pauseJob(repo, owner, job.id);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.completed_count, 8);

  // 7. Verify processing is halted while paused
  const pausedAttempt = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(pausedAttempt.processedLeads.length, 0);
  assert.equal(pausedAttempt.message, 'Job is paused.');

  // 8. User clicks RESUME
  const resumed = await resumeJob(repo, owner, job.id);
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.completed_count, 8);

  // 9. Process remaining 12 companies (batches of 4)
  const b3 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(b3.processedLeads.length, 4);
  assert.equal(b3.job.completed_count, 12);

  const b4 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(b4.processedLeads.length, 4);
  assert.equal(b4.job.completed_count, 16);

  const b5 = await processBatch(repo, analysisRepo, analyzer, owner, job.id, { batchSize: 4 });
  assert.equal(b5.processedLeads.length, 4);
  assert.equal(b5.job.completed_count, 20);
  assert.equal(b5.job.status, 'completed');
  assert.equal(b5.remainingCount, 0);

  // 10. Audit Verification: Exactly 20 completed analyses, 0 failed, 0 duplicates
  const allDatasetLeads = await repo.getDatasetLeads(owner, datasetId);
  assert.equal(allDatasetLeads.length, 20);

  const completedStatuses = allDatasetLeads.map((l) => l.analysis_status);
  assert.equal(completedStatuses.filter((s) => s === 'completed').length, 20);

  const uniqueIds = new Set(allDatasetLeads.map((l) => l.id));
  assert.equal(uniqueIds.size, 20, 'No duplicate leads processed');

  const finalJob = (await repo.getJob(owner, job.id))!;
  assert.equal(finalJob.status, 'completed');
  assert.equal(finalJob.total_count, 20);
  assert.equal(finalJob.completed_count, 20);
  assert.equal(finalJob.failed_count, 0);
  assert.equal(calculateJobProgress(finalJob).percent, 100);
});
