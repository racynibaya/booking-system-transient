-- Centralized-aggregator pivot / Slice 4 — the payout ledger (money-OUT accrual).
--
-- When a centralized booking confirms, the guest's grossed-up payment is sitting in the ONE Tuloy
-- platform wallet. This ledger records, per booking, how that splits: the operator's share to
-- disburse (owner_payout = deposit − commission), Tuloy's cut (commission + service fee), and the
-- absorbed PayMongo fee. The row is written ATOMICALLY inside confirm_booking_gateway, so a confirmed
-- centralized booking always has exactly one accrual (no gap if the webhook handler dies post-confirm).
--
-- Lifecycle: clearing → payable (Slice 5 flips it once PayMongo funds clear) → paid (a disbursement
-- went out) | failed (bad number / receiving limit) | refunded / clawed_back (Slice 6).

create type public.payout_ledger_status as enum (
  'clearing', 'payable', 'paid', 'failed', 'refunded', 'clawed_back'
);

create table public.payout_ledger (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  stay_value          numeric(10, 2) not null,  -- S
  deposit_amount      numeric(10, 2) not null,  -- D (collected online)
  operator_commission numeric(10, 2) not null,  -- commission_rate · S, withheld from the payout
  guest_service_fee   numeric(10, 2) not null,  -- service_fee_rate · S, guest-borne
  paymongo_fee        numeric(10, 2) not null,  -- absorbed processing fee = charge − D − service_fee
  owner_payout        numeric(10, 2) not null,  -- D − operator_commission, what Tuloy disburses
  status              public.payout_ledger_status not null default 'clearing',
  clear_eta           timestamptz not null,     -- earliest the funds should have cleared (heuristic)
  payout_id           uuid,                     -- groups rows paid in one disbursement (Slice 5)
  fail_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (booking_id)                           -- exactly one accrual per booking
);
create index payout_ledger_tenant_status_idx on public.payout_ledger (tenant_id, status);
create index payout_ledger_payout_idx on public.payout_ledger (status, clear_eta);

-- Operators may READ their own ledger (a future earnings/payouts view); only service_role writes
-- (the confirm RPC accrues; the payout job in Slice 5 updates).
alter table public.payout_ledger enable row level security;
create policy "payout_ledger_select_own" on public.payout_ledger for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
grant select on public.payout_ledger to authenticated;
grant all on public.payout_ledger to service_role;

-- Add N banking days (skip Sat/Sun) to a timestamp. PH holidays are NOT modeled — clear_eta is only a
-- "don't even try before this" heuristic; Slice 5's payout job verifies the actual available balance
-- before disbursing, so an ignored holiday can never cause a pay-before-cleared.
create or replace function public.add_banking_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  d     timestamptz := p_from;
  added integer := 0;
begin
  while added < p_days loop
    d := d + interval '1 day';
    if extract(isodow from d) < 6 then  -- 1..5 = Mon..Fri
      added := added + 1;
    end if;
  end loop;
  return d;
end;
$$;

-- Redefine confirm_booking_gateway to ALSO write the payout-ledger accrual for centralized bookings
-- (gateway_charge_amount is not null). Everything above the new block is verbatim from
-- 20260626160200_platform_confirm_charge_amount.sql; the accrual is appended just before RETURN.
create or replace function public.confirm_booking_gateway(
  p_booking_id   uuid,
  p_provider     text,
  p_provider_ref text default null,
  p_amount       numeric default null,
  p_raw_payload  jsonb default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking     public.bookings;
  v_quantity    integer;
  v_blocked     integer;
  v_overlapping integer;
  v_expected    numeric;
  v_comm_rate   numeric;
  v_fee_rate    numeric;
  v_commission  numeric;
  v_service_fee numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'UNKNOWN_BOOKING';
  end if;

  -- Idempotent: the deposit is already confirmed (a replayed webhook) → no-op.
  if v_booking.status = 'confirmed' then
    return null;
  end if;

  -- Only a live hold or a proof-submitted booking can be confirmed by a payment.
  if v_booking.status not in ('held', 'awaiting_confirmation') then
    raise exception 'NOT_CONFIRMABLE';
  end if;

  -- Amount guard — verify the settled amount against what we charged: the stamped
  -- gateway_charge_amount (centralized) when present, else the bare deposit (Model A / manual).
  v_expected := coalesce(v_booking.gateway_charge_amount, v_booking.deposit_amount);
  if p_amount is not null and p_amount <> v_expected then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- Paid-but-expired rescue (mirrors submit_proof): a webhook can land after the hold lapsed.
  if v_booking.status = 'held'
     and v_booking.hold_expires_at is not null
     and v_booking.hold_expires_at <= now() then
    perform pg_advisory_xact_lock(hashtext(v_booking.room_type_id::text));

    select count(*) into v_blocked
    from public.availability_blocks b
    where b.room_type_id = v_booking.room_type_id
      and b.start_date < v_booking.check_out
      and v_booking.check_in < b.end_date;

    select quantity into v_quantity
    from public.room_types where id = v_booking.room_type_id;

    select count(*) into v_overlapping
    from public.bookings bk
    where bk.room_type_id = v_booking.room_type_id
      and bk.id <> v_booking.id
      and bk.status in ('held', 'awaiting_confirmation', 'confirmed')
      and bk.check_in < v_booking.check_out
      and v_booking.check_in < bk.check_out
      and (bk.hold_expires_at is null or bk.hold_expires_at > now());

    if v_blocked > 0 or v_overlapping >= v_quantity then
      raise exception 'SLOT_TAKEN';
    end if;
  end if;

  -- Flip to confirmed. NULL hold_expires_at is essential (occupancy predicate).
  update public.bookings
  set status = 'confirmed', hold_expires_at = null
  where id = p_booking_id and status in ('held', 'awaiting_confirmation')
  returning * into v_booking;

  if not found then
    return null;   -- raced to a terminal/other status between the lock and here → no-op
  end if;

  insert into public.payments (
    tenant_id, booking_id, provider, provider_ref, amount, kind, status, proof_url, raw_payload
  ) values (
    v_booking.tenant_id, v_booking.id, p_provider, p_provider_ref,
    coalesce(p_amount, v_expected), 'deposit', 'confirmed',
    v_booking.proof_url, p_raw_payload
  );

  -- Centralized accrual: split the grossed-up charge into the operator's payout + Tuloy's cut and
  -- record it for the daily payout job. Only platform bookings carry gateway_charge_amount; Model A /
  -- manual leave it null and accrue nothing. Per-owner rates come from the payout account.
  if v_booking.gateway_charge_amount is not null then
    select commission_rate, service_fee_rate into v_comm_rate, v_fee_rate
    from public.tenant_payout_accounts where tenant_id = v_booking.tenant_id;
    if found then
      v_commission  := round(v_booking.total_amount * v_comm_rate, 2);
      v_service_fee := round(v_booking.total_amount * v_fee_rate, 2);
      insert into public.payout_ledger (
        tenant_id, booking_id, stay_value, deposit_amount, operator_commission,
        guest_service_fee, paymongo_fee, owner_payout, clear_eta
      ) values (
        v_booking.tenant_id, v_booking.id, v_booking.total_amount, v_booking.deposit_amount,
        v_commission, v_service_fee,
        round(v_booking.gateway_charge_amount - v_booking.deposit_amount - v_service_fee, 2),
        round(v_booking.deposit_amount - v_commission, 2),
        public.add_banking_days(now(), 3)
      )
      on conflict (booking_id) do nothing;  -- belt-and-suspenders; confirm already no-ops on replay
    end if;
  end if;

  return v_booking;
end;
$$;

revoke execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_booking_gateway(uuid, text, text, numeric, jsonb)
  to service_role;
