-- Admin command-center overview — one aggregate jsonb feeding the whole /admin dashboard, so the
-- page makes a single round-trip. Same trust pattern as the other admin RPCs: SECURITY DEFINER to
-- read across tenants, self-guarded by is_current_user_admin() (normal operator gets null),
-- granted to authenticated, revoked from anon. All figures are aggregates — no row-level records.
create or replace function public.admin_dashboard_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      -- A. Headline financials (booking money flowing through the platform).
      'financials', jsonb_build_object(
        'gmv', (select coalesce(sum(total_amount), 0) from public.bookings where status = 'confirmed'),
        'deposits', (select coalesce(sum(deposit_amount), 0) from public.bookings
          where status in ('awaiting_confirmation', 'confirmed')),
        'pipeline', (select coalesce(sum(total_amount), 0) from public.bookings
          where status = 'awaiting_confirmation'),
        'avg_booking', (select coalesce(round(avg(total_amount)), 0) from public.bookings
          where status = 'confirmed')
      ),
      -- D. Operator funnel + verification health.
      'operators', jsonb_build_object(
        'total', (select count(*) from public.tenants),
        'pending', (select count(*) from public.tenants where verification_status = 'pending'),
        'approved', (select count(*) from public.tenants where verification_status = 'approved'),
        'suspended', (select count(*) from public.tenants where verification_status = 'suspended'),
        'changes_requested',
          (select count(*) from public.tenants where verification_status = 'changes_requested'),
        'gcash_flagged', (select count(*) from public.tenants
          where verification_status = 'approved' and gcash_changed_at is not null),
        'trialing', (select count(*) from public.tenants where subscription_status = 'trialing'),
        'active', (select count(*) from public.tenants where subscription_status = 'active')
      ),
      -- C. Booking funnel + conversion rates (aggregate counts, no records).
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
          -- confirmation rate over decided bookings (won vs lost), as a whole percent.
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
      -- B. Revenue + booking-volume trend, last 6 weeks (weekly buckets on created_at).
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
      -- E. Supply / inventory across the marketplace.
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
      -- F. Upcoming confirmed check-in load.
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
$$;

grant execute on function public.admin_dashboard_overview() to authenticated;
revoke execute on function public.admin_dashboard_overview() from anon;
