-- Bulletproofing the subscription money rail, step 1 of N: introduce the SINGLE SOURCE OF TRUTH for
-- "can this tenant take bookings?", plus the one explicit switch that controls enforcement.
--
-- WHY: today the "is this operator entitled?" decision is re-derived with DIFFERENT predicates across
-- get_public_listing, list_public_listings (grid + ranking), and (proposed) the booking engine — gated
-- by a TS env flag and materialized by a daily cron. Any drift between those predicates is either a
-- revenue leak (a non-payer keeps booking) or a wrongful close (a PAYING operator is darked — just as
-- costly on a trust marketplace). This migration gives the decision one home; later steps repoint each
-- seam at it. Nothing here changes behavior — it is INERT until a seam reads it AND the mode is flipped.
--
-- DORMANCY is now EXPLICIT (not the old implicit "nobody is cancelled yet"): billing_config.enforcement_mode
-- defaults to 'off', so every derived `can_accept_bookings` is true until someone deliberately flips it.

-- ---------------------------------------------------------------------------
-- 1. billing_config — the explicit, DB-side enforcement switch. Single row (the boolean-PK trick caps
--    it at exactly one). Replaces env.SUBSCRIPTION_ENFORCEMENT as the source of truth so the SQL money
--    rail is self-contained (a SECURITY DEFINER booking guard can't read process.env).
--      off      — dormant. enforcement never bites. (pilot default)
--      dry_run  — compute lapses + surface them (would-close), but DO NOT block. The safe rollout step.
--      enforce  — lapsed-past-grace operators are blocked from taking new bookings.
-- ---------------------------------------------------------------------------
create table public.billing_config (
  id               boolean primary key default true check (id),  -- single-row guard
  enforcement_mode text    not null default 'off'
    check (enforcement_mode in ('off', 'dry_run', 'enforce')),
  grace_days       integer not null default 3 check (grace_days >= 0),
  updated_at       timestamptz not null default now()
);

insert into public.billing_config default values;  -- seeds the one row: mode='off', grace=3

-- Config is service-role-only. The entitlement view below (owned by postgres) reads it as its owner,
-- so anon/operators never need — and never get — direct access to the switch.
alter table public.billing_config enable row level security;
grant select, update on public.billing_config to service_role;

-- ---------------------------------------------------------------------------
-- 2. tenant_subscription_entitlement — THE authority. One row per tenant; every seam reads the field it
--    cares about. The lapse rule lives here and ONLY here.
--
--    is_lapsed           — pure, mode-independent: the tenant HAD a paid period that expired past grace.
--                          Requires a non-null paid_until, so a never-paid / pilot operator is NEVER
--                          lapsed (and thus never wrongful-closed), even if the mode is flipped early.
--    can_accept_bookings — THE money gate. Live-evaluated from paid_until + grace + mode, so it does not
--                          depend on any cron having run (closes the leak window). Blocked ONLY when the
--                          mode is 'enforce' AND the tenant is lapsed.
--    counts_as_paid      — the existing "actively paying" signal for marketplace ranking/featured.
--
-- security_invoker=false (the default, set explicitly): the view runs as its owner so it can read
-- billing_config without granting that table to callers, and so the SECURITY DEFINER read seams can
-- consult it. current_date is evaluated per query → genuinely live.
-- ---------------------------------------------------------------------------
create view public.tenant_subscription_entitlement
  with (security_invoker = false) as
select
  t.id as tenant_id,
  (t.paid_until is not null and t.paid_until < current_date - cfg.grace_days) as is_lapsed,
  not (
    cfg.enforcement_mode = 'enforce'
    and t.paid_until is not null
    and t.paid_until < current_date - cfg.grace_days
  ) as can_accept_bookings,
  (t.subscription_status = 'active' and t.paid_until >= current_date) as counts_as_paid,
  cfg.enforcement_mode as enforcement_mode
from public.tenants t
cross join public.billing_config cfg;

-- Direct reads are for the service-role cron (dry-run "would-close" logging) and integration tests. The
-- SECURITY DEFINER read seams + booking guard reach it as the view owner, so they need no grant. anon /
-- authenticated are deliberately NOT granted: the view runs owner-rights (bypasses tenants RLS), so a
-- broad grant would leak every tenant's lapse state.
grant select on public.tenant_subscription_entitlement to service_role;

-- Operator-facing read of THEIR OWN entitlement (for the Settings "your page is paused" notice). A
-- SECURITY DEFINER wrapper scoped to current_tenant_id() so the operator session never needs a grant on
-- the owner-rights view (which would leak every tenant's state). Same single source of truth.
create or replace function public.current_tenant_can_accept_bookings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select e.can_accept_bookings
      from public.tenant_subscription_entitlement e
      where e.tenant_id = public.current_tenant_id()
    ),
    true  -- no tenant context (e.g. admin/anon) → never claim "paused"
  );
$$;

grant execute on function public.current_tenant_can_accept_bookings() to authenticated;

