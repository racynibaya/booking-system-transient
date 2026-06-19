-- ===========================================================================
-- LOCAL DEV / DEMO SEED — 200 operators + properties, room types & bookings.
--
-- Runs automatically on `npm run db:reset` (config.toml -> db.seed.sql_paths).
--
-- LOCAL ONLY. This inserts directly into auth.users (a local-dev pattern) and is
-- never meant to run against the cloud/prod database. Do NOT apply with --linked.
--
-- Model recap (see migrations): one operator = one auth.users row; the
-- on_auth_user_created trigger auto-creates the matching public.tenants row.
-- A property is publicly visible only when its tenant is `approved` AND
-- gcash_changed_at IS NULL — so we set verification + GCash in ONE update while
-- the row is still `pending` (the flag_gcash_change trigger only fires on
-- approved -> approved, so gcash_changed_at stays null).
--
-- All seeded operators share the password:  password123
-- Emails:  seed-op-1@example.com ... seed-op-200@example.com
-- Admin:   seed-op-1@example.com  (is_admin = true, approved)
-- ===========================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 0. Re-runnability guard. Deleting the seed auth users cascades down through
--    tenants -> properties -> room_types -> bookings -> payments. Targets only
--    the seed emails, so it can never touch real operators. No-op on a fresh reset.
-- ---------------------------------------------------------------------------
delete from auth.users where email like 'seed-op-%@example.com';

-- ---------------------------------------------------------------------------
-- 1. 200 auth users (+ matching identities). The signup trigger creates a
--    public.tenants row for each. Name comes from raw_user_meta_data.name.
-- ---------------------------------------------------------------------------
with cfg as (
  select
    array['Maria','Jose','Juan','Ana','Pedro','Rosa','Carlo','Liza','Mark','Grace',
          'Paolo','Nora','Ramon','Cecilia','Andres','Divina','Noel','Teresa','Victor','Imelda']::text[] as firsts,
    array['Santos','Reyes','Cruz','Bautista','Ramos','Garcia','Mendoza','Torres','Flores','Castillo',
          'Villanueva','Aquino','Domingo','Salvador','Navarro','Ibañez','del Rosario','Macaraeg','Pascua','Aspiras']::text[] as lasts
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'seed-op-' || g || '@example.com',
    crypt('password123', gen_salt('bf')),
    now() - (make_interval(days => (200 - g))),         -- staggered "signup" dates
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'name',
      (select firsts from cfg)[1 + (g % 20)] || ' ' || (select lasts from cfg)[1 + ((g / 2) % 20)]
    ),
    now() - (make_interval(days => (200 - g))),
    now(),
    '', '', '', ''
  from generate_series(1, 200) as g
  returning id, email
)
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  nu.id::text,
  nu.id,
  jsonb_build_object('sub', nu.id::text, 'email', nu.email, 'email_verified', true),
  'email',
  now(), now(), now()
from new_users nu;

-- ---------------------------------------------------------------------------
-- 2. Promote + configure the tenants the trigger just created.
--    Verification mix (by n % 20): 16 approved / 2 pending / 1 changes_requested
--    / 1 suspended  ==  80% / 10% / 5% / 5%.
--    GCash set in this SAME update (while still 'pending') so gcash_changed_at
--    stays null and approved operators remain publicly visible.
-- ---------------------------------------------------------------------------
update public.tenants t set
  verification_status = (case (u.n % 20)
      when 16 then 'pending'
      when 17 then 'pending'
      when 18 then 'changes_requested'
      when 19 then 'suspended'
      else 'approved'
    end)::public.tenant_verification,
  verification_note = case
      when (u.n % 20) = 18 then 'Please re-upload a clearer government ID and a valid business permit.'
      when (u.n % 20) = 19 then 'Listing suspended pending review of guest reports.'
      else null
    end,
  gcash_name = t.name,
  gcash_number = '09' || lpad(((u.n * 123457) % 1000000000)::text, 9, '0'),
  gcash_changed_at = null
from (
  select id as user_id, replace(split_part(email, '@', 1), 'seed-op-', '')::int as n
  from auth.users
  where email like 'seed-op-%@example.com'
) u
where t.user_id = u.user_id;

-- Exactly one admin (operator #1), kept approved so it also has a live listing.
update public.tenants set is_admin = true
where user_id = (select id from auth.users where email = 'seed-op-1@example.com');

-- ---------------------------------------------------------------------------
-- 3. Properties — 1-2 per operator. Slug is name-derived + n + pidx (unique).
-- ---------------------------------------------------------------------------
with ops as (
  select t.id as tenant_id,
         replace(split_part(u.email, '@', 1), 'seed-op-', '')::int as n
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where u.email like 'seed-op-%@example.com'
),
cfg as (
  select
    array['Urbiztondo','Taboo','Ili Norte','Ili Sur','Poblacion','Montemar','Sabangan','Bacnotan Road']::text[] as areas,
    array['Surf','Beachfront','Sunset','Seaside','Wave','Coastal','Breeze','Tide','Driftwood','Bamboo']::text[] as vibes,
    array['House','Inn','Hostel','Villa','Lodge','Homestay','Suites','Beach Inn','Surf Camp','Cottages']::text[] as kinds,
    array['Wifi','Air Conditioning','Hot Shower','Free Parking','Surfboard Rental','Breakfast Included',
          'Swimming Pool','Beach Access','Common Kitchen','24/7 Reception','Motorbike Rental','Pet Friendly']::text[] as amenpool
)
insert into public.properties (
  tenant_id, name, slug, area, address, description, about,
  amenities, dot_accredited, deposit_percent,
  facebook_url, instagram_url
)
select
  o.tenant_id,
  c.areas[1 + (k % 8)] || ' ' || c.vibes[1 + ((k / 2) % 10)] || ' ' || c.kinds[1 + ((k / 3) % 10)],
  lower(regexp_replace(
    c.areas[1 + (k % 8)] || '-' || c.vibes[1 + ((k / 2) % 10)] || '-' || c.kinds[1 + ((k / 3) % 10)],
    '[^a-zA-Z0-9]+', '-', 'g'
  )) || '-' || o.n || '-' || pidx,
  c.areas[1 + (k % 8)],
  c.areas[1 + (k % 8)] || ', San Juan, La Union',
  'A cozy transient spot in ' || c.areas[1 + (k % 8)] || ', steps from the surf break — ideal for weekend travelers and surfers.',
  'Family-run accommodation in San Juan, La Union. Walking distance to surf schools, cafes, and the beach. Quiet at night, friendly hosts, and the essentials done right.',
  to_jsonb(c.amenpool[1 : 3 + (k % 6)]),
  (k % 3 = 0),
  case when k % 2 = 0 then 50 else 30 end,
  'https://facebook.com/' || lower(regexp_replace(c.areas[1 + (k % 8)] || c.kinds[1 + ((k / 3) % 10)], '[^a-zA-Z0-9]+', '', 'g')),
  case when k % 2 = 0 then 'https://instagram.com/sanjuan.stays' else null end
from ops o
cross join cfg c
cross join lateral generate_series(1, 1 + (o.n % 2)) as pidx
cross join lateral (select (o.n * 7 + pidx) as k) kk;

-- ---------------------------------------------------------------------------
-- 4. Room types — 2-4 per property.
-- ---------------------------------------------------------------------------
with cfg as (
  select array['Surf Dorm Bed','Standard Fan Room','Aircon Double','Family Room',
               'Deluxe Suite','Garden Cottage','Twin Room','Loft for Two']::text[] as names
)
insert into public.room_types (
  tenant_id, property_id, name, capacity, quantity, base_price, description
)
select
  p.tenant_id,
  p.id,
  c.names[1 + ((rr.rh / (ridx)) % 8)::int],
  (2 + ((rr.rh + ridx) % 7))::int,                                  -- capacity 2..8
  (1 + ((rr.rh + ridx) % 6))::int,                                  -- quantity 1..6
  round((800 + ((rr.rh + ridx * 13) % 43) * 100)::numeric, 2),      -- ₱800..₱5000
  'Comfortable ' || c.names[1 + ((rr.rh / (ridx)) % 8)::int] || ' with daily housekeeping and fresh linens.'
from public.properties p
cross join cfg c
cross join lateral (select abs(hashtext(p.id::text)::bigint) as rh) rr
cross join lateral generate_series(1, 2 + (rr.rh % 3)::int) as ridx;

-- ---------------------------------------------------------------------------
-- 5. Bookings — ~3-5 per room type, windows spaced 16 days so held/confirmed
--    rows don't overlap within a room type. Status keyed off date vs today.
-- ---------------------------------------------------------------------------
with gn as (
  select
    array['Mark','Anna','Liam','Sofia','Diego','Hana','Ken','Mai','Ravi','Bea',
          'Tom','Yuki','Sam','Nina','Leo','Ivy','Gabe','Mira','Theo','Joy']::text[] as firsts,
    array['Tan','Lee','Reyes','Cruz','Kim','Lim','Garcia','Wong','Patel','Santos',
          'Ong','Yu','Dela Cruz','Chua','Ramos','Sy','Uy','Co','Lao','Tiu']::text[] as lasts
)
insert into public.bookings (
  tenant_id, property_id, room_type_id,
  guest_name, guest_phone, guest_email,
  check_in, check_out, num_guests,
  status, hold_expires_at, total_amount, deposit_amount
)
select
  rt.tenant_id,
  rt.property_id,
  rt.id,
  g2.guest_name,
  '+639' || lpad((jj.h % 1000000000)::text, 9, '0'),
  lower(replace(g2.guest_name, ' ', '.')) || (jj.h % 1000)::text || '@example.com',
  win.ci,
  win.co,
  (1 + (jj.h % rt.capacity))::int,
  stt.st::public.booking_status,
  case when stt.st = 'held' then now() + interval '15 minutes' else null end,
  round(rt.base_price * win.nights, 2),
  round(rt.base_price * win.nights * p.deposit_percent / 100.0, 2)
from public.room_types rt
join public.properties p on p.id = rt.property_id
cross join gn
cross join lateral (select abs(hashtext(rt.id::text)::bigint) as rh) rr
cross join lateral generate_series(1, 3 + (rr.rh % 3)::int) as bidx
cross join lateral (select abs(hashtext(rt.id::text || '#' || bidx::text)::bigint) as h) jj
cross join lateral (
  select
    (current_date - 35 + (bidx - 1) * 16 + (jj.h % 3)::int)::date as ci,
    (1 + ((jj.h / 3) % 4))::int as nights
) base
cross join lateral (
  select base.ci, (base.ci + base.nights)::date as co, base.nights
) win
cross join lateral (
  select case
    when win.co < current_date
      then (array['completed','completed','completed','completed','completed','completed','completed','cancelled','no_show','expired'])[1 + (jj.h % 10)::int]
    when win.ci <= current_date
      then 'confirmed'
    when win.ci <= current_date + 14
      then (array['held','awaiting_confirmation','confirmed','confirmed','pending'])[1 + (jj.h % 5)::int]
    else (array['pending','cancelled','confirmed','confirmed'])[1 + (jj.h % 4)::int]
  end as st
) stt
cross join lateral (
  select gn.firsts[1 + (jj.h % 20)::int] || ' ' || gn.lasts[1 + ((jj.h / 2) % 20)::int] as guest_name
) g2;

-- ---------------------------------------------------------------------------
-- 6. Payments — one confirmed deposit per confirmed/completed booking
--    (the unique deposit-per-booking index is satisfied: one per booking).
-- ---------------------------------------------------------------------------
insert into public.payments (
  tenant_id, booking_id, provider, provider_ref, amount, kind, status, proof_url
)
select
  b.tenant_id,
  b.id,
  'gcash_manual',
  'REF-' || upper(substr(md5(b.id::text), 1, 8)),
  b.deposit_amount,
  'deposit',
  'confirmed',
  null
from public.bookings b
where b.status in ('confirmed', 'completed')
  and b.deposit_amount is not null;

-- ---------------------------------------------------------------------------
-- 7. A few future availability blocks for board realism.
-- ---------------------------------------------------------------------------
insert into public.availability_blocks (
  tenant_id, room_type_id, start_date, end_date, reason
)
select
  rt.tenant_id,
  rt.id,
  current_date + 20,
  current_date + 23,
  'Maintenance'
from public.room_types rt
where abs(hashtext(rt.id::text)::bigint) % 11 = 0;
