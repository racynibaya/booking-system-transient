-- F0.2 — Schema, RLS & the booking RPC (M0). The permanent layer (architecture P4).
-- Builds on F0.1 (public.tenants, public.current_tenant_id()).
--
-- Design: every table carries a denormalized tenant_id so RLS is one uniform predicate
-- (tenant_id = current_tenant_id()). Consistency with the parent chain is enforced
-- declaratively by COMPOSITE foreign keys (no triggers, no drift): a child row's
-- (parent_id, tenant_id) must match an existing parent (id, tenant_id). Dates are `date`,
-- ranges are half-open [check_in, check_out); all server logic runs in Asia/Manila.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.booking_status as enum (
  'pending', 'held', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show'
);
create type public.payment_kind as enum ('deposit', 'balance');

-- ---------------------------------------------------------------------------
-- properties — a place an operator runs
-- ---------------------------------------------------------------------------
create table public.properties (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  name           text not null,
  slug           text not null unique,           -- public URL, a one-way contract (F1.1)
  area           text,
  address        text,
  description    text,
  dot_accredited boolean not null default false,
  amenities      jsonb not null default '[]'::jsonb,
  photos         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  unique (id, tenant_id)                          -- composite-FK target for children
);

-- ---------------------------------------------------------------------------
-- room_types — a sellable unit category within a property
-- ---------------------------------------------------------------------------
create table public.room_types (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  property_id uuid not null,
  name        text not null,
  capacity    integer not null check (capacity > 0),
  quantity    integer not null check (quantity > 0),  -- # identical interchangeable units
  base_price  numeric(10, 2) not null check (base_price >= 0),
  description text,
  photos      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  -- tenant_id must match the property's tenant (declarative, no drift)
  foreign key (property_id, tenant_id)
    references public.properties (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- bookings — a reservation (holds the money + status lifecycle)
-- ---------------------------------------------------------------------------
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  property_id     uuid not null,
  room_type_id    uuid not null,
  guest_name      text not null,
  guest_phone     text,
  guest_email     text,
  check_in        date not null,
  check_out       date not null,
  num_guests      integer not null check (num_guests > 0),
  status          public.booking_status not null default 'pending',
  hold_expires_at timestamptz,                    -- null unless status = 'held'
  total_amount    numeric(10, 2),
  deposit_amount  numeric(10, 2),
  created_at      timestamptz not null default now(),
  unique (id, tenant_id),
  check (check_out > check_in),
  foreign key (property_id, tenant_id)
    references public.properties (id, tenant_id) on delete cascade,
  foreign key (room_type_id, tenant_id)
    references public.room_types (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- payments — money recorded against a booking (we record, never hold — P3)
-- ---------------------------------------------------------------------------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  booking_id   uuid not null,
  provider     text not null,
  provider_ref text,
  amount       numeric(10, 2) not null,
  kind         public.payment_kind not null,
  status       text not null,                     -- provider-defined
  proof_url    text,
  raw_payload  jsonb,
  created_at   timestamptz not null default now(),
  foreign key (booking_id, tenant_id)
    references public.bookings (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- availability_blocks — operator marks dates unavailable (maintenance, personal use)
-- ---------------------------------------------------------------------------
create table public.availability_blocks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  room_type_id uuid not null,
  start_date   date not null,
  end_date     date not null,
  reason       text,
  created_at   timestamptz not null default now(),
  check (end_date > start_date),
  foreign key (room_type_id, tenant_id)
    references public.room_types (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Indexes — tenant_id for RLS; the overlap hot path; FK columns
-- ---------------------------------------------------------------------------
create index on public.properties (tenant_id);
create index on public.room_types (tenant_id);
create index on public.room_types (property_id);
create index on public.bookings (tenant_id);
create index on public.bookings (room_type_id, status, check_in, check_out);
create index on public.payments (tenant_id);
create index on public.payments (booking_id);
create index on public.availability_blocks (tenant_id);
create index on public.availability_blocks (room_type_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- RLS — uniform operator scoping. (select current_tenant_id()) is an initplan,
-- evaluated once per statement. anon gets NO access (public path is F1.3).
-- Grants are explicit: RLS restricts rows, but a GRANT is what makes the table
-- reachable at all (F0.1 lesson).
-- ---------------------------------------------------------------------------

-- properties / room_types / availability_blocks: full operator CRUD.
do $$
declare t text;
begin
  foreach t in array array['properties', 'room_types', 'availability_blocks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy "%1$s_select_own" on public.%1$I for select
      to authenticated using (tenant_id = (select public.current_tenant_id()))$f$, t);
    execute format($f$create policy "%1$s_insert_own" on public.%1$I for insert
      to authenticated with check (tenant_id = (select public.current_tenant_id()))$f$, t);
    execute format($f$create policy "%1$s_update_own" on public.%1$I for update
      to authenticated using (tenant_id = (select public.current_tenant_id()))
      with check (tenant_id = (select public.current_tenant_id()))$f$, t);
    execute format($f$create policy "%1$s_delete_own" on public.%1$I for delete
      to authenticated using (tenant_id = (select public.current_tenant_id()))$f$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- bookings: operator reads + updates own; INSERT only via create_booking_hold (P1 —
-- never check-then-write in app code). No insert/delete grant to authenticated.
alter table public.bookings enable row level security;
create policy "bookings_select_own" on public.bookings for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "bookings_update_own" on public.bookings for update
  to authenticated using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
grant select, update on public.bookings to authenticated;
grant all on public.bookings to service_role;

-- payments: operator reads + inserts own (recorded on confirm, F1.4). Immutable
-- money record: no update/delete grant.
alter table public.payments enable row level security;
create policy "payments_select_own" on public.payments for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "payments_insert_own" on public.payments for insert
  to authenticated with check (tenant_id = (select public.current_tenant_id()));
grant select, insert on public.payments to authenticated;
grant all on public.payments to service_role;

-- ---------------------------------------------------------------------------
-- create_booking_hold — the one atomic operation behind "no double-booking" (P1).
-- SECURITY DEFINER so the same engine serves operators (manual entry) and, later,
-- anonymous guests (F1.3) — it sets tenant_id itself and is the only writer of
-- bookings. Hardened: empty search_path, schema-qualified. Coded error strings.
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

  -- Count live holds/confirmed overlapping the requested half-open range.
  select count(*) into v_overlapping
  from public.bookings bk
  where bk.room_type_id = p_room_type_id
    and bk.status in ('held', 'confirmed')
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
    status, hold_expires_at
  ) values (
    v_room.tenant_id, v_room.property_id, p_room_type_id,
    p_guest_name, p_guest_phone, p_guest_email,
    p_check_in, p_check_out, p_num_guests,
    'held', now() + make_interval(mins => p_hold_minutes)
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Lock down the SECURITY DEFINER function: not a public RPC. In F0.2 only the server
-- (service_role) calls it — the concurrency test, and later trusted server code.
-- Grant execute to `authenticated` in F2.2 (operator manual entry) and to `anon` in
-- F1.3 (public booking page) when those callers actually exist. Revoke from public,
-- anon, authenticated explicitly: Supabase's default privileges grant execute to
-- anon/authenticated on new public functions, so revoking `public` alone leaves them.
revoke execute on function public.create_booking_hold(
  uuid, date, date, integer, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_booking_hold(
  uuid, date, date, integer, text, text, text, integer
) to service_role;
