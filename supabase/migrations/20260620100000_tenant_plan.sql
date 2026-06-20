-- Phase 2b / M1 — tenant plan tier. The gateway (operator-as-merchant PayMongo) is a paid
-- "Business" capability; later 2b steps (connect-UI, per-tenant checkout) gate on this. Additive:
-- a new enum + column, default 'free'. Same posture as subscription_status: the existing
-- table-wide update grant + tenants_update_own policy mean an operator could technically write
-- their own plan, but that flips no money switch on its own -- the real gate is server-side and
-- checks for an actual PayMongo connection (M2) before any checkout (M4), so self-setting
-- plan='business' without a genuine connection buys nothing. A column-level lockdown can come
-- later if billing needs it.
create type public.tenant_plan as enum ('free', 'business');

alter table public.tenants
  add column plan public.tenant_plan not null default 'free';
