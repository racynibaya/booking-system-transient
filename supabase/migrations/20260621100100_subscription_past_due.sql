-- Phase A — the automated "who lapsed" flag. This is what turns manual MEMORY into a system that
-- watches for us: a tenant whose paid_until has passed is flipped active -> past_due so the admin
-- "overdue" view and the operator's own plan card surface it, without anyone having to remember.
--
-- Pure housekeeping (not a billing state-machine transition): idempotent by construction — a second
-- run flips 0 rows (already past_due). Driven by a scheduled cron route (service-role); never by an
-- operator. A renewal payment moves them back to 'active' via record_subscription_payment.
create or replace function public.flag_past_due_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.tenants
  set subscription_status = 'past_due'
  where subscription_status = 'active'
    and paid_until is not null
    and paid_until < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cron/service-role only: no operator/anon path flips billing status.
revoke execute on function public.flag_past_due_subscriptions() from public, anon, authenticated;
grant execute on function public.flag_past_due_subscriptions() to service_role;
