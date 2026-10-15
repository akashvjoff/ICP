ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS employee_count_min integer CHECK (employee_count_min IS NULL OR employee_count_min >= 0),
  ADD COLUMN IF NOT EXISTS employee_count_max integer CHECK (employee_count_max IS NULL OR employee_count_max >= employee_count_min);

CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  seniority text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  email_status text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  lead_stage text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_dataset ON public.lead_contacts(owner_user_id, dataset_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON public.lead_contacts(lead_id);
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners insert contacts" ON public.lead_contacts FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.dataset_id = lead_contacts.dataset_id AND l.owner_user_id = (SELECT auth.uid()))
  );
GRANT INSERT ON public.lead_contacts TO authenticated;
