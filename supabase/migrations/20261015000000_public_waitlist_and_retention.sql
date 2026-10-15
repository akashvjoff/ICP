-- Public paid-plan waitlist: visitors can submit, but cannot read or change entries.
create table if not exists public.waitlist (
  email text not null check (length(email) <= 254),
  plan text not null check (plan in ('starter', 'pro')),
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_plan_unique on public.waitlist (lower(email), plan);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from public, anon, authenticated;
grant insert (email, plan) on public.waitlist to anon;
grant all on public.waitlist to service_role;
create policy "Visitors can join the waitlist" on public.waitlist
  for insert to anon with check (true);

-- Only one Free dataset per owner, even if simultaneous upload requests arrive.
create or replace function public.enforce_free_dataset_limit()
returns trigger language plpgsql security invoker as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_user_id::text, 0));
  if new.row_count > 25 then
    raise exception 'The Free plan accepts up to 25 companies per dataset.';
  end if;
  if lower(right(new.original_filename, 4)) <> '.csv' then
    raise exception 'The Free plan accepts CSV files only.';
  end if;
  if exists (select 1 from public.datasets where owner_user_id = new.owner_user_id) then
    raise exception 'Your Free workspace already has a dataset.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_free_dataset_limit() from public, anon, authenticated;
create trigger enforce_free_dataset_limit_before_insert
  before insert on public.datasets for each row execute function public.enforce_free_dataset_limit();

create or replace function public.enforce_free_lead_limit()
returns trigger language plpgsql security invoker as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.dataset_id::text, 1));
  if (select count(*) from public.leads where dataset_id = new.dataset_id) >= 25 then
    raise exception 'The Free plan accepts up to 25 companies per dataset.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_free_lead_limit() from public, anon, authenticated;
create trigger enforce_free_lead_limit_before_insert
  before insert on public.leads for each row execute function public.enforce_free_lead_limit();

-- The original file is never stored; clear retained raw row copies after 90 days.
create extension if not exists pg_cron;
select cron.schedule(
  'figured-it-clear-raw-rows',
  '0 * * * *',
  $$update public.leads set raw_row = '{}'::jsonb
    where created_at < now() - interval '90 days' and raw_row <> '{}'::jsonb$$
);
