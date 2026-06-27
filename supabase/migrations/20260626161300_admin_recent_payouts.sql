-- Admin refund tool: a cross-tenant list of recent online payouts so the admin refunds from a row
-- instead of pasting a UUID. SECURITY DEFINER + self-guarded on is_current_user_admin() — same pattern
-- as admin_dashboard_overview / admin_list_operators, so admin-dal stays service-key-free and RLS
-- (payout_ledger_select_own) isn't a problem for the cross-tenant read.

create or replace function public.admin_recent_payouts()
returns table (
  booking_id uuid,
  guest_name text,
  property_name text,
  operator_name text,
  deposit_amount numeric,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pl.booking_id,
    b.guest_name,
    p.name,
    t.name,
    pl.deposit_amount,
    pl.status::text,
    pl.created_at
  from public.payout_ledger pl
  join public.bookings b on b.id = pl.booking_id
  left join public.properties p on p.id = b.property_id
  join public.tenants t on t.id = pl.tenant_id
  where public.is_current_user_admin()
  order by pl.created_at desc
  limit 50;
$$;

grant execute on function public.admin_recent_payouts() to authenticated;
