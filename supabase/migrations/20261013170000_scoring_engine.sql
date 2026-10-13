-- ==============================================================================
-- Migration: 20261013170000_scoring_engine.sql
-- Description: Additive schema updates for Prompt 12 ICP Fit Scoring Engine
-- ==============================================================================

-- 1. Ensure dataset_id column exists on public.lead_scores
ALTER TABLE public.lead_scores
ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE;

-- 2. Relax fit_tier check constraint on public.lead_scores to accommodate full ICPTier values
DO $$
BEGIN
  ALTER TABLE public.lead_scores DROP CONSTRAINT IF EXISTS lead_scores_fit_tier_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 3. Additive audit and governance columns
ALTER TABLE public.lead_scores
ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'v1.2-deterministic',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_lead_scores_updated_at'
  ) THEN
    CREATE TRIGGER set_lead_scores_updated_at
    BEFORE UPDATE ON public.lead_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_lead_scores_dataset ON public.lead_scores(dataset_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_owner_dataset ON public.lead_scores(owner_user_id, dataset_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_disqualified ON public.lead_scores(is_disqualified);
