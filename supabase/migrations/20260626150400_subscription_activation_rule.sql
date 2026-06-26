-- Bulletproofing the subscription money rail, the companion half: the ACTIVATION rule.
--
-- The lapse rule (150000) only closes an operator who HAD a paid period that expired — the stated
-- "buy one month, then go free forever" exploit. It deliberately leaves a never-paid operator (null
-- paid_until) open, so we never wrongful-close a pilot. That leaves one gap: a brand-new signup (or a
-- delete-and-re-signup) who never pays at all could book free indefinitely once enforcement is on.
--
-- This closes it with a FREE TRIAL WINDOW: a new operator may publish + take real bookings for a fixed
-- window; if the window expires with no payment, the page closes (under enforce). Existing operators are
-- GRANDFATHERED — they get a null trial_ends_at, which means "never trial-expires" — so flipping this on
-- can never dark a current pilot.
--
-- Ships DORMANT twice over: it bites only when billing_config.enforcement_mode='enforce' AND the new
-- require_activation flag is true (default false). Until both are set, every derived can_accept_bookings
-- is unchanged. This keeps the existing entitlement tests green by construction.

-- ---------------------------------------------------------------------------
-- 1. trial_ends_at on tenants — the per-operator free-trial deadline.
--    null  → grandfathered: never trial-expires (ALL existing rows, backfilled below).
--    date  → the free window for a never-paid operator; past it (+ grace) they are "unactivated".
--
--    Add WITHOUT a default first so every EXISTING row becomes null (grandfathered), THEN set the
--    default for FUTURE inserts only — so new signups automatically get a 14-day window with no change
--    to the tenant-creation trigger. (ADD COLUMN ... DEFAULT would backfill existing rows too; we don't
--    want that.)
--
--    Not added to the authenticated column-grant on tenants, so operators CANNOT extend their own trial
--    (same lockdown that already protects paid_until / subscription_status / plan).
-- ---------------------------------------------------------------------------
alter table public.tenants add column trial_ends_at date;
alter table public.tenants alter column trial_ends_at set default (current_date + 14);

comment on column public.tenants.trial_ends_at is
  'Free-trial deadline for a never-paid operator. null = grandfathered (never trial-expires). '
  'Operator-unwritable (not in the authenticated column grant). Drives the activation half of '
  'tenant_subscription_entitlement.';

-- ---------------------------------------------------------------------------
-- 2. require_activation on billing_config — the SECOND switch, independent of enforcement_mode, so the
--    activation half can be rolled out separately from the lapse half. Default false → inert.
-- ---------------------------------------------------------------------------
alter table public.billing_config
  add column require_activation boolean not null default false;

comment on column public.billing_config.require_activation is
  'When true (and enforcement_mode=enforce), a never-paid operator whose trial window has expired past '
  'grace is blocked. Independent of the lapse rule so the two halves roll out separately. Default false.';

-- ---------------------------------------------------------------------------
-- 3. Recreate the authority view to fold in the activation branch.
--    is_unactivated — the activation mirror of is_lapsed: a never-paid operator WITH a finite trial that
--                     expired past grace. Requires trial_ends_at IS NOT NULL, so grandfathered operators
--                     (null trial) are never unactivated → never wrongful-closed.
--    can_accept_bookings now blocks on (is_lapsed OR is_unactivated), each gated by its own switch.
--
--    create or replace keeps the leading columns identical (tenant_id, is_lapsed, can_accept_bookings,
--    counts_as_paid, enforcement_mode) and appends is_unactivated, which is the only shape change allowed.
-- ---------------------------------------------------------------------------
create or replace view public.tenant_subscription_entitlement
  with (security_invoker = false) as
select
  t.id as tenant_id,
  (t.paid_until is not null and t.paid_until < current_date - cfg.grace_days) as is_lapsed,
  not (
    (
      cfg.enforcement_mode = 'enforce'
      and t.paid_until is not null
      and t.paid_until < current_date - cfg.grace_days
    )
    or (
      cfg.enforcement_mode = 'enforce'
      and cfg.require_activation
      and t.paid_until is null
      and t.trial_ends_at is not null
      and t.trial_ends_at < current_date - cfg.grace_days
    )
  ) as can_accept_bookings,
  (t.subscription_status = 'active' and t.paid_until >= current_date) as counts_as_paid,
  cfg.enforcement_mode as enforcement_mode,
  (
    cfg.require_activation
    and t.paid_until is null
    and t.trial_ends_at is not null
    and t.trial_ends_at < current_date - cfg.grace_days
  ) as is_unactivated
from public.tenants t
cross join public.billing_config cfg;

-- Grants are unchanged by create-or-replace, but re-assert for clarity (service_role-only direct read;
-- seams reach it as the view owner).
grant select on public.tenant_subscription_entitlement to service_role;
