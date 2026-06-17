-- F1.6 — Listing-detail enrichment. All additive (new nullable/defaulted columns + more JSON
-- keys on the public RPC). Lets operators showcase a property: standard check-in/out times,
-- a longer "about" blurb, and per-room photos (the room_types.photos column already exists).

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
-- Per-property standard times (the operator's "2pm to 2pm" rule). Defaulted so existing rows
-- get sensible values; the operator can override per property.
alter table public.properties
  add column check_in_time  time not null default '14:00',
  add column check_out_time time not null default '14:00',
  add column about          text;

-- room_types.photos (jsonb '[]') already exists (domain_schema). Value shape: an array of
-- storage path strings under the public 'property-images' bucket.

-- ---------------------------------------------------------------------------
-- get_public_listing — MODIFIED (F1.6): expose the new property fields and per-room photos.
-- Additive keys only; signature, language/volatility, and grants are unchanged (the anon
-- execute grant from public_booking is retained). Body otherwise identical to F1.4.
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
      'about', p.about,
      'check_in_time', p.check_in_time,
      'check_out_time', p.check_out_time,
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
            'photos', rt.photos,
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
