-- Admin revamp / Slice 2 — the Finance section. Everything reads the payout ledger (the money-OUT
-- accrual, one row per confirmed centralized booking); post-D10 the subscription rail is retired, so
-- there is no MRR/subscription source here — commission IS the revenue.
--
--   admin_finance_overview(): headline commission + gross flows + per-status money + a weekly
--     commission trend, in one self-guarded jsonb round-trip.
--   admin_list_payouts(): paginated, optionally status-filtered ledger rows joined to operator /
--     guest / property, with a window total_count for pagination.
--
-- Trust pattern matches the other admin RPCs: SECURITY DEFINER + self-guard on is_current_user_admin(),
-- granted to authenticated, revoked from anon.

create or replace function public.admin_finance_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      -- Tuloy's cut — the platform revenue.
      'commission', jsonb_build_object(
        'total', (select coalesce(sum(operator_commission), 0) from public.payout_ledger),
        'd30', (select coalesce(sum(operator_commission), 0) from public.payout_ledger
          where created_at >= now() - interval '30 days'),
        'd7', (select coalesce(sum(operator_commission), 0) from public.payout_ledger
          where created_at >= now() - interval '7 days')
      ),
      -- Gross money flows the platform records (never holds — custody stays with the processor).
      'gross', jsonb_build_object(
        'stay_value', (select coalesce(sum(stay_value), 0) from public.payout_ledger),
        'deposits', (select coalesce(sum(deposit_amount), 0) from public.payout_ledger),
        'service_fees', (select coalesce(sum(guest_service_fee), 0) from public.payout_ledger),
        'paymongo_fees', (select coalesce(sum(paymongo_fee), 0) from public.payout_ledger),
        'owner_payouts', (select coalesce(sum(owner_payout), 0) from public.payout_ledger)
      ),
      -- Owner money accrued but not yet disbursed (what Tuloy still owes operators).
      'pending_owner_payout', (select coalesce(sum(owner_payout), 0) from public.payout_ledger
        where status in ('clearing', 'payable')),
      -- Count + owner-payout amount in each ledger lifecycle state.
      'by_status', (
        select coalesce(
          jsonb_object_agg(status::text, jsonb_build_object('count', c, 'owner_payout', amt)),
          '{}'::jsonb)
        from (
          select status, count(*) c, sum(owner_payout) amt
          from public.payout_ledger group by status
        ) s
      ),
      -- Weekly commission trend, last 8 weeks (buckets on created_at) — feeds the SVG trend chart.
      'trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'label', to_char(w.week_start, 'Mon DD'),
          'value', coalesce(g.commission, 0)
        ) order by w.week_start), '[]'::jsonb)
        from (
          select generate_series(
            date_trunc('week', current_date) - interval '7 weeks',
            date_trunc('week', current_date),
            interval '1 week'
          )::date as week_start
        ) w
        left join (
          select date_trunc('week', created_at)::date as wk, sum(operator_commission) as commission
          from public.payout_ledger
          group by 1
        ) g on g.wk = w.week_start
      )
    )
  end;
$$;

grant execute on function public.admin_finance_overview() to authenticated;
revoke execute on function public.admin_finance_overview() from anon;

-- Paginated ledger rows for the Finance table. p_status filters by lifecycle state (null = all).
-- total_count is the full filtered count (window) so the UI can paginate without a second query.
create or replace function public.admin_list_payouts(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  operator_name text,
  guest_name text,
  property_name text,
  stay_value numeric,
  deposit_amount numeric,
  operator_commission numeric,
  owner_payout numeric,
  status public.payout_ledger_status,
  clear_eta timestamptz,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pl.id,
    coalesce(nullif(t.name, ''), 'Operator') as operator_name,
    b.guest_name,
    coalesce(nullif(p.name, ''), 'Property') as property_name,
    pl.stay_value,
    pl.deposit_amount,
    pl.operator_commission,
    pl.owner_payout,
    pl.status,
    pl.clear_eta,
    pl.created_at,
    count(*) over () as total_count
  from public.payout_ledger pl
  join public.tenants t on t.id = pl.tenant_id
  join public.bookings b on b.id = pl.booking_id
  join public.properties p on p.id = b.property_id
  where public.is_current_user_admin()
    and (p_status is null or pl.status::text = p_status)
  order by pl.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

grant execute on function public.admin_list_payouts(text, integer, integer) to authenticated;
revoke execute on function public.admin_list_payouts(text, integer, integer) from anon;
