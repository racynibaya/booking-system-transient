-- Slice 7 cutover (commission-only): drop the last subscription data structures — the payment ledger,
-- the tenant subscription columns, and the tier enum. Runs last, after every reader (DB + app) is gone
-- (160700–160900 + the app changes in this branch). In dev the ledger is empty and the only column data
-- is the pilot default (plan='solo', subscription_status='trialing'); flattening intentionally discards
-- those tier assignments. Recoverable from the pre-commission-cutover git tag if ever needed.

-- 1. Subscription payment ledger (written only by the now-dropped record_subscription_payment). Has a
--    plan tenant_plan column, so it must go before the enum type.
drop table if exists public.subscription_payments;

-- 2. Tenant subscription columns (no remaining readers). billing_interval was never a column on this
--    table, so it is not listed.
alter table public.tenants
  drop column if exists plan,
  drop column if exists subscription_status,
  drop column if exists paid_until,
  drop column if exists trial_ends_at;

-- 3. The tier enum — now unreferenced (both plan columns dropped above).
drop type if exists public.tenant_plan;
