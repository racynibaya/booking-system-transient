-- Bulletproofing step 2: repoint the public READ seams at the single entitlement authority.
--
-- Behavior-preserving refactor (no behavior change): while billing_config.enforcement_mode = 'off',
-- can_accept_bookings is true for every tenant, so both functions return exactly what they do today.
-- The point is to make a lapsed operator's page/grid card disappear THE SAME WAY the booking engine
-- will refuse them (step 3) — one decision, consulted everywhere, so the seams can never disagree.
--
--   * get_public_listing  — the /[slug] page: add `e.can_accept_bookings` to the visibility predicate
--                           (joined null → notFound(), same as the existing verification gate).
--   * list_public_listings — the marketplace grid: add the same gate (preserving the invariant "every
--                           card here resolves at /[slug]"), and source the ranking boost + featured
--                           flag from e.counts_as_paid (identical expression, now single-sourced).
--
-- admin_preview_listing is intentionally NOT gated — an admin must still preview a closed listing.
-- Bodies are copied verbatim from 20260626140000 / 20260624120100 with ONLY the entitlement wiring added.

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
  join public.tenant_subscription_entitlement e on e.tenant_id = t.id
  where p.slug = p_slug
    and t.verification_status = 'approved'
    and not t.is_admin
    and e.can_accept_bookings                                            -- the single entitlement gate
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$function$;

create or replace function public.list_public_listings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'area', p.area,
        'cover_image_path', p.cover_image_path,
        'from_price', (
          select min(rt.base_price)
          from public.room_types rt
          where rt.property_id = p.id
        ),
        -- visible badge for the boosted, actively-paying tiers (Pro/Business). Same gate as the boost.
        'featured', (
          e.counts_as_paid
          and t.plan in ('pro', 'business')
        )
      )
      order by
        -- daily pseudo-random roll in [0, 1)
        (('x' || substr(md5(p.id::text || current_date::text), 1, 7))::bit(28)::int)::float8 / 268435456.0
        -- minus the graded per-tier bonus (the edge); only granted to an actively-paying tier
        - (case
             when e.counts_as_paid then
               case t.plan
                 when 'business' then 0.30
                 when 'pro'      then 0.15
                 when 'solo'     then 0.05
                 else 0  -- free (retained post-pilot as a 1-room tier) / unknown
               end
             else 0
           end)
    ),
    '[]'::jsonb
  )
  from public.properties p
  join public.tenants t on t.id = p.tenant_id
  join public.tenant_subscription_entitlement e on e.tenant_id = t.id
  where t.verification_status = 'approved'
    and not t.is_admin
    and t.plan <> 'free'  -- discovery is a paid perk; Free keeps only its own /[slug] page
    and e.can_accept_bookings  -- a closed (lapsed) operator drops off the grid, mirroring /[slug]
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;

grant execute on function public.list_public_listings() to anon, authenticated;
