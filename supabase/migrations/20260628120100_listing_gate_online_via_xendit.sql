-- Xendit commission rail / Slice 1 step 6a — flip the public listing's online-payment signal from the
-- aggregator condition (an active tenant_payout_accounts destination) to the Xendit one: the operator
-- has a LIVE sub-account (tenant_xendit_accounts.kyc_status = 'LIVE'). In xenPlatform the guest charge
-- is created on that sub-account, so only a LIVE-KYC operator can accept online — and the page still
-- ANDs the platform key being configured (env, can't be checked in SQL), so it stays dark until cutover.
--
-- The whole listing already returns null unless the operator is verification_status='approved' (the
-- WHERE clause), so accepts_online_payment is the AND of "Tuloy-approved" (row exists at all) AND
-- "Xendit-LIVE" (this flag). Body is copied verbatim from the live definition (verified via
-- pg_get_functiondef, not the drifted migration files); ONLY the accepts_online_payment subquery changes.
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
    'accepts_online_payment', exists (
      select 1
      from public.tenant_xendit_accounts xa
      where xa.tenant_id = t.id
        and xa.kyc_status = 'LIVE'
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
