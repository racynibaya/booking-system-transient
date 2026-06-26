-- Centralized-aggregator pivot / Slice 5 — disbursement state machine (money-OUT, the payout job).
--
-- The daily cron disburses each owner's accrued, cleared balance in ONE PayMongo batch transfer. The
-- money-correctness rule is "never pay twice": the claim and the mark are separate, atomic steps, and
-- the network call sits between them.
--
--   claim_due_payouts()  → atomically flips this tenant's due 'clearing' rows to 'payable' under a
--                          fresh payout_id, returns the summed total + the destination account. A
--                          concurrent run's UPDATE matches 0 rows (they're no longer 'clearing'), so
--                          a tenant's balance can be claimed exactly once.
--   <cron calls PayMongo POST /v2/batch_transfers with reference_number = payout_id>
--   mark_payout_paid()   → on a 2xx submit: 'payable' → 'paid', stamps the provider transfer ref.
--   mark_payout_failed() → on error: 'payable' → 'failed' + reason (the owner is notified; retried by
--                          re-accruing or an admin re-queue, out of scope here).
--
-- ASYNC NOTE: a batch transfer is created 'pending' and resolves to succeeded/failed later via the
-- transfer callback webhook. We mark 'paid' on a successful SUBMIT; a later failure callback flipping
-- 'paid' → 'failed' is a follow-up (Slice 5b). reference_number = payout_id is the idempotency key.

-- Destination institution code (BIC) for the payout — GCash has one InstaPay code; each bank has its
-- own. Resolved from PayMongo GET /v2/transfers/receiving_institutions. NULL until the operator picks
-- their institution (onboarding picker is a follow-up); the job fails such a payout with a clear reason.
alter table public.tenant_payout_accounts
  add column if not exists payout_bic text;

-- payout_ref: the PayMongo batch/transfer id for a paid disbursement (audit + reconcile).
alter table public.payout_ledger
  add column if not exists payout_ref text;

-- claim — reserve every tenant's due, cleared balance under one payout_id and report what to send.
create or replace function public.claim_due_payouts()
returns table (
  tenant_id      uuid,
  payout_id      uuid,
  total          numeric,
  method         public.payout_method,
  account_number text,
  payout_name    text,
  payout_bic     text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tid      uuid;
  v_payout   uuid;
  v_total    numeric;
begin
  -- Only tenants that have due rows AND an active payout destination.
  for v_tid in
    select distinct pl.tenant_id
    from public.payout_ledger pl
    where pl.status = 'clearing'
      and pl.clear_eta <= now()
      and exists (
        select 1 from public.tenant_payout_accounts pa
        where pa.tenant_id = pl.tenant_id and pa.status = 'active'
      )
  loop
    v_payout := gen_random_uuid();

    -- Atomic claim: only rows still 'clearing' are grabbed, so a concurrent run can't double-claim.
    -- Sum exactly what THIS call claimed (not a pre-read total that a racing run may have taken).
    -- Columns are table-qualified: the RETURNS TABLE out-params (tenant_id, status, ...) would
    -- otherwise shadow the table columns and the WHERE would match nothing.
    with claimed as (
      update public.payout_ledger
      set status = 'payable', payout_id = v_payout, updated_at = now()
      where payout_ledger.tenant_id = v_tid
        and payout_ledger.status = 'clearing'
        and payout_ledger.clear_eta <= now()
      returning payout_ledger.owner_payout
    )
    select coalesce(sum(owner_payout), 0) into v_total from claimed;

    if v_total > 0 then
      return query
        select v_tid, v_payout, v_total, pa.method, pa.account_number, pa.payout_name, pa.payout_bic
        from public.tenant_payout_accounts pa
        where pa.tenant_id = v_tid and pa.status = 'active'
        limit 1;
    end if;
  end loop;
end;
$$;

create or replace function public.mark_payout_paid(p_payout_id uuid, p_provider_ref text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payout_ledger
  set status = 'paid', payout_ref = p_provider_ref, updated_at = now()
  where payout_id = p_payout_id and status = 'payable';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.mark_payout_failed(p_payout_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payout_ledger
  set status = 'failed', fail_reason = p_reason, updated_at = now()
  where payout_id = p_payout_id and status = 'payable';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Webhook/cron only — service_role. Operators never disburse.
revoke execute on function public.claim_due_payouts() from public, anon, authenticated;
grant execute on function public.claim_due_payouts() to service_role;
revoke execute on function public.mark_payout_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_payout_paid(uuid, text) to service_role;
revoke execute on function public.mark_payout_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_payout_failed(uuid, text) to service_role;
