-- Phase 3 / P3.1 — make the subscription tiers real. The plan enum shipped in 2b as
-- ('free','business') only, to gate the PayMongo gateway. The product sells four states:
--   free     = pilot / unpaid default (a new tenant signs up here)
--   solo     = ≤4 rooms,  paid
--   pro      = ≤15 rooms, paid
--   business = unlimited,  paid + online gateway (the gateway stays BUSINESS-ONLY — D-B)
--
-- ADDITIVE only: append the two missing values. No data migration, existing rows untouched, and
-- the 2b gateway gate (plan = 'business') keeps working unchanged. Room caps + the gateway flag
-- live in lib/plans.ts (single source of truth); this migration only teaches the enum the values.
--
-- ADD VALUE is idempotent-guarded; it is not used in this same migration, so it is safe under
-- Postgres' in-transaction rule. Plan stays admin/service-role-writable only (the column lockdown
-- from 20260619120000 already excludes it) — manual-first billing (B4) sets it, never the operator.

alter type public.tenant_plan add value if not exists 'solo';
alter type public.tenant_plan add value if not exists 'pro';
