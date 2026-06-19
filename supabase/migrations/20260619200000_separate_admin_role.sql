-- F2.x — Hard role separation: an is_admin account is purely an admin, never an operator. Exclude
-- is_admin tenants from the operator review queue, the platform operator counts, and the public
-- listing gate (an admin should never appear as an operator or have a public booking page).
-- create-or-replace keeps the existing grants from the originating migrations.

-- 1) Operator review queue — drop admins.
create or replace function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  verification_note text,
  gcash_changed_at timestamptz,
  gcash_name text,
  gcash_number text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, u.email::text, t.verification_status, t.verification_note,
         t.gcash_changed_at, t.gcash_name, t.gcash_number, t.created_at
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where public.is_current_user_admin() and not t.is_admin
  order by
    case
      when t.verification_status in ('pending', 'changes_requested') then 0
      when t.gcash_changed_at is not null then 0
      when t.verification_status = 'suspended' then 1
      else 2
    end,
    t.created_at desc;
$$;

-- 2) Platform stats — operator counts exclude admins (booking aggregates unchanged).
create or replace function public.admin_platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      'operators', jsonb_build_object(
        'total', (select count(*) from public.tenants where not is_admin),
        'pending', (select count(*) from public.tenants
            where verification_status = 'pending' and not is_admin),
        'approved', (select count(*) from public.tenants
            where verification_status = 'approved' and not is_admin),
        'suspended', (select count(*) from public.tenants
            where verification_status = 'suspended' and not is_admin),
        'changes_requested', (select count(*) from public.tenants
            where verification_status = 'changes_requested' and not is_admin),
        'gcash_flagged', (select count(*) from public.tenants
            where verification_status = 'approved' and gcash_changed_at is not null and not is_admin)
      ),
      'bookings', jsonb_build_object(
        'confirmed', (select count(*) from public.bookings where status = 'confirmed'),
        'awaiting', (select count(*) from public.bookings where status = 'awaiting_confirmation'),
        'gmv',
          (select coalesce(sum(total_amount), 0) from public.bookings where status = 'confirmed'),
        'deposits',
          (select coalesce(sum(deposit_amount), 0) from public.bookings
            where status in ('awaiting_confirmation', 'confirmed')),
        'upcoming',
          (select count(*) from public.bookings
            where status = 'confirmed' and check_in >= current_date)
      )
    )
  end;
$$;

-- 3) Public listing gate — same as 20260619160000 plus `and not t.is_admin`.
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
    and not t.is_admin
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;
