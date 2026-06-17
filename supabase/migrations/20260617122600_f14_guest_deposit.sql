-- F1.4 — Guest deposit (GCash pass-through). The permanent layer (architecture P4).
-- Pass-through: we RECORD money, never hold it (P3). Builds on the 'awaiting_confirmation'
-- enum value added in the previous migration.
--
-- Lifecycle: create_booking_hold → 'held' (15/30-min) → guest uploads proof → submit_proof
-- → 'awaiting_confirmation' (occupies inventory, no expiry) → operator confirm_booking →
-- 'confirmed' + one immutable deposit payment row (idempotent, P10).

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
-- Per-property deposit policy (F1.4 decision): deposit = total * percent / 100.
alter table public.properties
  add column deposit_percent integer not null default 50
    check (deposit_percent between 0 and 100);

-- Pre-confirmation proof handle. Lives on the booking until confirm_booking copies it into
-- the payments row — payments stays the record of CONFIRMED money only (P3).
alter table public.bookings
  add column proof_url text;

-- Operator GCash payout identity (tenant-level: one operator, one GCash, many properties).
-- Delivered to the guest WITH the hold response, never via the public listing (anti-scrape).
alter table public.tenants
  add column gcash_name   text,
  add column gcash_number text,
  add column gcash_qr_path text;

-- Idempotency floor for the money seam (P10): at most one deposit payment per booking.
-- confirm_booking's status guard prevents the second confirm; this index makes a concurrent
-- double-confirm physically impossible.
create unique index payments_one_deposit_per_booking
  on public.payments (booking_id)
  where kind = 'deposit';

-- ---------------------------------------------------------------------------
-- Storage: PRIVATE bucket for payment proofs (screenshots can contain the guest's GCash
-- name/number/reference — never public-read). Guests upload via a service-role Server
-- Action (bypasses RLS); operators read their own tenant's proofs via signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Operator reads only objects under their own tenant folder: {tenant_id}/{booking_id}/...
create policy "payment_proofs_tenant_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

-- ---------------------------------------------------------------------------
-- create_booking_hold — MODIFIED (F1.4). Two additive changes, the overlap logic (P1) is
-- otherwise untouched:
--   1. stamp total_amount/deposit_amount from the property's deposit_percent (P5).
--   2. count 'awaiting_confirmation' as occupying inventory (paired with get_public_listing).
-- Signature unchanged → existing grants (service_role, anon) are retained.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- get_public_listing — MODIFIED (F1.4): 'awaiting_confirmation' counts as taken on the
-- public calendar, paired with create_booking_hold's overlap predicate (the double-booking
-- pair — both must list the same statuses). Signature unchanged → grants retained.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_listing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'area', p.area,
      'address', p.address,
      'description', p.description,
      'cover_image_path', p.cover_image_path
    ),
    'room_types', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rt.id,
            'name', rt.name,
            'capacity', rt.capacity,
            'quantity', rt.quantity,
            'base_price', rt.base_price,
            'description', rt.description,
            'bookings', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('check_in', b.check_in, 'check_out', b.check_out)
                )
                from public.bookings b
                where b.room_type_id = rt.id
                  and b.status in ('held', 'awaiting_confirmation', 'confirmed')
                  and (b.hold_expires_at is null or b.hold_expires_at > now())
                  and b.check_out >= current_date
              ),
              '[]'::jsonb
            ),
            'blocks', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('start_date', ab.start_date, 'end_date', ab.end_date)
                )
                from public.availability_blocks ab
                where ab.room_type_id = rt.id
                  and ab.end_date >= current_date
              ),
              '[]'::jsonb
            )
          )
          order by rt.created_at
        )
        from public.room_types rt
        where rt.property_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from public.properties p
  where p.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- submit_proof — NEW. The anonymous guest's proof handle (booking id = capability).
-- SECURITY DEFINER (writes across RLS for an anon caller), hardened search_path. Called by
-- the Server Action after it uploads the screenshot (service-role) to payment-proofs.
--   held + live           → awaiting_confirmation
--   held + expired + free → re-validates, then awaiting_confirmation (paid-but-expired rescue)
--   held + expired + gone → SLOT_TAKEN (guest told not to pay / to contact host)
--   already awaiting       → idempotent: refresh proof_url, return
-- ---------------------------------------------------------------------------
create or replace function public.submit_proof(
  p_booking_id uuid,
  p_proof_url  text
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

  -- Idempotent: proof already accepted, just (re)attach the latest upload.
  if v_booking.status = 'awaiting_confirmation' then
    update public.bookings set proof_url = p_proof_url
    where id = p_booking_id
    returning * into v_booking;
    return v_booking;
  end if;

  if v_booking.status <> 'held' then
    raise exception 'NOT_HELD';
  end if;

  -- Paid-but-expired rescue: if the hold lapsed, re-check the slot is still free before
  -- committing the proof (serialize on the room type, exclude this booking).
  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at <= now() then
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

  update public.bookings
  set status = 'awaiting_confirmation', proof_url = p_proof_url, hold_expires_at = null
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke execute on function public.submit_proof(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_proof(uuid, text) to anon, service_role;

-- ---------------------------------------------------------------------------
-- confirm_booking — NEW. Operator confirms a paid booking. SECURITY INVOKER so operator RLS
-- applies (can only touch own-tenant rows). Atomic: flip status + record the deposit payment.
-- Idempotent via the status guard (a second call updates 0 rows → no-op, returns null) and,
-- under a true race, the payments_one_deposit_per_booking unique index.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking(
  p_booking_id   uuid,
  p_amount       numeric default null,
  p_provider_ref text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
  set status = 'confirmed'
  where id = p_booking_id and status = 'awaiting_confirmation'
  returning * into v_booking;

  if not found then
    return null;   -- already confirmed (or not awaiting) → idempotent no-op
  end if;

  insert into public.payments (
    tenant_id, booking_id, provider, provider_ref, amount, kind, status, proof_url
  ) values (
    v_booking.tenant_id, v_booking.id, 'gcash_manual', p_provider_ref,
    coalesce(p_amount, v_booking.deposit_amount), 'deposit', 'confirmed', v_booking.proof_url
  );

  return v_booking;
end;
$$;

revoke execute on function public.confirm_booking(uuid, numeric, text) from public, anon;
grant execute on function public.confirm_booking(uuid, numeric, text) to authenticated, service_role;
