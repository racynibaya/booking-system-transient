-- Phase A enforcement — DORMANT until flipped post-pilot. When a past-due operator stays unpaid
-- beyond the grace window, downgrade them to free: the booking page keeps working, but the soft
-- room-cap nudge applies again (reuses the D7 guard). Gentle + reversible — a renewal via
-- record_subscription_payment puts them straight back on their paid tier.
--
-- The SWITCH lives in the cron route (env SUBSCRIPTION_ENFORCEMENT): during the pilot the cron never
-- calls this, so nothing is enforced (nag-only). Flip the env to "true" after the pilot to turn it
-- on. Grace is measured from paid_until (the lapse date) — no extra "past_due_since" column needed.
create or replace function public.downgrade_lapsed_subscriptions(p_grace_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.tenants
  set plan = 'free',
      subscription_status = 'cancelled',  -- a paid sub ended for non-payment (distinct from 'trialing')
      paid_until = null                   -- free has no renewal date
  where subscription_status = 'past_due'
    and plan <> 'free'
    and paid_until is not null
    and paid_until < current_date - p_grace_days;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cron/service-role only: no operator/anon path downgrades a plan.
revoke execute on function public.downgrade_lapsed_subscriptions(integer) from public, anon, authenticated;
grant execute on function public.downgrade_lapsed_subscriptions(integer) to service_role;
