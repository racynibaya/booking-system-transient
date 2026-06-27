-- Slice 7 cutover (commission-only): remove the subscription enforcement guard from the booking engine.
--
-- WHY: the revenue model moved from subscription to commission. There is no "lapsed subscriber" to
-- block, so the SUBSCRIPTION_LAPSED gate added in 20260626150200 is removed. Body is identical to
-- 20260626150200 with ONLY the guard block deleted (i.e. back to the 20260617122600 body); the
-- no-double-booking logic (P1) and signature/grants are untouched. This drops the engine's dependency
-- on tenant_subscription_entitlement so that view + billing_config can be dropped later (Slice C).

create or replace function public.create_booking_hold(
  p_room_type_id uuid,
  p_check_in     date,
  p_check_out    date,
  p_num_guests   integer,
  p_guest_name   text,
  p_guest_phone  text default null,
  p_guest_email  text default null,
  p_hold_minutes integer default 15
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room        public.room_types;
  v_deposit_pct integer;
  v_nights      integer;
  v_total       numeric(10, 2);
  v_deposit     numeric(10, 2);
  v_overlapping integer;
  v_blocked     integer;
  v_booking     public.bookings;
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_RANGE';
  end if;

  select * into v_room from public.room_types where id = p_room_type_id;
  if not found then
    raise exception 'UNKNOWN_ROOM_TYPE';
  end if;

  if p_num_guests < 1 or p_num_guests > v_room.capacity then
    raise exception 'INVALID_GUESTS';
  end if;

  -- Deposit policy lives on the parent property.
  select deposit_percent into v_deposit_pct
  from public.properties where id = v_room.property_id;

  v_nights  := p_check_out - p_check_in;            -- whole nights (half-open)
  v_total   := round(v_room.base_price * v_nights, 2);
  v_deposit := round(v_total * v_deposit_pct / 100.0, 2);

  -- Serialize concurrent attempts for the same room type (xact-scoped lock).
  perform pg_advisory_xact_lock(hashtext(p_room_type_id::text));

  -- Operator-blocked dates make the room unbookable for the overlap.
  select count(*) into v_blocked
  from public.availability_blocks b
  where b.room_type_id = p_room_type_id
    and b.start_date < p_check_out
    and p_check_in   < b.end_date;
  if v_blocked > 0 then
    raise exception 'NO_AVAILABILITY';
  end if;

  -- Count live holds/awaiting/confirmed overlapping the requested half-open range.
  select count(*) into v_overlapping
  from public.bookings bk
  where bk.room_type_id = p_room_type_id
    and bk.status in ('held', 'awaiting_confirmation', 'confirmed')
    and bk.check_in < p_check_out
    and p_check_in  < bk.check_out
    and (bk.hold_expires_at is null or bk.hold_expires_at > now());
  if v_overlapping >= v_room.quantity then
    raise exception 'NO_AVAILABILITY';
  end if;

  insert into public.bookings (
    tenant_id, property_id, room_type_id,
    guest_name, guest_phone, guest_email,
    check_in, check_out, num_guests,
    status, hold_expires_at, total_amount, deposit_amount
  ) values (
    v_room.tenant_id, v_room.property_id, p_room_type_id,
    p_guest_name, p_guest_phone, p_guest_email,
    p_check_in, p_check_out, p_num_guests,
    'held', now() + make_interval(mins => p_hold_minutes), v_total, v_deposit
  )
  returning * into v_booking;

  return v_booking;
end;
$$;
