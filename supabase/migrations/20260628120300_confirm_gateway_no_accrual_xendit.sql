-- Xendit commission rail / Slice 2c — confirm a booking from a Xendit Payment Session WITHOUT writing a
-- payout_ledger accrual. In the aggregator model Tuloy collected the deposit and accrued the operator's
-- payout for later disbursement (the accrual block). With Xendit the charge settles directly to the
-- operator's sub-account and the Split Rule routes only the 2.5% to the Master AT CAPTURE — so there is
-- nothing for Tuloy to accrue or disburse. The confirm stays the SAME (idempotency, AMOUNT_MISMATCH,
-- paid-but-expired rescue, SLOT_TAKEN, the payment row) — only the accrual is skipped for p_provider
-- 'xendit'. Body is otherwise verbatim from the live definition (pg_get_functiondef, not the drifted
-- migration files); the ONLY change is the added `p_provider <> 'xendit'` guard on the accrual block.
create or replace function public.confirm_booking_gateway(
  p_booking_id uuid,
  p_provider text,
  p_provider_ref text default null,
  p_amount numeric default null,
  p_raw_payload jsonb default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking     public.bookings;
  v_quantity    integer;
  v_blocked     integer;
  v_overlapping integer;
  v_expected    numeric;
  v_comm_rate   numeric;
  v_fee_rate    numeric;
  v_commission  numeric;
  v_service_fee numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'UNKNOWN_BOOKING';
  end if;

  -- Idempotent: the deposit is already confirmed (a replayed webhook) → no-op.
  if v_booking.status = 'confirmed' then
    return null;
  end if;

  -- Only a live hold or a legacy proof-submitted booking can be confirmed by a payment.
  if v_booking.status not in ('held', 'awaiting_confirmation') then
    raise exception 'NOT_CONFIRMABLE';
  end if;

  -- Amount guard — verify the settled amount against what we charged: the stamped
  -- gateway_charge_amount (centralized) when present, else the bare deposit.
  v_expected := coalesce(v_booking.gateway_charge_amount, v_booking.deposit_amount);
  if p_amount is not null and p_amount <> v_expected then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- Paid-but-expired rescue: a webhook can land after the hold lapsed.
  if v_booking.status = 'held'
     and v_booking.hold_expires_at is not null
     and v_booking.hold_expires_at <= now() then
    perform pg_advisory_xact_lock(hashtext(v_booking.room_type_id::text));

    select count(*) into v_blocked
    from public.availability_blocks b
    where b.room_type_id = v_booking.room_type_id
      and b.start_date < v_booking.check_out
      and v_booking.check_in < b.end_date;

    select quantity into v_quantity
    from public.room_types where id = v_booking.room_type_id;

    select count(*) into v_overlapping
    from public.bookings bk
    where bk.room_type_id = v_booking.room_type_id
      and bk.id <> v_booking.id
      and bk.status in ('held', 'awaiting_confirmation', 'confirmed')
      and bk.check_in < v_booking.check_out
      and v_booking.check_in < bk.check_out
      and (bk.hold_expires_at is null or bk.hold_expires_at > now());

    if v_blocked > 0 or v_overlapping >= v_quantity then
      raise exception 'SLOT_TAKEN';
    end if;
  end if;

  -- Flip to confirmed. NULL hold_expires_at is essential (occupancy predicate).
  update public.bookings
  set status = 'confirmed', hold_expires_at = null
  where id = p_booking_id and status in ('held', 'awaiting_confirmation')
  returning * into v_booking;

  if not found then
    return null;   -- raced to a terminal/other status between the lock and here → no-op
  end if;

  insert into public.payments (
    tenant_id, booking_id, provider, provider_ref, amount, kind, status, raw_payload
  ) values (
    v_booking.tenant_id, v_booking.id, p_provider, p_provider_ref,
    coalesce(p_amount, v_expected), 'deposit', 'confirmed',
    p_raw_payload
  );

  -- Centralized accrual: split the grossed-up charge into the operator's payout + Tuloy's cut. SKIPPED
  -- for Xendit ('xendit') — the Split Rule already routed the commission to the Master at capture and
  -- the operator's share settled to their own sub-account, so there is nothing to accrue or disburse.
  if p_provider <> 'xendit' and v_booking.gateway_charge_amount is not null then
    select commission_rate, service_fee_rate into v_comm_rate, v_fee_rate
    from public.tenant_payout_accounts where tenant_id = v_booking.tenant_id;
    if found then
      v_commission  := round(v_booking.total_amount * v_comm_rate, 2);
      v_service_fee := round(v_booking.total_amount * v_fee_rate, 2);
      insert into public.payout_ledger (
        tenant_id, booking_id, stay_value, deposit_amount, operator_commission,
        guest_service_fee, paymongo_fee, owner_payout, clear_eta
      ) values (
        v_booking.tenant_id, v_booking.id, v_booking.total_amount, v_booking.deposit_amount,
        v_commission, v_service_fee,
        round(v_booking.gateway_charge_amount - v_booking.deposit_amount - v_service_fee, 2),
        round(v_booking.deposit_amount - v_commission, 2),
        public.add_banking_days(now(), 3)
      )
      on conflict (booking_id) do nothing;
    end if;
  end if;

  return v_booking;
end;
$$;
