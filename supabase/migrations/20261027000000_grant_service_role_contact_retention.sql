-- The server's retention sweep and account exports need access to contact rows.
-- Keep browser roles limited to the existing insert-only policy.
grant select, insert, update, delete on public.lead_contacts to service_role;
