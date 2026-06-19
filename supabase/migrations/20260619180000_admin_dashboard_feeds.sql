-- Admin dashboard feeds — extends the /admin overview into a fuller business dashboard.
-- Same trust pattern as 20260619170000_admin_platform_stats.sql: SECURITY DEFINER so they can
-- read across tenants, but self-guarded by is_current_user_admin() so a normal operator gets
-- null/empty. Granted to authenticated, revoked from anon.

-- 1) Extend the platform stats with the operator subscription funnel. subscription_status is a
-- free-text column (default 'trialing') that isn't written yet, so today active≈0 and
-- trialing≈total — that's the honest current state, and why the dashboard's MRR slot stays
-- "pending pricing" rather than showing a number.
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
        'total', (select count(*) from public.tenants),
        'pending', (select count(*) from public.tenants where verification_status = 'pending'),
        'approved', (select count(*) from public.tenants where verification_status = 'approved'),
        'suspended', (select count(*) from public.tenants where verification_status = 'suspended'),
        'changes_requested',
          (select count(*) from public.tenants where verification_status = 'changes_requested'),
        'gcash_flagged',
          (select count(*) from public.tenants
            where verification_status = 'approved' and gcash_changed_at is not null),
        'trialing', (select count(*) from public.tenants where subscription_status = 'trialing'),
        'active', (select count(*) from public.tenants where subscription_status = 'active')
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

grant execute on function public.admin_platform_stats() to authenticated;
revoke execute on function public.admin_platform_stats() from anon;

-- 2) Recent bookings across every operator — feeds the dashboard "transactions" table.
create or replace function public.admin_recent_bookings()
returns table (
  booking_id uuid,
  operator_name text,
  guest_name text,
  total_amount numeric,
  status public.booking_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, t.name, b.guest_name, b.total_amount, b.status, b.created_at
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id
  where public.is_current_user_admin()
  order by b.created_at desc
  limit 8;
$$;

grant execute on function public.admin_recent_bookings() to authenticated;
revoke execute on function public.admin_recent_bookings() from anon;

-- 3) Platform activity feed — recent operator signups and booking confirmations, interleaved.
-- 'kind' lets the UI pick an icon; 'at' is the sort/display timestamp.
create or replace function public.admin_recent_activity()
returns table (
  kind text,
  title text,
  subtitle text,
  at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select
      'operator_signup' as kind,
      coalesce(t.name, 'New operator') as title,
      'Joined the platform' as subtitle,
      t.created_at as at
    from public.tenants t
    where public.is_current_user_admin()
    union all
    select
      'booking_confirmed' as kind,
      coalesce(t.name, 'Operator') as title,
      'Confirmed a booking for ' || b.guest_name as subtitle,
      b.created_at as at
    from public.bookings b
    join public.tenants t on t.id = b.tenant_id
    where public.is_current_user_admin() and b.status = 'confirmed'
  ) feed
  order by at desc
  limit 8;
$$;

grant execute on function public.admin_recent_activity() to authenticated;
revoke execute on function public.admin_recent_activity() from anon;
