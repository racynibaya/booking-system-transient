-- Phase A — Operator subscription billing: self-serve checkout + automated tracking.
--
-- The seam that turns OUR billing from "manual memory" (Messenger + GCash + admin flips the plan by
-- hand, nothing tracks who lapsed) into self-serve-pay + automated tracking. This is the OPERATOR →
-- PLATFORM money rail (operators pay Tuloy for the software, on TULOY's own PayMongo account) — a
-- SEPARATE rail from the guest → operator deposit gateway (operators' own keys). It reuses that
-- code's shape, not its account.
--
-- What this migration adds:
--   1. tenants.paid_until    — the ONE new fact that makes "overdue" computable.
--   2. subscription_status   — a CHECK to standardize the existing free-text column (no enum churn).
--   3. subscription_payments — an immutable ledger of each subscription payment (one per checkout).
--   4. record_subscription_payment — the webhook's idempotent write: log + advance plan/paid_until.
--
-- Idempotency (architecture P10), mirroring confirm_booking_gateway:
--   * row lock — SELECT ... FOR UPDATE on the tenant serializes two webhooks for the same operator.
--   * subscription_payments_one_per_checkout unique index — the physical backstop: at most one
--     ledger row per PayMongo checkout, so a replayed webhook cannot double-extend paid_until.

-- ---------------------------------------------------------------------------
-- 1. Renewal date — the fact the manual process never had.
-- ---------------------------------------------------------------------------
-- null = never paid (trialing). A confirmed payment advances it +1 month; the past-due cron and the
-- admin "overdue" view both read it. Service-role/webhook-writable only (same posture as plan).
alter table public.tenants
  add column paid_until date;

-- ---------------------------------------------------------------------------
-- 2. Standardize subscription_status (free-text 'trialing' today; read in the admin funnel stats).
-- A CHECK is the simplest thing that works — a text->enum conversion would mean a backfill + editing
-- every reader. 'past_due' is set by the cron; 'cancelled' is reserved for a future stop/downgrade.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add constraint tenants_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 3. Subscription payment ledger — the record the spreadsheet-in-your-head used to be.
-- One row per successful subscription checkout. Immutable (no update/delete grant). period_start/end
-- capture the month the payment covers; paymongo_checkout_id is the idempotency key + the audit ref.
-- ---------------------------------------------------------------------------
create table public.subscription_payments (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  plan                 public.tenant_plan not null,    -- the tier this payment bought
  amount               numeric(10, 2) not null check (amount >= 0),
  currency             text not null default 'PHP',
  paid_at              timestamptz not null default now(),
  period_start         date not null,
  period_end           date not null,
  method               text,                           -- gcash/card/etc. (from the event; nullable)
  paymongo_checkout_id text not null,                  -- cs_... — idempotency key + audit ref
  provider_ref         text,                           -- payment id, when present on the event
  raw                  jsonb,                           -- the verified event, for reconciliation
  created_at           timestamptz not null default now()
);

-- Idempotency floor (P10): at most one ledger row per PayMongo checkout. A replayed/retried webhook
-- hits this and no-ops instead of double-crediting the operator a second month.
create unique index subscription_payments_one_per_checkout
  on public.subscription_payments (paymongo_checkout_id);

-- Fast lookup of a tenant's billing history (operator view + admin).
create index subscription_payments_tenant_idx
  on public.subscription_payments (tenant_id, paid_at desc);

alter table public.subscription_payments enable row level security;

-- An operator may READ only their own ledger rows. Writes come ONLY from the service-role webhook
-- via record_subscription_payment — no insert/update/delete grant to authenticated (same posture as
-- payments). anon never touches this table.
grant select on public.subscription_payments to authenticated;
grant all on public.subscription_payments to service_role;

create policy "subscription_payments_select_own"
  on public.subscription_payments
  for select
  to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- ---------------------------------------------------------------------------
-- 4. record_subscription_payment — webhook-only. Logs the payment and advances the tenant's plan +
-- renewal date in one idempotent step. Returns the new ledger row, or NULL on a replay (the
-- null-composite contract the gateway handler already knows how to read).
-- ---------------------------------------------------------------------------
create or replace function public.record_subscription_payment(
  p_tenant_id    uuid,
  p_plan         public.tenant_plan,
  p_amount       numeric,
  p_checkout_id  text,
  p_currency     text default 'PHP',
  p_provider_ref text default null,
  p_method       text default null,
  p_raw          jsonb default null
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

  v_end := (v_current + interval '1 month')::date;

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

  -- New payment: activate the purchased tier and push the renewal date out one month.
  update public.tenants
  set plan = p_plan,
      subscription_status = 'active',
      paid_until = v_end
  where id = p_tenant_id;

  return v_row;
end;
$$;

-- Webhook-only: called with the service-role key (no operator session). Operators never call this.
revoke execute on function public.record_subscription_payment(uuid, public.tenant_plan, numeric, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_subscription_payment(uuid, public.tenant_plan, numeric, text, text, text, text, jsonb)
  to service_role;
