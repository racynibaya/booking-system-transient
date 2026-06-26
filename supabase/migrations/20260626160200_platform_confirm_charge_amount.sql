-- Centralized-aggregator pivot / Slice 3 — make the gateway confirm verify the GROSSED-UP charge.
--
-- In the centralized model the guest is charged the deposit + a service fee (grossed up to absorb the
-- PayMongo fee) — not the bare deposit. createPlatformCheckout stamps that exact charge on the
-- booking as gateway_charge_amount; the webhook then reports it as the settled amount. The existing
-- amount guard compared the settled amount to deposit_amount and would reject every centralized
-- payment as AMOUNT_MISMATCH. We change it to verify against coalesce(gateway_charge_amount,
-- deposit_amount): Model A (per-tenant) leaves the column NULL and behaves EXACTLY as before (verify
-- against the deposit); the centralized path verifies against the real charge. Everything else in the
-- RPC is copied verbatim from 20260620090000_confirm_booking_gateway.sql.

alter table public.bookings
  add column if not exists gateway_charge_amount numeric(10, 2);

comment on column public.bookings.gateway_charge_amount is
  'Centralized aggregator: the grossed-up amount the guest is charged online (deposit + service fee + '
  'absorbed PayMongo fee), stamped at checkout. NULL for the manual/proof path and the dormant Model-A '
  'per-tenant gateway, where the charge is the bare deposit.';

create or replace function public.confirm_booking_gateway(
  p_booking_id   uuid,
  p_provider     text,
  p_provider_ref text default null,
  p_amount       numeric default null,
  p_raw_payload  jsonb default null
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
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'UNKNOWN_BOOKING';
  end if;

  -- Idempotent: the deposit is already confirmed (a replayed webhook) → no-op.
  if v_booking.status = 'confirmed' then
    return null;
  end if;

  -- Only a live hold or a proof-submitted booking can be confirmed by a payment.
  if v_booking.status not in ('held', 'awaiting_confirmation') then
    raise exception 'NOT_CONFIRMABLE';
  end if;

  -- Amount guard (bulletproof inv. 3 — "what we record equals what was paid"). The caller passes the
  -- actually-settled amount in PESOS. We verify it against the amount we charged: the stamped
  -- gateway_charge_amount (centralized: deposit + service fee, grossed up) when present, else the bare
  -- deposit (Model A / manual). Mismatch → REFUSE; the guest is refunded out-of-band. NULL p_amount
  -- (reconcile/manual paths) trusts the stamped value.
  v_expected := coalesce(v_booking.gateway_charge_amount, v_booking.deposit_amount);
  if p_amount is not null and p_amount <> v_expected then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- Paid-but-expired rescue (mirrors submit_proof): a webhook can land after the hold lapsed.
  -- Re-validate the slot is still free before committing the money, serialized on the room type
  -- and excluding this booking. If it was taken in the gap, refuse — the operator refunds the
  -- guest out-of-band (Tuloy isn't in the money, DESIGN D8).
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

  -- Flip to confirmed. NULL hold_expires_at is essential: the occupancy predicate counts a
  -- 'confirmed' row only WHILE (hold_expires_at is null or > now()), so a confirmed booking whose
  -- original hold window has passed would otherwise stop blocking inventory → double-booking.
  update public.bookings
  set status = 'confirmed', hold_expires_at = null
  where id = p_booking_id and status in ('held', 'awaiting_confirmation')
  returning * into v_booking;

  if not found then
    return null;   -- raced to a terminal/other status between the lock and here → no-op
  end if;

  insert into public.payments (
    tenant_id, booking_id, provider, provider_ref, amount, kind, status, proof_url, raw_payload
  ) values (
    v_booking.tenant_id, v_booking.id, p_provider, p_provider_ref,
    coalesce(p_amount, v_expected), 'deposit', 'confirmed',
    v_booking.proof_url, p_raw_payload
  );

  return v_booking;
end;
$$;

revoke execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  to service_role;
