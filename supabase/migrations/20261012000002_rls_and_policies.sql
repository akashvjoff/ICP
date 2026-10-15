-- ==============================================================================
-- MIGRATION: 20261012000002_rls_and_policies.sql
-- PROJECT: FiguredIt (Stage: MVP 1)
-- DESCRIPTION: Row Level Security (RLS), Cross-Dataset Validation & Access Grants
-- TABLES PROTECTED:
--   1. seller_profiles
--   2. datasets
--   3. leads
--   4. company_analyses
--   5. analysis_jobs
--   6. segments
--   7. scoring_configs
--   8. lead_scores
--   9. icp_reports
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_reports ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (prevents bypass)
ALTER TABLE public.seller_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.datasets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.segments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.icp_reports FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. REVOKE ALL ANONYMOUS/PUBLIC ACCESS (NO PUBLIC READ/WRITE)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.seller_profiles FROM anon, public;
REVOKE ALL ON public.datasets FROM anon, public;
REVOKE ALL ON public.leads FROM anon, public;
REVOKE ALL ON public.company_analyses FROM anon, public;
REVOKE ALL ON public.analysis_jobs FROM anon, public;
REVOKE ALL ON public.segments FROM anon, public;
REVOKE ALL ON public.scoring_configs FROM anon, public;
REVOKE ALL ON public.lead_scores FROM anon, public;
REVOKE ALL ON public.icp_reports FROM anon, public;

-- Grant strictly to authenticated users and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icp_reports TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 3. POLICIES: seller_profiles
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own seller profile"
  ON public.seller_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own seller profile"
  ON public.seller_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own seller profile"
  ON public.seller_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own seller profile"
  ON public.seller_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- ------------------------------------------------------------------------------
-- 4. POLICIES: datasets
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own datasets"
  ON public.datasets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own datasets"
  ON public.datasets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own datasets"
  ON public.datasets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own datasets"
  ON public.datasets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- ------------------------------------------------------------------------------
-- 5. POLICIES: leads
-- Note: Cross-validates dataset ownership so leads cannot be injected into
-- another user's dataset.
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = leads.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = leads.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = leads.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = leads.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = leads.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 6. POLICIES: company_analyses
-- Cross-validates lead ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their company analyses"
  ON public.company_analyses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = company_analyses.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company analyses"
  ON public.company_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = company_analyses.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update company analyses"
  ON public.company_analyses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = company_analyses.lead_id
        AND l.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = company_analyses.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete company analyses"
  ON public.company_analyses
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = company_analyses.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 7. POLICIES: analysis_jobs
-- Cross-validates dataset ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their analysis jobs"
  ON public.analysis_jobs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = analysis_jobs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create analysis jobs"
  ON public.analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = analysis_jobs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analysis jobs"
  ON public.analysis_jobs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = analysis_jobs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = analysis_jobs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete analysis jobs"
  ON public.analysis_jobs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = analysis_jobs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 8. POLICIES: segments
-- Cross-validates dataset ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their segments"
  ON public.segments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = segments.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert segments"
  ON public.segments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = segments.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update segments"
  ON public.segments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = segments.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = segments.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete segments"
  ON public.segments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = segments.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 9. POLICIES: scoring_configs
-- Cross-validates dataset ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their scoring configs"
  ON public.scoring_configs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = scoring_configs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scoring configs"
  ON public.scoring_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = scoring_configs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scoring configs"
  ON public.scoring_configs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = scoring_configs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = scoring_configs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scoring configs"
  ON public.scoring_configs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = scoring_configs.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 10. POLICIES: lead_scores
-- Cross-validates lead ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their lead scores"
  ON public.lead_scores
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_scores.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lead scores"
  ON public.lead_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_scores.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lead scores"
  ON public.lead_scores
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_scores.lead_id
        AND l.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_scores.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lead scores"
  ON public.lead_scores
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_scores.lead_id
        AND l.owner_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 11. POLICIES: icp_reports
-- Cross-validates dataset ownership
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their icp reports"
  ON public.icp_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = icp_reports.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert icp reports"
  ON public.icp_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = icp_reports.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update icp reports"
  ON public.icp_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = icp_reports.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = icp_reports.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete icp reports"
  ON public.icp_reports
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = icp_reports.dataset_id
        AND d.owner_user_id = auth.uid()
    )
  );
