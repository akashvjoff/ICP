import type { SupabaseClient } from '@supabase/supabase-js';
import { createCompanyAnalyzer } from './companyAnalyzer';
import { createSupabaseCompanyAnalysisRepository } from './companyIntelligenceService';
import { createSupabaseAnalysisJobRepository, processBatch, type AnalysisJobRecord } from './analysisJobService';
import { analyzeLeadNeedGap, createSupabaseStrategicAnalysisRepository, toScoringNeedGap } from './strategicAnalysisService';
import { createSupabaseScoringRepository } from './scoringService';
import { calculateDeterministicICPScore } from '../lib/scoring';
import { contextToOfferingProfile, DEFAULT_SELLER_CONTEXT } from '../types/offering';
import type { NormalizedLead } from '../types/lead';
import { companyIntelligenceSchema } from '../types/companyIntelligence';
import type { CompanyAnalysisEnvelope } from '../types/companyIntelligence';
import { CURRENT_SCORING_MODEL_VERSION } from '../lib/scoring';
import { captureServerFailure, trackServerEvent } from './telemetry';
import { clearExpiredContacts } from './contactRetention';
import { sendAnalysisFinishedEmail } from './analysisEmail';
import { canAnalyzeCompany } from './billingService';

export function isTransientWorkerError(error: unknown): boolean {
  const candidate = error as { status?: number; message?: string } | null;
  if (candidate?.status && [502, 503, 504].includes(candidate.status)) return true;
  const message = candidate?.message || (error instanceof Error ? error.message : '');
  return /bad gateway|gateway timeout|network connection lost|fetch failed|ECONNRESET|ETIMEDOUT/i.test(message);
}

export function startAnalysisWorker(client: SupabaseClient, env: NodeJS.ProcessEnv = process.env): () => void {
  const configuredLimit = Number.parseInt(env.AI_DAILY_COMPANIES_PER_USER || '200', 10);
  const dailyLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 200;
  const analyzer = createCompanyAnalyzer(env);
  let busy = false;
  let retryAfterError = 0;
  let transientFailureCount = 0;
  let nextRetentionSweep = 0;
  let nextHoneybadgerCheckin = 0;

  const tick = async () => {
    if (Date.now() >= nextRetentionSweep) {
      nextRetentionSweep = Date.now() + 60 * 60_000;
      void clearExpiredContacts(client, env).catch(error => {
        captureServerFailure(error, { component: 'contact_retention' });
        nextRetentionSweep = Date.now() + 5 * 60_000;
      });
    }
    if (busy || Date.now() < retryAfterError) return;
    busy = true;
    let claimed: AnalysisJobRecord | undefined;
    try {
      const { data, error } = await client.rpc('claim_next_analysis_job');
      if (error) throw error;
      transientFailureCount = 0;
      if (env.HONEYBADGER_CHECKIN_URL && Date.now() >= nextHoneybadgerCheckin) {
        nextHoneybadgerCheckin = Date.now() + 60_000;
        void fetch(env.HONEYBADGER_CHECKIN_URL, { signal: AbortSignal.timeout(5000) }).catch(() => undefined);
      }
      claimed = Array.isArray(data) ? data[0] as AnalysisJobRecord | undefined : undefined;
      if (!claimed) return;

      if (!(await canAnalyzeCompany(client, claimed.owner_user_id, claimed.dataset_id))) {
        const { error: limitError } = await client.from('analysis_jobs').update({
          status: 'paused', last_error: 'PLAN_LIMIT: Your plan has reached its AI company limit. Upgrade to continue.',
          worker_locked_at: null,
        }).eq('id', claimed.id).eq('owner_user_id', claimed.owner_user_id);
        if (limitError) throw limitError;
        return;
      }

      const { data: seller, error: sellerError } = await client.from('seller_profiles')
        .select('company_name, product_description, main_customer_problem, onboarding_data')
        .eq('owner_user_id', claimed.owner_user_id).maybeSingle();
      if (sellerError) throw sellerError;
      const sellerContext = seller ? {
        companyName: seller.company_name,
        productName: seller.onboarding_data?.productName || '',
        productDescription: seller.product_description,
        currentCustomerProblem: seller.main_customer_problem,
        coreFeatures: seller.onboarding_data?.coreFeatures || [],
        mainBenefit: seller.onboarding_data?.mainBenefit || '',
      } : {};

      const repository = createSupabaseAnalysisJobRepository(client, true);
      await repository.resetStaleProcessingLeads(claimed.owner_user_id, claimed.dataset_id);
      const result = await processBatch(repository, createSupabaseCompanyAnalysisRepository(client), analyzer,
        claimed.owner_user_id, claimed.id, {
          batchSize: 1,
          sellerContext,
          reserveDailyCompany: async ownerUserId => {
            const { data: reserved, error: budgetError } = await client.rpc('reserve_ai_daily_company', {
              p_owner_user_id: ownerUserId, p_limit: dailyLimit,
            });
            if (budgetError) throw budgetError;
            return reserved === true;
          },
        });
      {
        const allLeads = await repository.getDatasetLeads(claimed.owner_user_id, claimed.dataset_id);
        const byId = new Map(allLeads.map(lead => [lead.id, lead]));
        const { data: scoredRows, error: scoresError } = await client.from('lead_scores')
          .select('lead_id, model_version').eq('owner_user_id', claimed.owner_user_id).eq('dataset_id', claimed.dataset_id);
        if (scoresError) throw scoresError;
        const scoredIds = new Set((scoredRows || []).filter(row => row.model_version === CURRENT_SCORING_MODEL_VERSION).map(row => row.lead_id));
        const pendingScoreIds = allLeads.filter(lead => lead.analysis_status === 'completed' && !scoredIds.has(lead.id)).map(lead => lead.id);
        const { data: analyses, error: analysesError } = pendingScoreIds.length
          ? await client.from('company_analyses').select('lead_id, analysis_json, provider, model_version, analyzed_at, website_extraction_json')
            .eq('owner_user_id', claimed.owner_user_id).in('lead_id', pendingScoreIds).eq('analysis_status', 'completed')
          : { data: [], error: null };
        if (analysesError) throw analysesError;
        const context = { ...DEFAULT_SELLER_CONTEXT, ...(seller?.onboarding_data || {}) };
        const offering = contextToOfferingProfile(context);
        const strategic = createSupabaseStrategicAnalysisRepository(client);
        const scores = [];
        const analysisByLead = new Map((analyses || []).map(row => [row.lead_id, row]));
        for (const leadId of pendingScoreIds) {
          const lead = byId.get(leadId);
          if (!lead) continue;
          const row = analysisByLead.get(leadId);
          const parsed = companyIntelligenceSchema.safeParse(row?.analysis_json);
          const envelope: CompanyAnalysisEnvelope | null = row && parsed.success ? {
            analysis: parsed.data, provider: row.provider || 'unknown', modelVersion: row.model_version || 'unknown',
            analyzedAt: row.analyzed_at || new Date().toISOString(), cached: true, sourceMode: 'uploaded_only',
            websiteEvidence: row.website_extraction_json || undefined,
            userCorrectedDescription: lead.user_corrected_description || '',
          } : null;
          const sellerProfile = {
            companyName: seller?.company_name || '', productName: context.productName,
            productDescription: seller?.product_description || context.productDescription,
            primaryProblemSolved: seller?.main_customer_problem || context.currentCustomerProblem,
            mainCustomerProblem: seller?.main_customer_problem || context.currentCustomerProblem,
            keyCapabilities: context.coreFeatures,
          };
          const gap = analyzeLeadNeedGap(sellerProfile, lead, envelope);
          await strategic.saveLeadNeedGap(claimed.owner_user_id, lead.id, gap);
          const normalized: NormalizedLead = {
            id: lead.id, companyName: lead.company_name, domain: lead.normalized_domain || null,
            website: lead.website || null, industry: lead.industry_raw || '', headcount: lead.employee_count ?? null,
            annualRevenue: null, description: lead.notes || '', country: lead.geography || '',
            technologies: [], isClean: true, ingestedAt: new Date().toISOString(),
          };
          scores.push(calculateDeterministicICPScore(normalized, offering, toScoringNeedGap(gap), undefined, {
            companyIntelligence: envelope, sellerContext: context, requireNeedGap: true,
          }));
        }
        await createSupabaseScoringRepository(client).saveLeadScores(claimed.owner_user_id, claimed.dataset_id, scores);
      }
      if (result.job.status === 'completed' || result.job.status === 'completed_with_errors') {
        const { data: doneRows, error: doneError } = await client.from('analysis_jobs').update({ status: 'done' })
          .eq('id', claimed.id).eq('owner_user_id', claimed.owner_user_id)
          .in('status', ['completed', 'completed_with_errors']).select('id');
        if (doneError) throw doneError;
        if (doneRows?.length) {
          trackServerEvent('analysis_completed');
          try {
            await sendAnalysisFinishedEmail(client, claimed, env);
          } catch (emailError) {
            captureServerFailure(emailError, { component: 'analysis_email', job_id: claimed.id });
            console.error('[Analysis worker] Completion email failed:', emailError instanceof Error ? emailError.message : 'Unknown error');
          }
        }
      }
    } catch (error) {
      if (!claimed && isTransientWorkerError(error)) {
        transientFailureCount += 1;
        if (transientFailureCount === 3 || transientFailureCount % 10 === 0) {
          captureServerFailure(error, { component: 'analysis_worker', job_id: 'unclaimed' });
        }
        console.warn('[Analysis worker] Queue temporarily unavailable; retrying.');
        retryAfterError = Date.now() + Math.min(5 * 60_000, 30_000 * 2 ** Math.min(transientFailureCount - 1, 4)) + Math.floor(Math.random() * 5000);
      } else {
        transientFailureCount = 0;
        captureServerFailure(error, { component: 'analysis_worker', job_id: claimed?.id || 'unclaimed' });
        console.error('[Analysis worker] Batch failed:', error instanceof Error ? error.message : error);
        retryAfterError = Date.now() + 30_000;
      }
    } finally {
      if (claimed) {
        try {
          const { error } = await client.from('analysis_jobs').update({ worker_locked_at: null })
            .eq('id', claimed.id).eq('worker_locked_at', claimed.worker_locked_at);
          if (error) throw error;
        } catch { /* The lease will expire and another worker can reclaim the job. */ }
      }
      busy = false;
    }
  };

  const timer = setInterval(() => { void tick(); }, 2000);
  void tick();
  return () => clearInterval(timer);
}
