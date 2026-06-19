-- F1.13 — Widen the GCash re-verify grace window 24h → 3 days, and add an admin-recipients lookup
-- so the app can email admins when a live operator changes their GCash (review runway).

-- get_public_listing — same as 20260619150000 but the GCash grace is now 3 days.
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
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;

-- Admin email recipients, for server-side notifications (e.g. a GCash change). SECURITY DEFINER to
-- read auth.users; service-role only so it never leaks admin emails to operators.
create or replace function public.admin_notification_recipients()
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where t.is_admin and u.email is not null;
$$;
revoke execute on function public.admin_notification_recipients() from anon, authenticated;
grant execute on function public.admin_notification_recipients() to service_role;
