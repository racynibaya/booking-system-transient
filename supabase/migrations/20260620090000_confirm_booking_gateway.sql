-- Phase 2a (hotel pro payments) — the gateway confirm seam. A PayMongo webhook (no operator
-- session) needs to confirm a paid booking automatically, the way the operator's manual
-- confirm_booking does today. One confirm CONTRACT, two callers (architecture P7):
--   * confirm_booking         — SECURITY INVOKER, operator session, from 'awaiting_confirmation'
--                               (proof flow). UNCHANGED by this migration.
--   * confirm_booking_gateway — SECURITY DEFINER, service_role (webhook), from 'held' OR
--                               'awaiting_confirmation' (gateway pays instantly, no proof step).
--
-- We deliberately do NOT refactor confirm_booking to share an insert helper here: it is working,
-- money-critical code, and a shared SECURITY INVOKER/DEFINER helper has nested-privilege
-- subtleties. The duplicated INSERT is ~6 lines; both paths are covered by integration tests.
-- Keep the two payment INSERTs in lockstep if either changes (kind='deposit', status='confirmed').
--
-- Idempotency (architecture P10) holds at three levels, same as the manual path:
--   1. status guard — UPDATE only WHERE status in ('held','awaiting_confirmation'); a duplicate
--      webhook lands on a 'confirmed' row, flips 0 rows, returns null → caller no-ops.
--   2. row lock — SELECT ... FOR UPDATE serializes a webhook racing the operator's manual confirm.
--   3. payments_one_deposit_per_booking unique index — the physical backstop: at most one deposit
--      payment per booking, so even a true double-insert race cannot create two.

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

  -- Amount guard (bulletproof inv. 3 — "what we record equals what was paid"). The caller passes
  -- the actually-settled amount in PESOS (the handler converts the event's centavos). If it does
  -- not match the deposit we stamped on the booking, REFUSE — never silently confirm a wrong-amount
  -- payment. The operator reconciles/refunds out-of-band (Tuloy isn't in the money, D8). When
  -- p_amount is null (reconcile/manual paths that don't carry it) we trust the stamped deposit.
  if p_amount is not null and p_amount <> v_booking.deposit_amount then
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
    coalesce(p_amount, v_booking.deposit_amount), 'deposit', 'confirmed',
    v_booking.proof_url, p_raw_payload
  );

  return v_booking;
end;
$$;

-- Webhook-only: the gateway handler calls this with the service-role key (no operator session).
-- No operator/anon/public grant — operators confirm through confirm_booking, never this.
revoke execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  to service_role;
