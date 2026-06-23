-- Annual billing — make the subscription period length a parameter.
--
-- The billing spine (paid_until, the subscription_payments ledger with its period_start/period_end,
-- the past-due cron, the admin panel) is already interval-agnostic: it all reads off paid_until and
-- doesn't care how long a period is. The ONE place that hardcoded "a period = 1 month" was
-- record_subscription_payment (…20260621100000_subscription_billing.sql). This migration parameterizes
-- that single line so the SAME RPC records a monthly OR a yearly payment.
--
-- p_months defaults to 1, so every existing caller (the monthly webhook path, the tests) is unchanged;
-- the annual checkout passes 12. Everything else — idempotency (row lock + one-per-checkout unique
-- index), the UNKNOWN_TENANT guard, the null-composite replay contract — is byte-for-byte the same.
--
-- Adding a parameter changes the function signature, which `create or replace` cannot do, so we drop
-- and recreate, re-issuing the same revoke/grant posture (webhook/service-role only).

drop function if exists public.record_subscription_payment(
  uuid, public.tenant_plan, numeric, text, text, text, text, jsonb
);

create function public.record_subscription_payment(
  p_tenant_id    uuid,
  p_plan         public.tenant_plan,
  p_amount       numeric,
  p_checkout_id  text,
  p_currency     text default 'PHP',
  p_provider_ref text default null,
  p_method       text default null,
  p_raw          jsonb default null,
  p_months       int default 1            -- billing period length: 1 = monthly, 12 = annual
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     public.subscription_payments;
  v_current date;
  v_end     date;
begin
  -- Lock the tenant row: serializes two webhooks racing for the same operator, and gives us the
  -- current paid_until to extend from (stacking a renewal onto remaining time, never shortening it).
  select greatest(coalesce(paid_until, current_date), current_date) into v_current
  from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'UNKNOWN_TENANT';
  end if;

  -- The only behavioral change: advance by the purchased number of months (default 1).
  v_end := (v_current + make_interval(months => greatest(p_months, 1)))::date;

  insert into public.subscription_payments (
    tenant_id, plan, amount, currency, paid_at, period_start, period_end,
    method, paymongo_checkout_id, provider_ref, raw
  ) values (
    p_tenant_id, p_plan, p_amount, coalesce(p_currency, 'PHP'), now(), v_current, v_end,
    p_method, p_checkout_id, p_provider_ref, p_raw
  )
  on conflict (paymongo_checkout_id) do nothing
  returning * into v_row;

  -- Conflict → this checkout was already recorded (replayed webhook). No-op, don't re-extend.
  if v_row.id is null then
    return null;
  end if;

  -- New payment: activate the purchased tier and push the renewal date out by the period bought.
  update public.tenants
  set plan = p_plan,
      subscription_status = 'active',
      paid_until = v_end
  where id = p_tenant_id;

  return v_row;
end;
$$;

-- Webhook-only: called with the service-role key (no operator session). Operators never call this.
revoke execute on function public.record_subscription_payment(uuid, public.tenant_plan, numeric, text, text, text, text, jsonb, int)
  from public, anon, authenticated;
grant execute on function public.record_subscription_payment(uuid, public.tenant_plan, numeric, text, text, text, text, jsonb, int)
  to service_role;
