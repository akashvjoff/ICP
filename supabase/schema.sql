-- ==============================================================================
-- CONSOLIDATED SQL SCHEMA FOR SUPABASE SQL EDITOR
-- PROJECT: icp.mode (Stage: MVP 1)
-- INCLUDES: Schema, Foreign Keys, Triggers, Indexes, RLS Policies, Grants
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. SELLER PROFILES
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  product_description TEXT,
  target_market TEXT,
  offering_type TEXT,
  geography TEXT,
  price_range TEXT,
  primary_buyer TEXT,
  main_customer_problem TEXT,
  onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_seller_profiles_owner UNIQUE (owner_user_id)
);

CREATE TRIGGER set_seller_profiles_updated_at
BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. DATASETS
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  normalized_domain TEXT,
  website TEXT,
  industry_raw TEXT,
  company_size_raw TEXT,
  business_model_raw TEXT,
  product_raw TEXT,
  geography TEXT,
  lead_status TEXT NOT NULL DEFAULT 'new' CHECK (lead_status IN ('new', 'qualified', 'disqualified', 'contacted', 'opportunity', 'won', 'lost')),
  deal_value NUMERIC(14, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  retention_months INTEGER CHECK (retention_months IS NULL OR retention_months >= 0),
  notes TEXT,
  raw_row JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COMPANY ANALYSES
CREATE TABLE IF NOT EXISTS public.company_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  industry TEXT,
  company_type TEXT,
  business_model TEXT,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_customers JSONB NOT NULL DEFAULT '[]'::jsonb,
  possible_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_summary TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  attribute_confidence NUMERIC(4, 3) CHECK (attribute_confidence IS NULL OR (attribute_confidence >= 0 AND attribute_confidence <= 1)),
  analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'completed', 'failed')),
  model_version TEXT DEFAULT 'gemini-3.8-flash',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_company_analyses_lead UNIQUE (lead_id)
);

-- 5. ANALYSIS JOBS
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_analysis_jobs_updated_at
BEFORE UPDATE ON public.analysis_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. SEGMENTS
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  shared_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  selection_basis TEXT,
  company_count INTEGER NOT NULL DEFAULT 0 CHECK (company_count >= 0),
  evidence_level TEXT NOT NULL DEFAULT 'moderate' CHECK (evidence_level IN ('high', 'moderate', 'low', 'exploratory')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SCORING CONFIGS
CREATE TABLE IF NOT EXISTS public.scoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  weight_config JSONB NOT NULL DEFAULT '{"needUrgency": 0.35, "capabilityMatch": 0.25, "stakeholderFeasibility": 0.20, "firmographicAlignment": 0.20}'::jsonb,
  threshold_config JSONB NOT NULL DEFAULT '{"tier1": 80, "tier2": 60, "disqualified": 40}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scoring_configs_dataset UNIQUE (owner_user_id, dataset_id)
);

CREATE TRIGGER set_scoring_configs_updated_at
BEFORE UPDATE ON public.scoring_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. LEAD SCORES
CREATE TABLE IF NOT EXISTS public.lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  fit_score NUMERIC(5, 2) NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
  coverage_score NUMERIC(5, 2) NOT NULL DEFAULT 100 CHECK (coverage_score >= 0 AND coverage_score <= 100),
  intent_score_nullable NUMERIC(5, 2) CHECK (intent_score_nullable IS NULL OR (intent_score_nullable >= 0 AND intent_score_nullable <= 100)),
  fit_tier TEXT NOT NULL CHECK (fit_tier IN ('Tier 1 - Strong Fit', 'Tier 2 - Moderate Fit', 'Disqualified')),
  scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lead_scores_lead UNIQUE (lead_id)
);

-- 9. ICP REPORTS
CREATE TABLE IF NOT EXISTS public.icp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  report_json JSONB NOT NULL,
  evidence_level TEXT NOT NULL DEFAULT 'high' CHECK (evidence_level IN ('high', 'moderate', 'low', 'exploratory')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_seller_profiles_owner ON public.seller_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_owner ON public.datasets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON public.datasets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_dataset ON public.leads(dataset_id);
CREATE INDEX IF NOT EXISTS idx_leads_domain ON public.leads(normalized_domain);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_company_analyses_owner ON public.company_analyses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_company_analyses_lead ON public.company_analyses(lead_id);
CREATE INDEX IF NOT EXISTS idx_company_analyses_status ON public.company_analyses(analysis_status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_owner ON public.analysis_jobs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dataset ON public.analysis_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON public.analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_segments_owner ON public.segments(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_segments_dataset ON public.segments(dataset_id);
CREATE INDEX IF NOT EXISTS idx_scoring_configs_owner ON public.scoring_configs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_scoring_configs_dataset ON public.scoring_configs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_owner ON public.lead_scores(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead ON public.lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_tier ON public.lead_scores(fit_tier);
CREATE INDEX IF NOT EXISTS idx_lead_scores_fit_score ON public.lead_scores(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_icp_reports_owner ON public.icp_reports(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_icp_reports_dataset ON public.icp_reports(dataset_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.seller_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.datasets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.segments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.icp_reports FORCE ROW LEVEL SECURITY;

-- REVOKE ALL PUBLIC / ANONYMOUS ACCESS
REVOKE ALL ON public.seller_profiles FROM anon, public;
REVOKE ALL ON public.datasets FROM anon, public;
REVOKE ALL ON public.leads FROM anon, public;
REVOKE ALL ON public.company_analyses FROM anon, public;
REVOKE ALL ON public.analysis_jobs FROM anon, public;
REVOKE ALL ON public.segments FROM anon, public;
REVOKE ALL ON public.scoring_configs FROM anon, public;
REVOKE ALL ON public.lead_scores FROM anon, public;
REVOKE ALL ON public.icp_reports FROM anon, public;

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

-- POLICIES
-- 1. seller_profiles
CREATE POLICY "seller_profiles_owner_select" ON public.seller_profiles FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "seller_profiles_owner_insert" ON public.seller_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "seller_profiles_owner_update" ON public.seller_profiles FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "seller_profiles_owner_delete" ON public.seller_profiles FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- 2. datasets
CREATE POLICY "datasets_owner_select" ON public.datasets FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "datasets_owner_insert" ON public.datasets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "datasets_owner_update" ON public.datasets FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "datasets_owner_delete" ON public.datasets FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- 3. leads (With cross-dataset validation)
CREATE POLICY "leads_owner_select" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = leads.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "leads_owner_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = leads.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "leads_owner_update" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = leads.dataset_id AND d.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = leads.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "leads_owner_delete" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = leads.dataset_id AND d.owner_user_id = auth.uid()));

-- 4. company_analyses (With cross-lead validation)
CREATE POLICY "analyses_owner_select" ON public.company_analyses FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = company_analyses.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "analyses_owner_insert" ON public.company_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = company_analyses.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "analyses_owner_update" ON public.company_analyses FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = company_analyses.lead_id AND l.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = company_analyses.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "analyses_owner_delete" ON public.company_analyses FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = company_analyses.lead_id AND l.owner_user_id = auth.uid()));

-- 5. analysis_jobs
CREATE POLICY "jobs_owner_select" ON public.analysis_jobs FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = analysis_jobs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "jobs_owner_insert" ON public.analysis_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = analysis_jobs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "jobs_owner_update" ON public.analysis_jobs FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = analysis_jobs.dataset_id AND d.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = analysis_jobs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "jobs_owner_delete" ON public.analysis_jobs FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = analysis_jobs.dataset_id AND d.owner_user_id = auth.uid()));

-- 6. segments
CREATE POLICY "segments_owner_select" ON public.segments FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = segments.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "segments_owner_insert" ON public.segments FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = segments.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "segments_owner_update" ON public.segments FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = segments.dataset_id AND d.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = segments.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "segments_owner_delete" ON public.segments FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = segments.dataset_id AND d.owner_user_id = auth.uid()));

-- 7. scoring_configs
CREATE POLICY "configs_owner_select" ON public.scoring_configs FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = scoring_configs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "configs_owner_insert" ON public.scoring_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = scoring_configs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "configs_owner_update" ON public.scoring_configs FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = scoring_configs.dataset_id AND d.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = scoring_configs.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "configs_owner_delete" ON public.scoring_configs FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = scoring_configs.dataset_id AND d.owner_user_id = auth.uid()));

-- 8. lead_scores
CREATE POLICY "scores_owner_select" ON public.lead_scores FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_scores.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "scores_owner_insert" ON public.lead_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_scores.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "scores_owner_update" ON public.lead_scores FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_scores.lead_id AND l.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_scores.lead_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "scores_owner_delete" ON public.lead_scores FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_scores.lead_id AND l.owner_user_id = auth.uid()));

-- 9. icp_reports
CREATE POLICY "reports_owner_select" ON public.icp_reports FOR SELECT TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = icp_reports.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "reports_owner_insert" ON public.icp_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = icp_reports.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "reports_owner_update" ON public.icp_reports FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = icp_reports.dataset_id AND d.owner_user_id = auth.uid())) WITH CHECK (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = icp_reports.dataset_id AND d.owner_user_id = auth.uid()));
CREATE POLICY "reports_owner_delete" ON public.icp_reports FOR DELETE TO authenticated USING (auth.uid() = owner_user_id AND EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = icp_reports.dataset_id AND d.owner_user_id = auth.uid()));
