-- The analysis tables were created after the initial service_role grant.
-- Projects with explicit Data API grants require these privileges for
-- server-side reads and writes. RLS remains enabled on both tables.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.dataset_strategic_analyses,
           public.dataset_stp_analyses
  TO service_role;
