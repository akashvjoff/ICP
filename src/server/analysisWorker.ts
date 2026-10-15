import type { SupabaseClient } from '@supabase/supabase-js';
import { createCompanyAnalyzer } from './companyAnalyzer';
import { createSupabaseCompanyAnalysisRepository } from './companyIntelligenceService';
import { createSupabaseAnalysisJobRepository, processBatch, type AnalysisJobRecord } from './analysisJobService';

export function startAnalysisWorker(client: SupabaseClient, env: NodeJS.ProcessEnv = process.env): () => void {
  const configuredLimit = Number.parseInt(env.AI_DAILY_COMPANIES_PER_USER || '200', 10);
  const dailyLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 200;
  const analyzer = createCompanyAnalyzer(env);
  let busy = false;
  let retryAfterError = 0;

  const tick = async () => {
    if (busy || Date.now() < retryAfterError) return;
    busy = true;
    let claimed: AnalysisJobRecord | undefined;
    try {
      const { data, error } = await client.rpc('claim_next_analysis_job');
      if (error) throw error;
      claimed = Array.isArray(data) ? data[0] as AnalysisJobRecord | undefined : undefined;
      if (!claimed) return;

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
      if (result.job.status === 'completed' || result.job.status === 'completed_with_errors') {
        const { error: doneError } = await client.from('analysis_jobs').update({ status: 'done' })
          .eq('id', claimed.id).eq('owner_user_id', claimed.owner_user_id)
          .in('status', ['completed', 'completed_with_errors']);
        if (doneError) throw doneError;
      }
    } catch (error) {
      console.error('[Analysis worker] Batch failed:', error instanceof Error ? error.message : error);
      retryAfterError = Date.now() + 30_000;
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
