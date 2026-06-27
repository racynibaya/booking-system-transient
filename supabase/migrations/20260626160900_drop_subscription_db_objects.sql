-- Slice 7 cutover (commission-only): drop the subscription billing + entitlement DB objects, and
-- de-subscription the few remaining functions that still reference plan / subscription_status.
--
-- Ordering: recreate the readers that reference the dropped columns/objects FIRST (so they no longer
-- depend on them), then drop the subscription-only functions, then the entitlement function → view →
-- billing_config table. This must run after 160700 (booking guard removed) and 160800 (marketplace
-- flattened) so nothing still reads tenant_subscription_entitlement.

-- ---------------------------------------------------------------------------
-- 1. admin_dashboard_overview — drop the two subscription_status counts (trialing/active) from the
--    operators block. Everything else (financials, booking funnel, supply, upcoming) is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_overview()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      'financials', jsonb_build_object(
        'gmv', (select coalesce(sum(total_amount), 0) from public.bookings where status = 'confirmed'),
        'deposits', (select coalesce(sum(deposit_amount), 0) from public.bookings
          where status in ('awaiting_confirmation', 'confirmed')),
        'pipeline', (select coalesce(sum(total_amount), 0) from public.bookings
          where status = 'awaiting_confirmation'),
        'avg_booking', (select coalesce(round(avg(total_amount)), 0) from public.bookings
          where status = 'confirmed')
      ),
      'operators', jsonb_build_object(
        'total', (select count(*) from public.tenants),
        'pending', (select count(*) from public.tenants where verification_status = 'pending'),
        'approved', (select count(*) from public.tenants where verification_status = 'approved'),
        'suspended', (select count(*) from public.tenants where verification_status = 'suspended'),
        'changes_requested',
          (select count(*) from public.tenants where verification_status = 'changes_requested'),
        'gcash_flagged', (select count(*) from public.tenants
          where verification_status = 'approved' and gcash_changed_at is not null)
      ),
      'bookings', (
        select jsonb_build_object(
          'total', count(*),
          'held', count(*) filter (where status = 'held'),
          'awaiting', count(*) filter (where status = 'awaiting_confirmation'),
          'confirmed', count(*) filter (where status = 'confirmed'),
          'completed', count(*) filter (where status = 'completed'),
          'cancelled', count(*) filter (where status = 'cancelled'),
          'expired', count(*) filter (where status = 'expired'),
          'no_show', count(*) filter (where status = 'no_show'),
          'confirmation_rate', case
            when count(*) filter (where status in ('confirmed', 'completed', 'cancelled', 'no_show')) > 0
            then round(100.0 * count(*) filter (where status in ('confirmed', 'completed'))
              / count(*) filter (where status in ('confirmed', 'completed', 'cancelled', 'no_show')))
            else 0 end,
          'cancellation_rate', case when count(*) > 0
            then round(100.0 * count(*) filter (where status = 'cancelled') / count(*)) else 0 end,
          'no_show_rate', case
            when count(*) filter (where status in ('confirmed', 'completed', 'no_show')) > 0
            then round(100.0 * count(*) filter (where status = 'no_show')
              / count(*) filter (where status in ('confirmed', 'completed', 'no_show')))
            else 0 end
        )
        from public.bookings
      ),
      'trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'week_start', w.week_start,
          'gmv', coalesce(g.gmv, 0),
          'bookings', coalesce(g.bookings, 0)
        ) order by w.week_start), '[]'::jsonb)
        from (
          select generate_series(
            date_trunc('week', current_date) - interval '5 weeks',
            date_trunc('week', current_date),
            interval '1 week'
          )::date as week_start
        ) w
        left join (
          select date_trunc('week', created_at)::date as wk,
            sum(total_amount) filter (where status = 'confirmed') as gmv,
            count(*) as bookings
          from public.bookings
          group by 1
        ) g on g.wk = w.week_start
      ),
      'supply', jsonb_build_object(
        'properties', (select count(*) from public.properties),
        'rooms', (select coalesce(sum(quantity), 0) from public.room_types),
        'capacity', (select coalesce(sum(capacity * quantity), 0) from public.room_types),
        'dot_accredited', (select count(*) from public.properties where dot_accredited),
        'by_area', (
          select coalesce(jsonb_agg(jsonb_build_object('area', area_label, 'properties', c)
            order by c desc, area_label), '[]'::jsonb)
          from (
            select coalesce(nullif(area, ''), 'Unspecified') as area_label, count(*) c
            from public.properties group by 1
          ) a
        )
      ),
      'upcoming', jsonb_build_object(
        'next7', (select count(*) from public.bookings
          where status = 'confirmed' and check_in >= current_date and check_in < current_date + 7),
        'next7_guests', (select coalesce(sum(num_guests), 0) from public.bookings
          where status = 'confirmed' and check_in >= current_date and check_in < current_date + 7),
        'next30', (select count(*) from public.bookings
          where status = 'confirmed' and check_in >= current_date and check_in < current_date + 30),
        'next30_guests', (select coalesce(sum(num_guests), 0) from public.bookings
          where status = 'confirmed' and check_in >= current_date and check_in < current_date + 30)
      )
    )
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. admin_preview_listing — its accepts_online_payment used the Model-A condition
--    (t.plan = 'business' AND active gateway connection). With plan dropped, switch it to the same
--    payout-account signal the live get_public_listing uses (20260626160100). Body otherwise verbatim.
-- ---------------------------------------------------------------------------
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
    'accepts_online_payment', exists (
      select 1
      from public.tenant_payout_accounts pa
      where pa.tenant_id = t.id
        and pa.status = 'active'
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

-- ---------------------------------------------------------------------------
-- 3. due_deposit_reminders — drop the t.plan in ('pro','business') gate (automation is now for every
--    host). The tenants join existed only for that gate, so it goes too. Signature unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.due_deposit_reminders()
returns table(id uuid, guest_name text, guest_email text, check_in date, check_out date, num_guests integer, deposit_amount numeric, total_amount numeric)
language sql
security definer
set search_path to ''
as $function$
  update public.bookings b
  set reminder_sent_at = now()
  where b.status = 'held'
    and b.reminder_sent_at is null
    and b.guest_email is not null
    and b.hold_expires_at is not null
    and b.hold_expires_at > now()
    and b.hold_expires_at <= now() + interval '10 minutes'
  returning
    b.id, b.guest_name, b.guest_email, b.check_in, b.check_out,
    b.num_guests, b.deposit_amount, b.total_amount;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Drop the subscription-only functions (no longer called; app surfaces removed in Slice E). The two
--    that take a tenant_plan arg must go before the enum is dropped in Slice F.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_billing_health();
drop function if exists public.admin_mark_subscription_paid(uuid, date, public.tenant_plan);
drop function if exists public.downgrade_lapsed_subscriptions(integer);
drop function if exists public.flag_past_due_subscriptions();
drop function if exists public.record_subscription_payment(uuid, public.tenant_plan, numeric, text, text, text, text, jsonb, integer);

-- ---------------------------------------------------------------------------
-- 5. Drop the entitlement authority: function → view → config table (the view cross-joins
--    billing_config, so the table must go last).
-- ---------------------------------------------------------------------------
drop function if exists public.current_tenant_can_accept_bookings();
drop view if exists public.tenant_subscription_entitlement;
drop table if exists public.billing_config;
