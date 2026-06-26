-- Bulletproofing step 3: the authoritative money gate, INSIDE the one booking engine.
--
-- Both booking paths — the public guest flow (createPublicBooking) and the operator manual-entry flow
-- (createManualBooking, the "F2.2 core wedge") — go through this single create_booking_hold RPC
-- (architecture P7). Putting the guard here means a lapsed operator can take NO new booking by ANY path,
-- and it cannot be bypassed: there is no other way to insert a booking row. The tenant is derived
-- server-side from the room (v_room.tenant_id), never from caller input.
--
-- The decision is delegated to the single entitlement authority (tenant_subscription_entitlement), so
-- the engine and the read seams can never disagree. DORMANT by construction: while enforcement_mode='off'
-- can_accept_bookings is always true, so this raises for no one until the switch is deliberately flipped.
-- It is also LIVE-evaluated (no dependency on the daily cron), so there is no leak window if the cron lags.
--
-- Body copied verbatim from 20260617122600 with ONLY the guard added; the no-double-booking logic (P1)
-- is untouched. Signature unchanged → existing grants (service_role, anon) are retained.

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

  -- Subscription gate (the money rail): a lapsed-and-enforced operator can take no new booking, by any
  -- path. Delegated to the single entitlement authority; dormant while enforcement_mode='off'.
  if not (
    select e.can_accept_bookings
    from public.tenant_subscription_entitlement e
    where e.tenant_id = v_room.tenant_id
  ) then
    raise exception 'SUBSCRIPTION_LAPSED';
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
