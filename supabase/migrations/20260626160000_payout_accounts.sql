-- Centralized-aggregator pivot / Slice 1 — operator payout destination.
--
-- In the new model Tuloy collects every guest deposit into ONE Tuloy PayMongo account, then disburses
-- each operator's share to THEIR GCash/bank. PayMongo confirmed the recipient needs no PayMongo
-- account and no KYC — just a name + number — so onboarding captures a payout *destination*, not a
-- credential. Unlike tenant_gateway_connections (Vault-encrypted operator secret keys, Model A), this
-- holds NO secret: it's ordinary operator-owned data, RLS-scoped to the tenant like
-- tenant_payment_methods. The Model-A gateway tables stay in place (dormant) — this is additive.
--
-- Per-owner pricing lives here for now (1:1 with tenant): commission_rate (operator's 5%, withheld
-- from the deposit payout) and service_fee_rate (guest's 6%, added to the deposit charge). Both are
-- sized on the FULL stay value at booking time; see Slice 2/4. Early-adopter discount = lower rates
-- on the row. (Could later move to a tenant-level billing config if pricing must outlive a payout
-- destination change.)

create type public.payout_method as enum ('gcash', 'bank');

create table public.tenant_payout_accounts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  method           public.payout_method not null,
  payout_name      text not null,                       -- MUST match the GCash/bank account name or PayMongo rejects the transfer
  account_number   text not null,                       -- GCash number or bank account number
  bank_name        text,                                -- only meaningful for method = 'bank'
  commission_rate  numeric(5, 4) not null default 0.0500,  -- operator share withheld (0.05 = 5%)
  service_fee_rate numeric(5, 4) not null default 0.0600,  -- guest service fee added (0.06 = 6%)
  status           text not null default 'active',      -- 'active' | 'failed' (a failed payout can flag the row in Slice 5)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id),                                   -- one payout destination per tenant for now
  constraint payout_bank_name_required check (method <> 'bank' or bank_name is not null),
  constraint payout_commission_rate_bounds check (commission_rate >= 0 and commission_rate <= 1),
  constraint payout_service_fee_rate_bounds check (service_fee_rate >= 0 and service_fee_rate <= 1)
);
create index tenant_payout_accounts_tenant_idx on public.tenant_payout_accounts (tenant_id);

-- RLS — operator reads/writes only their own row (same idiom as tenant_payment_methods). The payout
-- job (Slice 5) reaches rows via service_role.
--
-- Rate columns are money: an operator must NOT be able to set their own commission_rate to 0. RLS
-- with-check only scopes tenant_id, so we additionally use COLUMN-LEVEL grants — authenticated may
-- write only the payout-destination columns; commission_rate/service_fee_rate are reachable only via
-- service_role (admin discount tooling), defaulting to 5%/6% on insert.
alter table public.tenant_payout_accounts enable row level security;
create policy "tenant_payout_accounts_select_own" on public.tenant_payout_accounts for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "tenant_payout_accounts_insert_own" on public.tenant_payout_accounts for insert
  to authenticated with check (tenant_id = (select public.current_tenant_id()));
create policy "tenant_payout_accounts_update_own" on public.tenant_payout_accounts for update
  to authenticated using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
grant select on public.tenant_payout_accounts to authenticated;
grant insert (tenant_id, method, payout_name, account_number, bank_name)
  on public.tenant_payout_accounts to authenticated;
grant update (method, payout_name, account_number, bank_name, updated_at)
  on public.tenant_payout_accounts to authenticated;
grant all on public.tenant_payout_accounts to service_role;

-- Changing where money is sent re-opens the verification window, same as a payout-method change:
-- stamp tenants.gcash_changed_at for an APPROVED operator so admins re-check name vs ID.
create trigger trg_flag_payout_account_change
  after insert or update or delete on public.tenant_payout_accounts
  for each row execute function public.flag_payout_change();
