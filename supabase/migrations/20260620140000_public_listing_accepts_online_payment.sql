-- Phase 2b / M4 — tell the public listing whether a host can take an online deposit, so the guest
-- booking card knows whether to offer "Pay online". This is the ONLY non-secret signal the guest
-- side needs: true iff the host is Business-tier AND has an active per-tenant gateway connection.
-- We read only existence + status from tenant_gateway_connections (the secrets live in Vault, never
-- in this table), so nothing sensitive is exposed. Redefines get_public_listing to add one top-level
-- key; the rest is unchanged from 20260619200000_separate_admin_role.sql.

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
    and t.verification_status = 'approved'
    and not t.is_admin
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;
