-- Preserve the selected billing interval and currency for paid-plan waitlist entries.
alter table public.waitlist
  add column if not exists "interval" text not null default 'monthly',
  add column if not exists currency text not null default 'INR';

alter table public.waitlist
  add constraint waitlist_interval_check check ("interval" in ('monthly', 'annual')),
  add constraint waitlist_currency_check check (currency in ('INR', 'USD'));

drop index if exists public.waitlist_email_plan_unique;
create unique index if not exists waitlist_email_plan_interval_currency_unique
  on public.waitlist (lower(email), plan, "interval", currency);

grant insert (email, plan, "interval", currency) on public.waitlist to anon;
