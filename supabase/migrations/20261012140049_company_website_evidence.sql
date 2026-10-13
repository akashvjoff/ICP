-- Store bounded public website evidence and keep user corrections separate.
ALTER TABLE public.company_analyses
  ADD COLUMN IF NOT EXISTS website_source_url TEXT,
  ADD COLUMN IF NOT EXISTS website_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website_extraction_json JSONB,
  ADD COLUMN IF NOT EXISTS user_corrected_description TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS user_corrected_description TEXT;
