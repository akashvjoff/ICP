import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CompanyAnalysisEnvelope,
  type CompanyAnalysisInput,
} from '../types/companyIntelligence';
import {
  CompanyAnalysisError,
  type CompanyAnalyzer,
} from './companyAnalyzer';
import {
  analyzeCompanyWithCache,
  type CompanyAnalysisRepository,
} from './companyIntelligenceService';
import { enrichFromPublicWebsite } from './websiteEnrichment';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type LeadAnalysisStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AnalysisJobRecord {
  id: string;
  dataset_id: string;
  owner_user_id: string;
  status: JobStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadForAnalysis {
  id: string;
  dataset_id: string;
  owner_user_id: string;
  company_name: string;
  normalized_domain?: string | null;
  website?: string | null;
  industry_raw?: string | null;
  employee_count?: number | null;
  company_size_raw?: string | null;
  geography?: string | null;
  company_type_raw?: string | null;
  business_model_raw?: string | null;
  product_raw?: string | null;
  notes?: string | null;
  user_corrected_description?: string | null;
  analysis_eligible: boolean;
  analysis_status: LeadAnalysisStatus;
  raw_row?: Record<string, unknown>;
}

export interface ProcessBatchResult {
  job: AnalysisJobRecord;
  processedLeads: Array<{
    id: string;
    companyName: string;
    status: LeadAnalysisStatus;
    envelope?: CompanyAnalysisEnvelope;
    error?: string;
  }>;
  remainingCount: number;
  quotaExceeded?: boolean;
  message?: string;
}

export interface ProcessBatchOptions {
  batchSize?: number;
  enrichWebsite?: boolean;
  sellerContext?: Record<string, unknown>;
  websiteEnricher?: typeof enrichFromPublicWebsite;
}

export interface AnalysisJobRepository {
  getJob(ownerUserId: string, jobId: string): Promise<AnalysisJobRecord | null>;
  getJobByDataset(ownerUserId: string, datasetId: string): Promise<AnalysisJobRecord | null>;
  createJob(ownerUserId: string, datasetId: string, totalCount: number, skippedCount?: number): Promise<AnalysisJobRecord>;
  updateJob(ownerUserId: string, jobId: string, updates: Partial<AnalysisJobRecord>): Promise<AnalysisJobRecord>;
  claimNextBatch(ownerUserId: string, datasetId: string, batchSize: number): Promise<LeadForAnalysis[]>;
  updateLeadAnalysisStatus(ownerUserId: string, leadId: string, status: LeadAnalysisStatus, errorMessage?: string | null): Promise<void>;
  resetStaleProcessingLeads(ownerUserId: string, datasetId: string): Promise<number>;
  resetFailedLeads(ownerUserId: string, datasetId: string): Promise<number>;
  getDatasetLeads(ownerUserId: string, datasetId: string): Promise<LeadForAnalysis[]>;
  getPendingCount(ownerUserId: string, datasetId: string): Promise<number>;
}

export function calculateJobProgress(job: AnalysisJobRecord): {
  remainingCount: number;
  percent: number;
} {
  const processed = job.completed_count + job.failed_count;
  const remainingCount = Math.max(0, job.total_count - processed);
  const percent = job.total_count > 0
    ? Math.min(100, Math.round((job.completed_count / job.total_count) * 100))
    : 100;
  return { remainingCount, percent };
}

export async function startJob(
  repository: AnalysisJobRepository,
  ownerUserId: string,
  jobId: string,
): Promise<AnalysisJobRecord> {
  const job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }
  if (job.status === 'cancelled') {
    throw new Error('Cancelled analysis job cannot be started.');
  }

  // Reset any stale processing leads from a previous crash or interrupted session
  await repository.resetStaleProcessingLeads(ownerUserId, job.dataset_id);

  return repository.updateJob(ownerUserId, jobId, {
    status: 'running',
    updated_at: new Date().toISOString(),
  });
}

export async function pauseJob(
  repository: AnalysisJobRepository,
  ownerUserId: string,
  jobId: string,
): Promise<AnalysisJobRecord> {
  const job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }

  // Reset any currently processing leads back to pending so they can be picked up upon resume
  await repository.resetStaleProcessingLeads(ownerUserId, job.dataset_id);

  return repository.updateJob(ownerUserId, jobId, {
    status: 'paused',
    updated_at: new Date().toISOString(),
  });
}

export async function resumeJob(
  repository: AnalysisJobRepository,
  ownerUserId: string,
  jobId: string,
): Promise<AnalysisJobRecord> {
  const job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }
  if (job.status === 'cancelled') {
    throw new Error('Cancelled analysis job cannot be resumed.');
  }

  await repository.resetStaleProcessingLeads(ownerUserId, job.dataset_id);

  return repository.updateJob(ownerUserId, jobId, {
    status: 'running',
    last_error: null,
    updated_at: new Date().toISOString(),
  });
}

export async function cancelJob(
  repository: AnalysisJobRepository,
  ownerUserId: string,
  jobId: string,
): Promise<AnalysisJobRecord> {
  const job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }

  await repository.resetStaleProcessingLeads(ownerUserId, job.dataset_id);

  return repository.updateJob(ownerUserId, jobId, {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  });
}

export async function retryFailedLeads(
  repository: AnalysisJobRepository,
  ownerUserId: string,
  jobId: string,
): Promise<AnalysisJobRecord> {
  const job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }

  const resetCount = await repository.resetFailedLeads(ownerUserId, job.dataset_id);
  const newFailedCount = Math.max(0, job.failed_count - resetCount);

  return repository.updateJob(ownerUserId, jobId, {
    status: 'running',
    failed_count: newFailedCount,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
}

export async function processBatch(
  repository: AnalysisJobRepository,
  analysisRepo: CompanyAnalysisRepository,
  analyzer: CompanyAnalyzer,
  ownerUserId: string,
  jobId: string,
  options: ProcessBatchOptions = {},
): Promise<ProcessBatchResult> {
  let job = await repository.getJob(ownerUserId, jobId);
  if (!job) {
    throw new Error('Analysis job not found.');
  }

  if (job.status === 'cancelled') {
    return {
      job,
      processedLeads: [],
      remainingCount: Math.max(0, job.total_count - (job.completed_count + job.failed_count)),
      message: 'Job is cancelled.',
    };
  }

  if (job.status === 'paused') {
    return {
      job,
      processedLeads: [],
      remainingCount: Math.max(0, job.total_count - (job.completed_count + job.failed_count)),
      message: 'Job is paused.',
    };
  }

  if (job.status === 'completed' || job.status === 'completed_with_errors') {
    return {
      job,
      processedLeads: [],
      remainingCount: 0,
      message: 'Job is already finished.',
    };
  }

  // Transition queued to running if needed
  if (job.status === 'queued') {
    job = await repository.updateJob(ownerUserId, jobId, {
      status: 'running',
      updated_at: new Date().toISOString(),
    });
  }

  // Bounded batch size between 1 and 5 (default 3)
  const batchSize = Math.min(5, Math.max(1, options.batchSize ?? 3));
  const claimedLeads = await repository.claimNextBatch(ownerUserId, job.dataset_id, batchSize);

  if (claimedLeads.length === 0) {
    const remaining = await repository.getPendingCount(ownerUserId, job.dataset_id);
    if (remaining === 0) {
      const finalStatus: JobStatus = job.failed_count > 0
        ? (job.completed_count > 0 ? 'completed_with_errors' : 'failed')
        : 'completed';
      job = await repository.updateJob(ownerUserId, jobId, {
        status: finalStatus,
        updated_at: new Date().toISOString(),
      });
    }
    return {
      job,
      processedLeads: [],
      remainingCount: remaining,
    };
  }

  const processedLeads: ProcessBatchResult['processedLeads'] = [];
  let quotaExceeded = false;
  const enrichWebsite = options.enrichWebsite ?? false;
  const enricher = options.websiteEnricher ?? enrichFromPublicWebsite;

  for (let i = 0; i < claimedLeads.length; i++) {
    const lead = claimedLeads[i];

    // If quota was exceeded in previous iteration of this batch, reset remaining claimed leads to pending
    if (quotaExceeded) {
      await repository.updateLeadAnalysisStatus(ownerUserId, lead.id, 'pending');
      continue;
    }

    const domain = lead.normalized_domain || lead.website || '';
    const userCorrection = (lead.user_corrected_description || '').trim();
    const uploadedDescription = userCorrection || (lead.product_raw || lead.notes || '');

    let websiteEvidence: CompanyAnalysisEnvelope['websiteEvidence'];
    if (enrichWebsite && domain) {
      try {
        const evidence = await enricher(domain, { enabled: true });
        websiteEvidence = evidence;
      } catch (err) {
        websiteEvidence = {
          status: 'failed',
          sourceUrl: null,
          fetchedAt: null,
          title: null,
          metaDescription: null,
          headings: [],
          mainContent: '',
          pagesFetched: [],
          reason: err instanceof Error ? err.message : 'Website retrieval failed.',
        };
      }
    }

    const publicWebsiteText = websiteEvidence?.status === 'fetched'
      ? [websiteEvidence.title, websiteEvidence.metaDescription, ...websiteEvidence.headings, websiteEvidence.mainContent]
          .filter(Boolean).join('\n').slice(0, 12_000)
      : '';

    const companyAttributes: Record<string, string | number | boolean | string[] | null> = {};
    if (lead.industry_raw) companyAttributes.industry = lead.industry_raw;
    if (lead.employee_count !== null && lead.employee_count !== undefined) companyAttributes.employee_count = lead.employee_count;
    else if (lead.company_size_raw) companyAttributes.employee_count = lead.company_size_raw;
    if (lead.geography) companyAttributes.geography = lead.geography;
    if (lead.company_type_raw) companyAttributes.company_type = lead.company_type_raw;
    if (lead.business_model_raw) companyAttributes.business_model = lead.business_model_raw;

    const analysisInput: CompanyAnalysisInput = {
      companyName: lead.company_name,
      companyDomain: domain,
      companyProductDescription: uploadedDescription,
      companyAttributes,
      userCorrectedDescription: userCorrection,
      publicWebsiteText: publicWebsiteText || undefined,
      publicWebsiteUrl: websiteEvidence?.status === 'fetched' ? websiteEvidence.sourceUrl || undefined : undefined,
      publicWebsiteFetchedAt: websiteEvidence?.status === 'fetched' ? websiteEvidence.fetchedAt || undefined : undefined,
      publicWebsiteFetchStatus: websiteEvidence?.status,
      sellerProductContext: options.sellerContext || {},
    };

    try {
      const envelope = await analyzeCompanyWithCache(
        analysisRepo,
        analyzer,
        ownerUserId,
        lead.id,
        analysisInput,
        websiteEvidence,
      );

      await repository.updateLeadAnalysisStatus(ownerUserId, lead.id, 'completed');
      job.completed_count += 1;
      processedLeads.push({
        id: lead.id,
        companyName: lead.company_name,
        status: 'completed',
        envelope,
      });
    } catch (error) {
      const isQuotaOrRateLimit = error instanceof CompanyAnalysisError &&
        (error.code === 'RATE_LIMITED' || /quota|rate.?limit/i.test(error.message));

      if (isQuotaOrRateLimit) {
        quotaExceeded = true;
        await repository.updateLeadAnalysisStatus(ownerUserId, lead.id, 'failed', error.message);
        job.failed_count += 1;
        job.status = 'paused';
        job.last_error = 'AI rate limit / quota exceeded. Processing paused gracefully. Resume when quota resets.';

        processedLeads.push({
          id: lead.id,
          companyName: lead.company_name,
          status: 'failed',
          error: job.last_error,
        });

        // Reset the remaining leads in this batch back to pending
        for (let j = i + 1; j < claimedLeads.length; j++) {
          await repository.updateLeadAnalysisStatus(ownerUserId, claimedLeads[j].id, 'pending');
        }
        break;
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Analysis failed.';
        await repository.updateLeadAnalysisStatus(ownerUserId, lead.id, 'failed', errorMsg);
        job.failed_count += 1;
        job.last_error = errorMsg;
        processedLeads.push({
          id: lead.id,
          companyName: lead.company_name,
          status: 'failed',
          error: errorMsg,
        });
      }
    }
  }

  const remaining = await repository.getPendingCount(ownerUserId, job.dataset_id);
  if (!quotaExceeded && remaining === 0) {
    job.status = job.failed_count > 0
      ? (job.completed_count > 0 ? 'completed_with_errors' : 'failed')
      : 'completed';
  }

  job = await repository.updateJob(ownerUserId, jobId, {
    status: job.status,
    completed_count: job.completed_count,
    failed_count: job.failed_count,
    last_error: job.last_error,
    updated_at: new Date().toISOString(),
  });

  return {
    job,
    processedLeads,
    remainingCount: remaining,
    quotaExceeded,
  };
}

// ------------------------------------------------------------------------------
// SUPABASE REPOSITORY IMPLEMENTATION
// ------------------------------------------------------------------------------

export function createSupabaseAnalysisJobRepository(client: SupabaseClient): AnalysisJobRepository {
  return {
    async getJob(ownerUserId, jobId) {
      const { data, error } = await client
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();
      if (error) throw error;
      return data as AnalysisJobRecord | null;
    },

    async getJobByDataset(ownerUserId, datasetId) {
      const { data, error } = await client
        .from('analysis_jobs')
        .select('*')
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AnalysisJobRecord | null;
    },

    async createJob(ownerUserId, datasetId, totalCount, skippedCount = 0) {
      const cappedTotal = Math.min(100, Math.max(0, totalCount));
      const { data, error } = await client
        .from('analysis_jobs')
        .insert({
          owner_user_id: ownerUserId,
          dataset_id: datasetId,
          status: 'queued',
          total_count: cappedTotal,
          completed_count: 0,
          failed_count: 0,
          skipped_count: skippedCount,
          last_error: null,
        })
        .select('*')
        .single();
      if (error || !data) throw error || new Error('Failed to create analysis job.');
      return data as AnalysisJobRecord;
    },

    async updateJob(ownerUserId, jobId, updates) {
      const { data, error } = await client
        .from('analysis_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('owner_user_id', ownerUserId)
        .select('*')
        .single();
      if (error || !data) throw error || new Error('Failed to update analysis job.');
      return data as AnalysisJobRecord;
    },

    async claimNextBatch(ownerUserId, datasetId, batchSize) {
      // 1. Try atomic database RPC function first
      try {
        const { data: rpcData, error: rpcError } = await client.rpc('claim_next_analysis_batch', {
          p_dataset_id: datasetId,
          p_batch_size: batchSize,
        });

        if (!rpcError && Array.isArray(rpcData)) {
          return rpcData.map((row) => ({
            id: row.id,
            dataset_id: datasetId,
            owner_user_id: ownerUserId,
            company_name: row.company_name,
            normalized_domain: row.normalized_domain,
            website: row.website,
            industry_raw: row.industry_raw,
            employee_count: row.employee_count,
            company_size_raw: row.company_size_raw,
            geography: row.geography,
            company_type_raw: row.company_type_raw,
            business_model_raw: row.business_model_raw,
            product_raw: row.product_raw,
            notes: row.notes,
            user_corrected_description: row.user_corrected_description,
            analysis_eligible: Boolean(row.analysis_eligible),
            analysis_status: row.analysis_status || 'processing',
          }));
        }
      } catch {
        // Fall back to standard query + update if RPC is missing
      }

      // 2. Fallback query + atomic update
      const { data: candidates, error: selectError } = await client
        .from('leads')
        .select('id, company_name, normalized_domain, website, industry_raw, employee_count, company_size_raw, geography, company_type_raw, business_model_raw, product_raw, notes, user_corrected_description, analysis_eligible, analysis_status')
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .eq('analysis_eligible', true)
        .eq('analysis_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (selectError) throw selectError;
      if (!candidates || candidates.length === 0) return [];

      const candidateIds = candidates.map((c) => c.id);
      const { error: updateError } = await client
        .from('leads')
        .update({ analysis_status: 'processing' })
        .in('id', candidateIds)
        .eq('owner_user_id', ownerUserId)
        .eq('analysis_status', 'pending');

      if (updateError) throw updateError;

      return candidates.map((lead) => ({
        id: lead.id,
        dataset_id: datasetId,
        owner_user_id: ownerUserId,
        company_name: lead.company_name,
        normalized_domain: lead.normalized_domain,
        website: lead.website,
        industry_raw: lead.industry_raw,
        employee_count: lead.employee_count,
        company_size_raw: lead.company_size_raw,
        geography: lead.geography,
        company_type_raw: lead.company_type_raw,
        business_model_raw: lead.business_model_raw,
        product_raw: lead.product_raw,
        notes: lead.notes,
        user_corrected_description: lead.user_corrected_description,
        analysis_eligible: Boolean(lead.analysis_eligible),
        analysis_status: 'processing',
      }));
    },

    async updateLeadAnalysisStatus(ownerUserId, leadId, status, errorMessage = null) {
      const { error } = await client
        .from('leads')
        .update({ analysis_status: status })
        .eq('id', leadId)
        .eq('owner_user_id', ownerUserId);
      if (error) throw error;

      if (status === 'failed' && errorMessage) {
        try {
          await client
            .from('company_analyses')
            .upsert({
              owner_user_id: ownerUserId,
              lead_id: leadId,
              analysis_status: 'failed',
              error_message: errorMessage,
              error_code: 'ANALYSIS_FAILED',
              analyzed_at: new Date().toISOString(),
            }, { onConflict: 'lead_id' });
        } catch {
          // Non-fatal if error record cannot be saved
        }
      }
    },

    async resetStaleProcessingLeads(ownerUserId, datasetId) {
      const { data, error } = await client
        .from('leads')
        .update({ analysis_status: 'pending' })
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .eq('analysis_eligible', true)
        .eq('analysis_status', 'processing')
        .select('id');
      if (error) throw error;
      return (data || []).length;
    },

    async resetFailedLeads(ownerUserId, datasetId) {
      const { data, error } = await client
        .from('leads')
        .update({ analysis_status: 'pending' })
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .eq('analysis_eligible', true)
        .eq('analysis_status', 'failed')
        .select('id');
      if (error) throw error;
      return (data || []).length;
    },

    async getDatasetLeads(ownerUserId, datasetId) {
      const { data, error } = await client
        .from('leads')
        .select('id, dataset_id, owner_user_id, company_name, normalized_domain, website, industry_raw, employee_count, company_size_raw, geography, company_type_raw, business_model_raw, product_raw, notes, user_corrected_description, analysis_eligible, analysis_status')
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((lead) => ({
        id: lead.id,
        dataset_id: lead.dataset_id,
        owner_user_id: lead.owner_user_id,
        company_name: lead.company_name,
        normalized_domain: lead.normalized_domain,
        website: lead.website,
        industry_raw: lead.industry_raw,
        employee_count: lead.employee_count,
        company_size_raw: lead.company_size_raw,
        geography: lead.geography,
        company_type_raw: lead.company_type_raw,
        business_model_raw: lead.business_model_raw,
        product_raw: lead.product_raw,
        notes: lead.notes,
        user_corrected_description: lead.user_corrected_description,
        analysis_eligible: Boolean(lead.analysis_eligible),
        analysis_status: (lead.analysis_status as LeadAnalysisStatus) || 'pending',
      }));
    },

    async getPendingCount(ownerUserId, datasetId) {
      const { count, error } = await client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .eq('analysis_eligible', true)
        .eq('analysis_status', 'pending');
      if (error) throw error;
      return count || 0;
    },
  };
}

// ------------------------------------------------------------------------------
// IN-MEMORY REPOSITORY IMPLEMENTATION (DEMO MODE & TESTS)
// ------------------------------------------------------------------------------

export class InMemoryAnalysisJobRepository implements AnalysisJobRepository {
  private jobs: Map<string, AnalysisJobRecord> = new Map();
  private leads: Map<string, LeadForAnalysis> = new Map();

  constructor(initialJobs: AnalysisJobRecord[] = [], initialLeads: LeadForAnalysis[] = []) {
    for (const job of initialJobs) this.jobs.set(job.id, structuredClone(job));
    for (const lead of initialLeads) this.leads.set(lead.id, structuredClone(lead));
  }

  async getJob(ownerUserId: string, jobId: string): Promise<AnalysisJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.owner_user_id !== ownerUserId) return null;
    return structuredClone(job);
  }

  async getJobByDataset(ownerUserId: string, datasetId: string): Promise<AnalysisJobRecord | null> {
    for (const job of this.jobs.values()) {
      if (job.dataset_id === datasetId && job.owner_user_id === ownerUserId) {
        return structuredClone(job);
      }
    }
    return null;
  }

  async createJob(ownerUserId: string, datasetId: string, totalCount: number, skippedCount = 0): Promise<AnalysisJobRecord> {
    const capped = Math.min(100, Math.max(0, totalCount));
    const now = new Date().toISOString();
    const job: AnalysisJobRecord = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dataset_id: datasetId,
      owner_user_id: ownerUserId,
      status: 'queued',
      total_count: capped,
      completed_count: 0,
      failed_count: 0,
      skipped_count: skippedCount,
      last_error: null,
      created_at: now,
      updated_at: now,
    };
    this.jobs.set(job.id, structuredClone(job));
    return job;
  }

  async updateJob(ownerUserId: string, jobId: string, updates: Partial<AnalysisJobRecord>): Promise<AnalysisJobRecord> {
    const existing = this.jobs.get(jobId);
    if (!existing || existing.owner_user_id !== ownerUserId) {
      throw new Error('Analysis job not found.');
    }
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, structuredClone(updated));
    return updated;
  }

  async claimNextBatch(ownerUserId: string, datasetId: string, batchSize: number): Promise<LeadForAnalysis[]> {
    const claimed: LeadForAnalysis[] = [];
    for (const lead of this.leads.values()) {
      if (
        lead.dataset_id === datasetId &&
        lead.owner_user_id === ownerUserId &&
        lead.analysis_eligible &&
        lead.analysis_status === 'pending'
      ) {
        lead.analysis_status = 'processing';
        claimed.push(structuredClone(lead));
        if (claimed.length >= batchSize) break;
      }
    }
    return claimed;
  }

  async updateLeadAnalysisStatus(ownerUserId: string, leadId: string, status: LeadAnalysisStatus): Promise<void> {
    const lead = this.leads.get(leadId);
    if (!lead || lead.owner_user_id !== ownerUserId) {
      throw new Error('Lead not found.');
    }
    lead.analysis_status = status;
  }

  async resetStaleProcessingLeads(ownerUserId: string, datasetId: string): Promise<number> {
    let count = 0;
    for (const lead of this.leads.values()) {
      if (
        lead.dataset_id === datasetId &&
        lead.owner_user_id === ownerUserId &&
        lead.analysis_eligible &&
        lead.analysis_status === 'processing'
      ) {
        lead.analysis_status = 'pending';
        count++;
      }
    }
    return count;
  }

  async resetFailedLeads(ownerUserId: string, datasetId: string): Promise<number> {
    let count = 0;
    for (const lead of this.leads.values()) {
      if (
        lead.dataset_id === datasetId &&
        lead.owner_user_id === ownerUserId &&
        lead.analysis_eligible &&
        lead.analysis_status === 'failed'
      ) {
        lead.analysis_status = 'pending';
        count++;
      }
    }
    return count;
  }

  async getDatasetLeads(ownerUserId: string, datasetId: string): Promise<LeadForAnalysis[]> {
    const results: LeadForAnalysis[] = [];
    for (const lead of this.leads.values()) {
      if (lead.dataset_id === datasetId && lead.owner_user_id === ownerUserId) {
        results.push(structuredClone(lead));
      }
    }
    return results;
  }

  async getPendingCount(ownerUserId: string, datasetId: string): Promise<number> {
    let count = 0;
    for (const lead of this.leads.values()) {
      if (
        lead.dataset_id === datasetId &&
        lead.owner_user_id === ownerUserId &&
        lead.analysis_eligible &&
        lead.analysis_status === 'pending'
      ) {
        count++;
      }
    }
    return count;
  }

  // Test helper to seed leads
  addLead(lead: LeadForAnalysis) {
    this.leads.set(lead.id, structuredClone(lead));
  }
}
