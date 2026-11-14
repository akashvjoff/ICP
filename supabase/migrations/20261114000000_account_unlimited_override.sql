-- Owner/staff accounts that bypass plan limits without a fake billing subscription.
-- Rows are managed only with the service-role key; browsers cannot read or write them.
create table public.account_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlimited boolean not null default true,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.account_overrides enable row level security;
revoke all on public.account_overrides from anon, authenticated;
grant all on public.account_overrides to service_role;

-- Triggers run as the inserting role, so this definer helper answers only for the caller's own
-- account (or for the service role, which has no auth.uid()).
create function public.has_unlimited_access(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() = p_user_id)
    and exists (select 1 from public.account_overrides o where o.user_id = p_user_id and o.unlimited);
$$;
revoke all on function public.has_unlimited_access(uuid) from public, anon;
grant execute on function public.has_unlimited_access(uuid) to authenticated, service_role;

create or replace function public.enforce_free_dataset_limit()
returns trigger language plpgsql security invoker as $$
declare active_plan text := 'free'; max_rows int := 25; max_datasets int := 1; used int;
begin
  if public.has_unlimited_access(new.owner_user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.owner_user_id::text, 0));
  select s.plan into active_plan from public.subscriptions s where s.user_id = new.owner_user_id
    and ((s.status in ('active','cancelled') and s.current_period_end > now())
      or (s.status = 'on_hold' and s.status_changed_at > now() - interval '3 days'))
    order by s.created_at desc limit 1;
  active_plan := coalesce(active_plan,'free');
  max_rows := case active_plan when 'pro' then 500 when 'starter' then 100 else 25 end;
  max_datasets := case active_plan when 'pro' then null when 'starter' then 3 else 1 end;
  if new.row_count > max_rows then raise exception 'PLAN_LIMIT: row limit reached'; end if;
  if active_plan = 'free' and lower(right(new.original_filename, 4)) <> '.csv' then raise exception 'PLAN_LIMIT: Free accepts CSV only'; end if;
  if max_datasets is not null then
    select count(*) into used from public.datasets where owner_user_id = new.owner_user_id
      and (active_plan = 'free' or created_at >= date_trunc('month', now()));
    if used >= max_datasets then raise exception 'PLAN_LIMIT: dataset limit reached'; end if;
  end if;
  return new;
end $$;

create or replace function public.enforce_free_lead_limit()
returns trigger language plpgsql security invoker as $$
declare max_rows int := 25; active_plan text;
begin
  if public.has_unlimited_access(new.owner_user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.dataset_id::text, 1));
  select s.plan into active_plan from public.subscriptions s where s.user_id = new.owner_user_id
    and ((s.status in ('active','cancelled') and s.current_period_end > now())
      or (s.status = 'on_hold' and s.status_changed_at > now() - interval '3 days'))
    order by s.created_at desc limit 1;
  max_rows := case active_plan when 'pro' then 500 when 'starter' then 100 else 25 end;
  if (select count(*) from public.leads where dataset_id = new.dataset_id) >= max_rows then
    raise exception 'PLAN_LIMIT: company limit reached';
  end if;
  return new;
end $$;

create or replace function public.enforce_contact_row_limit() returns trigger language plpgsql security invoker as $$
declare active_plan text; max_rows int;
begin
  if public.has_unlimited_access(new.owner_user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.dataset_id::text, 2));
  select s.plan into active_plan from public.subscriptions s where s.user_id = new.owner_user_id
    and ((s.status in ('active','cancelled') and s.current_period_end > now())
      or (s.status = 'on_hold' and s.status_changed_at > now() - interval '3 days'))
    order by s.created_at desc limit 1;
  max_rows := case active_plan when 'pro' then 500 when 'starter' then 100 else 25 end;
  if (select count(*) from public.lead_contacts where dataset_id = new.dataset_id) >= max_rows then
    raise exception 'PLAN_LIMIT: contact row limit reached';
  end if;
  return new;
end $$;

create or replace function public.enforce_ai_company_limit() returns trigger language plpgsql security invoker as $$
declare active_plan text; max_companies int; dataset uuid; used int;
begin
  if new.analysis_status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.analysis_status = 'completed' then return new; end if;
  end if;
  if public.has_unlimited_access(new.owner_user_id) then return new; end if;
  select l.dataset_id into dataset from public.leads l where l.id = new.lead_id and l.owner_user_id = new.owner_user_id;
  if dataset is null then raise exception 'Company lead not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(dataset::text, 3));
  select s.plan into active_plan from public.subscriptions s where s.user_id = new.owner_user_id
    and ((s.status in ('active','cancelled') and s.current_period_end > now())
      or (s.status = 'on_hold' and s.status_changed_at > now() - interval '3 days'))
    order by s.created_at desc limit 1;
  max_companies := case active_plan when 'pro' then 500 when 'starter' then 100 else 25 end;
  select count(*) into used from public.company_analyses a join public.leads l on l.id = a.lead_id
    where l.dataset_id = dataset and a.analysis_status = 'completed';
  if used >= max_companies then raise exception 'PLAN_LIMIT: AI company limit reached'; end if;
  return new;
end $$;

-- Unlimited accounts still record daily usage but are never capped.
create or replace function public.reserve_ai_daily_company(p_owner_user_id uuid, p_limit integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare reserved_count integer; unlimited boolean := public.has_unlimited_access(p_owner_user_id);
begin
  if p_limit < 1 and not unlimited then return false; end if;
  insert into public.ai_daily_usage (owner_user_id, usage_date, company_count)
    values (p_owner_user_id, (now() at time zone 'UTC')::date, 1)
  on conflict (owner_user_id, usage_date) do update
    set company_count = ai_daily_usage.company_count + 1
    where unlimited or ai_daily_usage.company_count < p_limit
  returning company_count into reserved_count;
  return reserved_count is not null;
end;
$$;
revoke all on function public.reserve_ai_daily_company(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_daily_company(uuid, integer) to service_role;
