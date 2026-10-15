-- Durable server-side analysis queue and per-user daily AI budget.
alter table public.analysis_jobs
  add column if not exists next_retry_at timestamptz,
  add column if not exists worker_locked_at timestamptz,
  add column if not exists quota_retry_count integer not null default 0;

alter table public.analysis_jobs drop constraint if exists analysis_jobs_status_check;
alter table public.analysis_jobs add constraint analysis_jobs_status_check
  check (status in ('pending', 'queued', 'running', 'processing', 'waiting_for_quota', 'paused', 'done', 'completed', 'completed_with_errors', 'failed', 'cancelled'));
revoke insert, update on public.analysis_jobs from authenticated;

create index if not exists analysis_jobs_worker_queue_idx
  on public.analysis_jobs (status, next_retry_at, worker_locked_at, updated_at);

-- Recover jobs paused by the old browser loop after a rate-limit response.
with resumed as (
  update public.analysis_jobs
    set status = 'waiting_for_quota', next_retry_at = now(), failed_count = 0,
        last_error = 'AI quota reached. Analysis will resume automatically.'
    where status = 'paused' and last_error ~* 'rate limit|quota'
    returning dataset_id
)
update public.leads set analysis_status = 'pending'
  where dataset_id in (select dataset_id from resumed) and analysis_eligible = true and analysis_status = 'failed';

-- Every Node instance can compete for work; the row lock makes each claim atomic.
create or replace function public.claim_next_analysis_job()
returns setof public.analysis_jobs
language plpgsql security invoker set search_path = public as $$
declare claimed public.analysis_jobs%rowtype;
begin
  select * into claimed from public.analysis_jobs
  where status = 'queued'
     or (status = 'running' and (worker_locked_at is null or worker_locked_at < now() - interval '10 minutes'))
     or (status = 'waiting_for_quota' and next_retry_at <= now())
  order by created_at
  for update skip locked limit 1;
  if not found then return; end if;
  update public.analysis_jobs set status = 'running', worker_locked_at = now(), updated_at = now()
    where id = claimed.id returning * into claimed;
  return next claimed;
end;
$$;
revoke all on function public.claim_next_analysis_job() from public, anon, authenticated;
grant execute on function public.claim_next_analysis_job() to service_role;

-- Service-role worker claim, with a verified owner from the claimed job.
create or replace function public.claim_next_analysis_batch_service(
  p_owner_user_id uuid, p_dataset_id uuid, p_batch_size integer default 1
)
returns table (
  id uuid, company_name text, normalized_domain text, website text, industry_raw text,
  employee_count integer, company_size_raw text, geography text, company_type_raw text,
  business_model_raw text, product_raw text, notes text, user_corrected_description text,
  analysis_eligible boolean, analysis_status text
)
language sql security invoker set search_path = public as $$
  with candidates as (
    select l.id from public.leads l
    where l.owner_user_id = p_owner_user_id and l.dataset_id = p_dataset_id
      and l.analysis_eligible = true and l.analysis_status = 'pending'
    order by l.created_at
    for update skip locked limit least(greatest(p_batch_size, 1), 5)
  )
  update public.leads l set analysis_status = 'processing'
  from candidates c where l.id = c.id
  returning l.id, l.company_name, l.normalized_domain, l.website, l.industry_raw,
    l.employee_count, l.company_size_raw, l.geography, l.company_type_raw,
    l.business_model_raw, l.product_raw, l.notes, l.user_corrected_description,
    l.analysis_eligible, l.analysis_status;
$$;
revoke all on function public.claim_next_analysis_batch_service(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_next_analysis_batch_service(uuid, uuid, integer) to service_role;

create table if not exists public.ai_daily_usage (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  company_count integer not null default 0 check (company_count >= 0),
  primary key (owner_user_id, usage_date)
);
alter table public.ai_daily_usage enable row level security;
revoke all on public.ai_daily_usage from public, anon, authenticated;
grant all on public.ai_daily_usage to service_role;

create or replace function public.reserve_ai_daily_company(p_owner_user_id uuid, p_limit integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare reserved_count integer;
begin
  if p_limit < 1 then return false; end if;
  insert into public.ai_daily_usage (owner_user_id, usage_date, company_count)
    values (p_owner_user_id, (now() at time zone 'UTC')::date, 1)
  on conflict (owner_user_id, usage_date) do update
    set company_count = ai_daily_usage.company_count + 1
    where ai_daily_usage.company_count < p_limit
  returning company_count into reserved_count;
  return reserved_count is not null;
end;
$$;
revoke all on function public.reserve_ai_daily_company(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_daily_company(uuid, integer) to service_role;
