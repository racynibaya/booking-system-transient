-- Operator-controlled minimum-night stay (per-property). Replaces the hardcoded 2-night
-- guest-facing minimum (lib/pricing MIN_STAY_NIGHTS) with a per-property setting. Default 2
-- preserves the current behavior for every existing property; operators can lower it to 1 or
-- raise it. This is a PUBLIC-GUEST gate only — create_booking_hold stays min-stay-agnostic so the
-- manual/walk-in path can still record shorter stays.
--
-- Additive only: one new column + one additive JSON key ('min_stay_nights') in each public RPC.
-- Signature / language / volatility / security / grants all unchanged. The RPC bodies below are the
-- LIVE prod definitions (verified via pg_get_functiondef) with only the new key added.

alter table public.properties
  add column min_stay_nights smallint not null default 2
    check (min_stay_nights between 1 and 30);

create or replace function public.get_public_listing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'area', p.area,
      'address', p.address,
      'description', p.description,
      'about', p.about,
      'amenities', coalesce(p.amenities, '[]'::jsonb),
      'dot_accredited', p.dot_accredited,
      'facebook_url', p.facebook_url,
      'instagram_url', p.instagram_url,
      'tiktok_url', p.tiktok_url,
      'check_in_time', p.check_in_time,
      'check_out_time', p.check_out_time,
      'min_stay_nights', p.min_stay_nights,
      'cover_image_path', p.cover_image_path,
      'photos', coalesce(p.photos, '[]'::jsonb)
    ),
    'accepts_online_payment', (
      t.plan = 'business'
      and exists (
        select 1
        from public.tenant_gateway_connections c
        where c.tenant_id = t.id
          and c.status = 'active'
      )
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
  join public.tenants t on t.id = p.tenant_id
  where p.slug = p_slug
    and t.verification_status = 'approved'
    and not t.is_admin
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$function$;

create or replace function public.admin_preview_listing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'area', p.area,
      'address', p.address,
      'description', p.description,
      'about', p.about,
      'amenities', coalesce(p.amenities, '[]'::jsonb),
      'dot_accredited', p.dot_accredited,
      'facebook_url', p.facebook_url,
      'instagram_url', p.instagram_url,
      'tiktok_url', p.tiktok_url,
      'check_in_time', p.check_in_time,
      'check_out_time', p.check_out_time,
      'min_stay_nights', p.min_stay_nights,
      'cover_image_path', p.cover_image_path,
      'photos', coalesce(p.photos, '[]'::jsonb)
    ),
    'accepts_online_payment', (
      t.plan = 'business'
      and exists (
        select 1
        from public.tenant_gateway_connections c
        where c.tenant_id = t.id
          and c.status = 'active'
      )
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
  join public.tenants t on t.id = p.tenant_id
  where p.slug = p_slug
    and exists (
      select 1
      from public.tenants me
      where me.id = public.current_tenant_id()
        and me.is_admin
    );
$function$;
