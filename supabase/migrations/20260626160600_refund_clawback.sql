-- Centralized-aggregator pivot / Slice 6 — admin refunds + clawback (money-OUT, the refund path).
--
-- An admin refunds a guest's deposit from the ONE platform wallet. The money-correctness rule mirrors
-- the disbursement path: the network call (PayMongo POST /refunds) sits BETWEEN two atomic, status-
-- guarded ledger steps, so a guest can be refunded at most once and we never both pay an operator AND
-- refund the same accrual without recording a clawback.
--
--   claim_refund(booking)          → atomically reserves the booking's accrual into 'refunding' (only
--                                    from clearing/payable/paid), returns the deposit payment's pi_ ref
--                                    + captured amount + the PRIOR status so the caller knows clawback
--                                    vs plain refund. A second claim matches nothing (no longer in the
--                                    set) → no double-refund.
--   <action resolves pay_ from pi_ and calls PayMongo POST /refunds>
--   finish_refund(booking, ref, amount, clawback) → on a 2xx: 'refunding' → 'refunded' (money still
--                                    with us, operator never paid) | 'clawed_back' (operator already
--                                    paid → withhold their next payout, recovered manually for pilot).
--                                    Stamps the actual refunded amount here (not at claim, where a
--                                    default-full refund's amount isn't known yet).
--   abort_refund(booking, restore)  → on a PayMongo error: 'refunding' → prior status (no money moved).
--
-- CLAWBACK (v1, manual): when the operator was already paid, we mark the row 'clawed_back', alert
-- admins, and recover the owed share from their next payout BY HAND. The negative-accrual auto-netting
-- variant is a deliberate v2 deferral (near-never at pilot scale; the audit row is already here for it).
--
-- F3 race: 'payable' is the sub-second transient inside one cron run between claim_due_payouts and
-- mark_payout_paid — the transfer may already be in flight. A refund landing exactly then is treated
-- conservatively as already-disbursed (clawback), so we never silently eat a paid-out balance.
--
-- This slice is MONEY-ONLY: it does not cancel the booking or free inventory (that stays the operator's
-- explicit cancel action). Service-role only, like the rest of the disbursement state machine.

alter type public.payout_ledger_status add value if not exists 'refunding';

alter table public.payout_ledger
  add column if not exists refund_ref text,        -- PayMongo refund id (ref_…) once refunded
  add column if not exists refund_amount numeric(10, 2);  -- pesos refunded to the guest

-- claim — reserve a booking's accrual for refund and report what the caller needs to address PayMongo.
-- Returns a row ONLY when the claim succeeds (the accrual exists and is in a refundable state); the
-- empty result is the "already refunding/refunded/clawed_back, or not a centralized booking" signal.
create or replace function public.claim_refund(p_booking_id uuid)
returns table (
  tenant_id     uuid,
  prior_status  text,
  provider_ref  text,   -- the deposit payment's pi_ (resolve to pay_ for POST /refunds)
  paid_amount   numeric -- the guest charge actually captured = max refundable (pesos)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    public.payout_ledger;
  v_ref    text;
  v_amount numeric;
begin
  -- Lock the accrual; refundable only from a settled-but-not-yet-refunded state.
  select * into v_row from public.payout_ledger
  where payout_ledger.booking_id = p_booking_id
  for update;
  if not found then
    return;  -- no centralized accrual for this booking
  end if;
  if v_row.status not in ('clearing', 'payable', 'paid') then
    return;  -- already refunding/refunded/clawed_back/failed → no-op
  end if;

  update public.payout_ledger
  set status = 'refunding', updated_at = now()
  where payout_ledger.booking_id = p_booking_id;

  -- The captured deposit payment carries the pi_ (provider_ref) + the grossed-up charge actually paid.
  select payments.provider_ref, payments.amount into v_ref, v_amount
  from public.payments
  where payments.booking_id = p_booking_id
    and payments.kind = 'deposit'
    and payments.status = 'confirmed'
  order by payments.created_at desc
  limit 1;

  return query select v_row.tenant_id, v_row.status::text, v_ref, v_amount;
end;
$$;

-- finish — the refund succeeded at PayMongo. clearing/payable/paid was captured by claim; the caller
-- passes p_clawback = (prior status implied the operator was, or is being, paid).
create or replace function public.finish_refund(
  p_booking_id uuid,
  p_refund_ref text,
  p_amount     numeric,
  p_clawback   boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payout_ledger
  set status = case when p_clawback then 'clawed_back' else 'refunded' end::public.payout_ledger_status,
      refund_ref = p_refund_ref,
      refund_amount = p_amount,
      updated_at = now()
  where payout_ledger.booking_id = p_booking_id
    and payout_ledger.status = 'refunding';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- abort — the PayMongo refund failed; release the reservation back to where it was so the daily cron
-- can still pay the operator (or the row can be refunded again later). No money moved.
create or replace function public.abort_refund(p_booking_id uuid, p_restore_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payout_ledger
  set status = p_restore_status::public.payout_ledger_status,
      updated_at = now()
  where payout_ledger.booking_id = p_booking_id
    and payout_ledger.status = 'refunding';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Admin/action only — service_role. Operators never refund.
revoke execute on function public.claim_refund(uuid) from public, anon, authenticated;
grant execute on function public.claim_refund(uuid) to service_role;
revoke execute on function public.finish_refund(uuid, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.finish_refund(uuid, text, numeric, boolean) to service_role;
revoke execute on function public.abort_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.abort_refund(uuid, text) to service_role;
