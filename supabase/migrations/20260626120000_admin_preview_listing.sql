-- Admin preview of the public listing page.
--
-- The guest-facing /[slug] page reads get_public_listing, which hides any operator that isn't
-- verification_status='approved'. That means an admin can't see an UNVERIFIED operator's real,
-- guest-rendered page to vet it for trolls/malice before approving.
--
-- admin_preview_listing returns the SAME jsonb shape as get_public_listing, but WITHOUT the
-- visibility gate — and only to a caller who is_admin (self-guarded via current_tenant_id()).
-- The page falls back to this RPC (on the authenticated client) when the public one returns null,
-- so anonymous visitors still 404 and only an admin sees the gated listing.
--
-- NOTE: the body is intentionally a copy of get_public_listing's SELECT (minus the WHERE gate) so
-- this read-only preview never touches the live public RPC. If the public listing shape changes,
-- mirror it here too.
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
      'cover_image_path', p.cover_image_path
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
    -- self-guard: only an admin caller gets a gated listing back
    and exists (
      select 1
      from public.tenants me
      where me.id = public.current_tenant_id()
        and me.is_admin
    );
$function$;

revoke execute on function public.admin_preview_listing(text) from public, anon;
grant execute on function public.admin_preview_listing(text) to authenticated;
