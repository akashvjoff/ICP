-- Additive structured company-intelligence storage and duplicate-content cache.
ALTER TABLE public.company_analyses
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS input_hash TEXT
    CHECK (input_hash IS NULL OR input_hash ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS analysis_json JSONB,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.company_analyses
  ALTER COLUMN model_version DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_company_analyses_owner_input_hash
  ON public.company_analyses(owner_user_id, input_hash)
  WHERE input_hash IS NOT NULL AND analysis_status = 'completed';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_analyses TO authenticated;
