-- ==============================================================================
-- MIGRATION: 20261013160000_stp_engine.sql
-- DESCRIPTION: Segmentation, Targeting & Positioning (STP) Engine
-- MILESTONE: Prompt 11
-- ==============================================================================

-- 1. Create dataset_stp_analyses table for cohort-level STP persistence
CREATE TABLE IF NOT EXISTS public.dataset_stp_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  seller_offering_id TEXT,
  stp_analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  segments_count INTEGER NOT NULL DEFAULT 0 CHECK (segments_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_stp_analyses UNIQUE (owner_user_id, dataset_id)
);

-- 2. Triggers for updated_at
DROP TRIGGER IF EXISTS set_dataset_stp_analyses_updated_at ON public.dataset_stp_analyses;
CREATE TRIGGER set_dataset_stp_analyses_updated_at
BEFORE UPDATE ON public.dataset_stp_analyses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_dataset_stp_analyses_owner
ON public.dataset_stp_analyses(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_dataset_stp_analyses_dataset
ON public.dataset_stp_analyses(dataset_id);

-- 4. Row Level Security & Ownership Invariants
ALTER TABLE public.dataset_stp_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_stp_analyses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dataset_stp_analyses_owner_policy ON public.dataset_stp_analyses;
CREATE POLICY dataset_stp_analyses_owner_policy
ON public.dataset_stp_analyses
FOR ALL
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_stp_analyses TO authenticated;
