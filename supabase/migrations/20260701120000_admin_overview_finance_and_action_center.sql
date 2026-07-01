-- Admin revamp / Slice 1 — surface the money that already exists and consolidate "what needs me now".
--
--   1. admin_dashboard_overview(): additive `finance` block from the payout ledger (real commission —
--      Tuloy's cut) + subscription revenue. Every existing key is verbatim; only a trailing key is
--      added, so the current DashboardOverview consumers keep working.
--   2. admin_action_center(): one self-guarded jsonb of the buckets an admin actually acts on
--      (KYC queue, GCash re-verify, failed payouts, aging unanswered inquiries) — count + a few
--      sample rows each, so the overview can show "who / how stale" at a glance.
--   3. admin_activity_feed(): a fresh platform pulse (signups + confirmations + reviews). The old
--      admin_recent_activity() was dropped in 20260626161100; this is a new, richer function, not a
--      resurrection.
--
-- Trust pattern is identical to the other admin RPCs: SECURITY DEFINER to read across tenants,
-- self-guarded by is_current_user_admin() (a normal operator gets null), granted to authenticated,
-- revoked from anon.

-- 1) Overview + finance block --------------------------------------------------------------------
-- NB: the operators block matches the CURRENT live function (queried from the DB, not the original
-- 20260619190000 file) — the subscription→commission cutover already dropped the trialing/active
-- fields and the tenants.subscription_status column. Only the trailing `finance` key is new.
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
          where verification_status = 'approved' and gcash_changed_at is not null)
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
      ),
      -- G. Commission / payout money — the real revenue post-D10. Reads the payout ledger (Tuloy's cut
      -- accrues there, one row per confirmed centralized booking). The subscription rail was retired at
      -- the cutover (subscription_payments dropped), so there is no MRR/subscription figure here.
      'finance', jsonb_build_object(
        -- Tuloy's platform cut, all-time and trailing 30 days.
        'commission_total', (select coalesce(sum(operator_commission), 0) from public.payout_ledger),
        'commission_30d', (select coalesce(sum(operator_commission), 0) from public.payout_ledger
          where created_at >= now() - interval '30 days'),
        -- What Tuloy still owes operators (accrued, not yet disbursed).
        'owner_payout_pending', (select coalesce(sum(owner_payout), 0) from public.payout_ledger
          where status in ('clearing', 'payable')),
        -- Ledger rows by lifecycle status.
        'payouts', (
          select jsonb_build_object(
            'clearing', count(*) filter (where status = 'clearing'),
            'payable', count(*) filter (where status = 'payable'),
            'paid', count(*) filter (where status = 'paid'),
            'failed', count(*) filter (where status = 'failed'),
            'refunded', count(*) filter (where status = 'refunded'),
            'clawed_back', count(*) filter (where status = 'clawed_back')
          )
          from public.payout_ledger
        )
      )
    )
  end;
$$;

grant execute on function public.admin_dashboard_overview() to authenticated;
revoke execute on function public.admin_dashboard_overview() from anon;

-- 2) Action center — the consolidated "needs me now" list ----------------------------------------
-- Each bucket returns { count, items:[{ id, label, sublabel }] } with items capped at 5 (the count is
-- the true total). Buckets are only the ones an admin genuinely acts on.
create or replace function public.admin_action_center()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      -- Operators waiting for first-time verification.
      'pending_kyc', jsonb_build_object(
        'count', (select count(*) from public.tenants where verification_status = 'pending'),
        'items', (
          select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from (
            select jsonb_build_object(
              'id', id,
              'label', coalesce(nullif(name, ''), 'New operator'),
              'sublabel', 'Joined ' || to_char(created_at, 'Mon DD')
            ) as item, created_at as ord
            from public.tenants
            where verification_status = 'pending'
            order by created_at asc
            limit 5
          ) s
        )
      ),
      -- Sent back for fixes — waiting on the operator, but the admin tracks them.
      'changes_requested', jsonb_build_object(
        'count', (select count(*) from public.tenants where verification_status = 'changes_requested'),
        'items', (
          select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from (
            select jsonb_build_object(
              'id', id,
              'label', coalesce(nullif(name, ''), 'Operator'),
              'sublabel', coalesce(nullif(verification_note, ''), 'Awaiting fixes')
            ) as item, created_at as ord
            from public.tenants
            where verification_status = 'changes_requested'
            order by created_at asc
            limit 5
          ) s
        )
      ),
      -- Approved operators who changed their payout GCash — re-verify against fraud.
      'gcash_reverify', jsonb_build_object(
        'count', (select count(*) from public.tenants
          where verification_status = 'approved' and gcash_changed_at is not null),
        'items', (
          select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from (
            select jsonb_build_object(
              'id', id,
              'label', coalesce(nullif(name, ''), 'Operator'),
              'sublabel', 'Payout changed ' || to_char(gcash_changed_at, 'Mon DD')
            ) as item, gcash_changed_at as ord
            from public.tenants
            where verification_status = 'approved' and gcash_changed_at is not null
            order by gcash_changed_at desc
            limit 5
          ) s
        )
      ),
      -- Payout disbursements that failed — money stuck, needs manual intervention.
      'failed_payouts', jsonb_build_object(
        'count', (select count(*) from public.payout_ledger where status = 'failed'),
        'items', (
          select coalesce(jsonb_agg(item order by ord desc), '[]'::jsonb) from (
            select jsonb_build_object(
              'id', pl.id,
              'label', coalesce(nullif(t.name, ''), 'Operator'),
              'sublabel', b.guest_name || ' · ' || coalesce(nullif(pl.fail_reason, ''), 'disbursement failed')
            ) as item, pl.created_at as ord
            from public.payout_ledger pl
            join public.tenants t on t.id = pl.tenant_id
            join public.bookings b on b.id = pl.booking_id
            where pl.status = 'failed'
            order by pl.created_at desc
            limit 5
          ) s
        )
      ),
      -- Guest inquiries the operator has left unanswered for 24h+ — reputation risk.
      'aging_inquiries', jsonb_build_object(
        'count', (select count(*) from public.inquiry_threads
          where awaiting_operator and last_message_at < now() - interval '24 hours'),
        'items', (
          select coalesce(jsonb_agg(item order by ord asc), '[]'::jsonb) from (
            select jsonb_build_object(
              'id', it.id,
              'label', it.guest_name,
              'sublabel', p.name || ' · waiting '
                || floor(extract(epoch from (now() - it.last_message_at)) / 3600)::int || 'h'
            ) as item, it.last_message_at as ord
            from public.inquiry_threads it
            join public.properties p on p.id = it.property_id
            where it.awaiting_operator and it.last_message_at < now() - interval '24 hours'
            order by it.last_message_at asc
            limit 5
          ) s
        )
      )
    )
  end;
$$;

grant execute on function public.admin_action_center() to authenticated;
revoke execute on function public.admin_action_center() from anon;

-- 3) Activity feed — platform pulse (fresh; replaces the dropped admin_recent_activity) -----------
create or replace function public.admin_activity_feed()
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
      coalesce(nullif(t.name, ''), 'New operator') as title,
      'Joined the platform' as subtitle,
      t.created_at as at
    from public.tenants t
    where public.is_current_user_admin() and not t.is_admin
    union all
    select
      'booking_confirmed' as kind,
      coalesce(nullif(t.name, ''), 'Operator') as title,
      'Confirmed a booking for ' || b.guest_name as subtitle,
      b.created_at as at
    from public.bookings b
    join public.tenants t on t.id = b.tenant_id
    where public.is_current_user_admin() and b.status = 'confirmed'
    union all
    select
      'review_submitted' as kind,
      coalesce(nullif(p.name, ''), 'Property') as title,
      r.rating || '★ review from ' || coalesce(nullif(r.guest_name, ''), 'a guest') as subtitle,
      r.submitted_at as at
    from public.reviews r
    join public.properties p on p.id = r.property_id
    where public.is_current_user_admin() and r.submitted_at is not null
  ) feed
  order by at desc
  limit 12;
$$;

grant execute on function public.admin_activity_feed() to authenticated;
revoke execute on function public.admin_activity_feed() from anon;
