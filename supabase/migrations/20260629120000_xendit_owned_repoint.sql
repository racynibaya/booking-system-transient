-- Xendit commission rail — MANAGED → OWNED re-point (Slice 1/4).
--
-- Counsel + Xendit AM (2026-06-29): operators must be a registered business (Sole Prop min; Xendit no
-- longer onboards individuals), and only **OWNED** sub-accounts give the white-label experience our
-- non-techy operators need (they never touch Xendit; we submit KYC via account_verification and
-- disburse via the Payouts API). OWNED is defensibly not-custody because the operator withdraws on
-- their own instruction — so we store their payout destination and add an operator-initiated withdraw.
-- Memory: xendit-owned-custody-legal.
--
-- Additive only (D4). Existing test rows keep their MANAGED type; the default flips for new operators.
alter table public.tenant_xendit_accounts
  alter column type set default 'OWNED',
  -- Disbursement destination (where the operator self-withdraws to). Money-trust: service-role-write
  -- only (no operator UPDATE grant on this table — same lockdown as the rest of it). Channel code is
  -- a Xendit payout channel (e.g. a PH bank or GCASH); account_name must match the bank/e-wallet exactly.
  add column if not exists payout_channel_code  text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name  text,
  -- When we submitted account_verification for this operator (KYC in flight). LIVE is still driven by
  -- the account_holder.kyc.status / account webhook → kyc_status, not by this stamp.
  add column if not exists kyc_submitted_at timestamptz;

-- account_holder_id stays (additive discipline) but is now unused: the OWNED KYC path is
-- account_verification (for-user-id), not the account_holders + PATCH-link flow that 403'd on MANAGED.
comment on column public.tenant_xendit_accounts.account_holder_id is
  'UNUSED after the OWNED re-point — KYC is submitted via account_verification (for-user-id), not account_holders linking.';
