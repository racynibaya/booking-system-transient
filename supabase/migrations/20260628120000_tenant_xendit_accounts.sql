-- Xendit xenPlatform commission rail / Slice 1 — operator → Xendit MANAGED sub-account.
--
-- Replaces the aggregator's payout DESTINATION model. In xenPlatform every guest charge is created ON
-- the operator's own sub-account (the `for-user-id`), a split rule routes only Tuloy's 2.5% to the
-- Master, and the operator's share settles to their sub-account — no custody. This table is the
-- operator↔sub-account binding plus the per-tenant commission rate.
--
-- NEW table, not a repurpose of tenant_payout_accounts: every column of that (aggregator) table is
-- wrong for Xendit (operator self-withdraws → no GCash/bank destination needed; 5%/6% → 2.5% + guest
-- gross-up) and it is dropped in Slice 5. Mirrors how Model-A kept tenant_gateway_connections separate.
-- Additive + dormant (D4): nothing reads it until the onboarding action (Slice 1) and the charge path
-- (Slice 2) are wired, both env-gated on XENDIT_SECRET_KEY.
--
-- MANAGED locked (2026-06-28): MANAGED sub-accounts have self-service Withdrawals (operator pulls their
-- own balance to their own bank, no Master action) — the only type that keeps "Tuloy never initiates
-- payouts" true. OWNED is Master-only withdrawal = custody. The `type` column stays honest but defaults
-- MANAGED; a sub-account's type is permanent at Xendit (not migratable).

-- Xendit account lifecycle, mirrored verbatim so the webhook can only ever write a value Xendit emits
-- (an unknown status fails the insert loudly — a safe failure). The online-pay gate keys off 'LIVE';
-- 'SUSPENDED' is the takedown. No lossy domain mapping — the column speaks Xendit's vocabulary because
-- this table only exists to track a Xendit account.
create type public.xendit_account_status as enum (
  'INVITED', 'REGISTERED', 'AWAITING_DOCS', 'PENDING_VERIFICATION', 'LIVE', 'SUSPENDED'
);

create table public.tenant_xendit_accounts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  sub_account_id    text not null,                              -- Xendit account id = the `for-user-id`
  account_holder_id text,                                       -- from KYC submission; null for hosted-KYC flows
  type              text not null default 'MANAGED' check (type in ('MANAGED', 'OWNED')),
  kyc_status        public.xendit_account_status not null default 'INVITED',
  commission_rate   numeric(5, 4) not null default 0.0250,      -- Tuloy's cut of full stay value (0.025 = 2.5%)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id),                                           -- one sub-account per operator (create-once anchor)
  unique (sub_account_id),                                      -- the webhook locates the row by this
  constraint xendit_commission_rate_bounds check (commission_rate >= 0 and commission_rate <= 1)
);

-- RLS — unlike tenant_payout_accounts there is NO operator-writable column here: sub_account_id decides
-- who gets paid, kyc_status gates online pay, commission_rate is revenue. So this follows the Model-A
-- gateway-store idiom: operators may only SELECT their own row; every write goes through a service-role
-- server path (the onboarding action, the KYC webhook, admin discount tooling). An operator can never
-- spoof kyc_status='LIVE' or zero their own commission_rate because they cannot write the table at all.
alter table public.tenant_xendit_accounts enable row level security;
create policy "tenant_xendit_accounts_select_own" on public.tenant_xendit_accounts for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
grant select on public.tenant_xendit_accounts to authenticated;
grant all on public.tenant_xendit_accounts to service_role;
