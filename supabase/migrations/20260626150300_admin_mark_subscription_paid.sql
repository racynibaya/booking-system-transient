-- Bulletproofing step 4: a manual recovery for the WRONGFUL-CLOSE failure mode.
--
-- Enforcement keys on paid_until, which is advanced only by the PayMongo webhook. A missed/failed
-- webhook (we have hit one before — the SITE_URL incident) leaves paid_until stale and would dark a
-- PAYING operator. This RPC is the reconciliation lever: an admin confirms the payment landed at
-- PayMongo and restores the operator immediately, without waiting on a webhook replay.
--
-- It deliberately does NOT write a subscription_payments ledger row: the real payment exists upstream,
-- and a synthetic checkout id could later collide with the genuine webhook's idempotency key. This is a
-- correction, not a payment of record. Service-role only (admin server actions), same posture as
-- record_subscription_payment — operators can never call it.

create or replace function public.admin_mark_subscription_paid(
  p_tenant_id  uuid,
  p_paid_until date,
  p_plan       public.tenant_plan default null
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants;
begin
  update public.tenants
  set paid_until = greatest(coalesce(paid_until, p_paid_until), p_paid_until),  -- never shorten existing cover
      subscription_status = 'active',
      plan = coalesce(p_plan, plan)                                             -- keep current tier unless given
  where id = p_tenant_id
  returning * into v_tenant;

  if not found then
    raise exception 'UNKNOWN_TENANT';
  end if;

  return v_tenant;
end;
$$;

revoke execute on function public.admin_mark_subscription_paid(uuid, date, public.tenant_plan)
  from public, anon, authenticated;
grant execute on function public.admin_mark_subscription_paid(uuid, date, public.tenant_plan)
  to service_role;
