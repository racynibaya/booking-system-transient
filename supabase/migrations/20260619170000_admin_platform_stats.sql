-- Admin dashboard — platform-wide counts for the /admin overview. Same shape as the other admin
-- RPCs (20260619120000_operator_verification.sql): SECURITY DEFINER so it can read across tenants,
-- but self-guarded by is_current_user_admin() so a normal operator gets null. Granted to
-- authenticated, revoked from anon. Returns one jsonb the admin-dal consumes directly.
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
            where verification_status = 'approved' and gcash_changed_at is not null)
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
