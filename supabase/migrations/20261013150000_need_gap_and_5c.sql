-- ==============================================================================
-- MIGRATION: 20261013150000_need_gap_and_5c.sql
-- DESCRIPTION: Need Gap Analysis & 5C Stakeholder Strategic Marketing Pipeline
-- MILESTONE: Prompt 10
-- ==============================================================================

-- 1. Add need_gap_json column to company_analyses for per-company caching
ALTER TABLE public.company_analyses
ADD COLUMN IF NOT EXISTS need_gap_json JSONB;

-- 2. Create dataset_strategic_analyses table for cohort-level synthesis
CREATE TABLE IF NOT EXISTS public.dataset_strategic_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  seller_offering_id TEXT,
  need_gap_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  five_c_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_analyses_count INTEGER NOT NULL DEFAULT 0 CHECK (lead_analyses_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_strategic_analyses UNIQUE (owner_user_id, dataset_id)
);

-- 3. Triggers for updated_at
DROP TRIGGER IF EXISTS set_dataset_strategic_analyses_updated_at ON public.dataset_strategic_analyses;
CREATE TRIGGER set_dataset_strategic_analyses_updated_at
BEFORE UPDATE ON public.dataset_strategic_analyses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_dataset_strategic_analyses_owner
ON public.dataset_strategic_analyses(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_dataset_strategic_analyses_dataset
ON public.dataset_strategic_analyses(dataset_id);

-- 5. Row Level Security & Ownership Invariants
ALTER TABLE public.dataset_strategic_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_strategic_analyses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dataset_strategic_analyses_owner_policy ON public.dataset_strategic_analyses;
CREATE POLICY dataset_strategic_analyses_owner_policy
ON public.dataset_strategic_analyses
FOR ALL
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_strategic_analyses TO authenticated;
