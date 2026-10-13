-- ==============================================================================
-- MIGRATION: Production-conscious lead upload metadata and normalized fields
-- Additive only: no existing table, column, or data is removed.
-- ==============================================================================

ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS original_file_size_bytes INTEGER
    CHECK (original_file_size_bytes IS NULL OR original_file_size_bytes BETWEEN 1 AND 5242880),
  ADD COLUMN IF NOT EXISTS invalid_row_count INTEGER NOT NULL DEFAULT 0
    CHECK (invalid_row_count >= 0),
  ADD COLUMN IF NOT EXISTS duplicate_row_count INTEGER NOT NULL DEFAULT 0
    CHECK (duplicate_row_count >= 0),
  ADD COLUMN IF NOT EXISTS column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parse_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS employee_count INTEGER
    CHECK (employee_count IS NULL OR employee_count >= 0),
  ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(18, 2)
    CHECK (annual_revenue IS NULL OR annual_revenue >= 0),
  ADD COLUMN IF NOT EXISTS company_type_raw TEXT,
  ADD COLUMN IF NOT EXISTS customer_pain TEXT,
  ADD COLUMN IF NOT EXISTS reason_won_lost TEXT,
  ADD COLUMN IF NOT EXISTS analysis_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_leads_dataset_analysis_eligible
  ON public.leads(dataset_id, analysis_eligible);

-- Explicit grants keep these existing RLS-protected tables reachable through
-- the Data API even when automatic table exposure is disabled.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_jobs TO authenticated;
