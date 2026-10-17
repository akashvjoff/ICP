create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'dodo' check (provider = 'dodo'),
  provider_subscription_id text not null unique,
  provider_customer_id text,
  plan text not null check (plan in ('starter','pro')),
  interval text not null check (interval in ('monthly','annual')),
  status text not null,
  status_changed_at timestamptz not null default now(),
  last_event_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_created on public.subscriptions (user_id, created_at desc);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
create policy "Read own subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table public.billing_events (
  event_id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

create table public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  datasets_count integer not null default 0 check (datasets_count >= 0),
  ai_companies_used integer not null default 0 check (ai_companies_used >= 0),
  primary key (user_id, period_start)
);
alter table public.usage enable row level security;
revoke all on public.usage from anon, authenticated;
grant select on public.usage to authenticated;
grant all on public.usage to service_role;
create policy "Read own usage" on public.usage for select to authenticated using (user_id = auth.uid());

-- Called only with the service-role key. Recording the event and changing access are atomic.
create function public.apply_dodo_billing_event(
  p_event_id text, p_type text, p_payload jsonb, p_user_id uuid,
  p_subscription_id text, p_customer_id text, p_plan text, p_interval text,
  p_status text, p_period_end timestamptz, p_cancel_at_period_end boolean, p_event_at timestamptz
) returns boolean language plpgsql security invoker set search_path = public as $$
begin
  insert into public.billing_events(event_id,type,payload) values (p_event_id,p_type,p_payload)
    on conflict (event_id) do nothing;
  if not found then return false; end if;
  if p_subscription_id is not null and p_status is not null then
    insert into public.subscriptions(user_id,provider_subscription_id,provider_customer_id,plan,interval,status,status_changed_at,current_period_end,cancel_at_period_end,last_event_at)
      values (p_user_id,p_subscription_id,p_customer_id,p_plan,p_interval,p_status,p_event_at,p_period_end,p_cancel_at_period_end,p_event_at)
    on conflict (provider_subscription_id) do update set
      provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id),
      plan = excluded.plan, interval = excluded.interval,
      status_changed_at = case when subscriptions.status is distinct from excluded.status then excluded.status_changed_at else subscriptions.status_changed_at end,
      status = excluded.status,
      current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end = excluded.cancel_at_period_end, last_event_at = excluded.last_event_at, updated_at = now()
    where subscriptions.user_id = excluded.user_id and
      (subscriptions.last_event_at is null or excluded.last_event_at >= subscriptions.last_event_at);
  end if;
  return true;
end $$;
revoke all on function public.apply_dodo_billing_event(text,text,jsonb,uuid,text,text,text,text,text,timestamptz,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_dodo_billing_event(text,text,jsonb,uuid,text,text,text,text,text,timestamptz,boolean,timestamptz) to service_role;

-- Preserve database-level protection against concurrent uploads for both Free and paid plans.
create or replace function public.enforce_free_dataset_limit()
returns trigger language plpgsql security invoker as $$
declare active_plan text := 'free'; max_rows int := 25; max_datasets int := 1; used int;
begin
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

create function public.enforce_contact_row_limit() returns trigger language plpgsql security invoker as $$
declare active_plan text; max_rows int;
begin
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
revoke all on function public.enforce_contact_row_limit() from public, anon, authenticated;
create trigger enforce_contact_row_limit_before_insert before insert on public.lead_contacts
  for each row execute function public.enforce_contact_row_limit();

create function public.enforce_ai_company_limit() returns trigger language plpgsql security invoker as $$
declare active_plan text; max_companies int; dataset uuid; used int;
begin
  if new.analysis_status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.analysis_status = 'completed' then return new; end if;
  end if;
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
revoke all on function public.enforce_ai_company_limit() from public, anon, authenticated;
create trigger enforce_ai_company_limit_before_write before insert or update on public.company_analyses
  for each row execute function public.enforce_ai_company_limit();

create function public.track_dataset_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> new.owner_user_id then raise exception 'Owner mismatch'; end if;
  insert into public.usage(user_id,period_start,datasets_count) values (new.owner_user_id,date_trunc('month',new.created_at)::date,1)
    on conflict (user_id,period_start) do update set datasets_count = usage.datasets_count + 1;
  return new;
end $$;
create trigger track_dataset_usage_after_insert after insert on public.datasets
  for each row execute function public.track_dataset_usage();

create function public.track_ai_usage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> new.owner_user_id then raise exception 'Owner mismatch'; end if;
  if new.analysis_status = 'completed' and tg_op = 'INSERT' then
    insert into public.usage(user_id,period_start,ai_companies_used)
      values (new.owner_user_id,date_trunc('month',coalesce(new.analyzed_at,now()))::date,1)
      on conflict (user_id,period_start) do update set ai_companies_used = usage.ai_companies_used + 1;
  elsif tg_op = 'UPDATE' and new.analysis_status = 'completed' and old.analysis_status is distinct from 'completed' then
    insert into public.usage(user_id,period_start,ai_companies_used)
      values (new.owner_user_id,date_trunc('month',coalesce(new.analyzed_at,now()))::date,1)
      on conflict (user_id,period_start) do update set ai_companies_used = usage.ai_companies_used + 1;
  end if;
  return new;
end $$;
create trigger track_ai_usage_after_write after insert or update on public.company_analyses
  for each row execute function public.track_ai_usage();
