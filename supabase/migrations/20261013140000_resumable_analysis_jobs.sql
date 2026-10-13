-- Migration: 20261013140000_resumable_analysis_jobs.sql
-- Stage: MVP 1 (Prompt 9: Resumable Batch Analysis Job Processing)

-- 1. Extend analysis_jobs status domain and add skipped_count
ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0);

-- Drop existing check constraint on analysis_jobs.status and add extended status constraint
DO $$
BEGIN
  ALTER TABLE public.analysis_jobs DROP CONSTRAINT IF EXISTS analysis_jobs_status_check;
  ALTER TABLE public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_status_check
    CHECK (status IN ('pending', 'queued', 'running', 'processing', 'paused', 'completed', 'completed_with_errors', 'failed', 'cancelled'));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 2. Add analysis_status to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_leads_dataset_analysis_status
  ON public.leads(dataset_id, analysis_status);

-- 3. Atomic claim function for batch analysis
CREATE OR REPLACE FUNCTION public.claim_next_analysis_batch(
  p_dataset_id UUID,
  p_batch_size INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  company_name TEXT,
  normalized_domain TEXT,
  website TEXT,
  industry_raw TEXT,
  employee_count INTEGER,
  company_size_raw TEXT,
  geography TEXT,
  company_type_raw TEXT,
  business_model_raw TEXT,
  product_raw TEXT,
  notes TEXT,
  user_corrected_description TEXT,
  analysis_eligible BOOLEAN,
  analysis_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 3), 1), 5);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT l.id
    FROM public.leads l
    WHERE l.dataset_id = p_dataset_id
      AND l.owner_user_id = v_user_id
      AND l.analysis_eligible = true
      AND l.analysis_status = 'pending'
    ORDER BY l.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.leads l
  SET analysis_status = 'processing'
  FROM candidates c
  WHERE l.id = c.id
  RETURNING
    l.id,
    l.company_name,
    l.normalized_domain,
    l.website,
    l.industry_raw,
    l.employee_count,
    l.company_size_raw,
    l.geography,
    l.company_type_raw,
    l.business_model_raw,
    l.product_raw,
    l.notes,
    l.user_corrected_description,
    l.analysis_eligible,
    l.analysis_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_next_analysis_batch(UUID, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_next_analysis_batch(UUID, INTEGER) TO authenticated;
