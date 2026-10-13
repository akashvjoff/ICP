-- ============================================================================
-- Migration: 20261013180000_executive_report_7ps.sql
-- Description: Additive migration for Executive ICP Report and 7Ps Marketing Mix
-- Stage: Prompt 13
-- ============================================================================

-- Ensure icp_reports has updated_at and version metadata
ALTER TABLE public.icp_reports
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS version_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS seller_offering_id TEXT;

-- Index for fast lookup by owner and dataset
CREATE INDEX IF NOT EXISTS idx_icp_reports_owner_dataset ON public.icp_reports(owner_user_id, dataset_id);

-- Add unique constraint for idempotent report upsert per user and dataset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_icp_reports_owner_dataset'
  ) THEN
    ALTER TABLE public.icp_reports
    ADD CONSTRAINT uq_icp_reports_owner_dataset UNIQUE (owner_user_id, dataset_id);
  END IF;
END $$;

-- Trigger to automatically touch updated_at
DROP TRIGGER IF EXISTS set_icp_reports_updated_at ON public.icp_reports;
CREATE TRIGGER set_icp_reports_updated_at
BEFORE UPDATE ON public.icp_reports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
