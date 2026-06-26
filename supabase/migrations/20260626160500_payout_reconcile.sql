-- Slice 5b — async disbursement reconciliation (the transfer callback's write seam).
--
-- A batch transfer is created 'pending' and the cron marks it 'paid' on a successful SUBMIT. PayMongo
-- resolves it later (succeeded/failed) and pings our callback URL. The callback re-fetches the
-- authoritative status from PayMongo (never trusts the callback body) and calls this RPC.
--
--   succeeded → idempotent no-op (the rows are already 'paid').
--   failed    → flip 'paid' → 'failed' + reason, AND flag the destination 'failed' so future
--               bookings stop accruing into a broken account (claim_due_payouts only claims
--               status='active' destinations) and the operator is prompted to fix + re-save it.
--
-- This is the ONLY 'paid' → 'failed' transition; mark_payout_failed (Slice 5) only handles the
-- earlier 'payable' → 'failed' (a submit that never succeeded). Service-role only, like the rest of
-- the disbursement state machine.

create or replace function public.reconcile_disbursement(
  p_payout_id uuid,
  p_succeeded boolean,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_tenant uuid;
begin
  if p_succeeded then
    -- Authoritative success — nothing to change; the rows are already 'paid'. Idempotent.
    return 0;
  end if;

  -- Flip only rows still 'paid' for this payout, so a replayed failure callback is a no-op.
  update public.payout_ledger
  set status = 'failed', fail_reason = p_reason, updated_at = now()
  where payout_id = p_payout_id and status = 'paid'
  returning tenant_id into v_tenant;
  get diagnostics v_count = row_count;

  -- Flag the destination so the next claim skips it until the operator fixes their details.
  if v_count > 0 and v_tenant is not null then
    update public.tenant_payout_accounts
    set status = 'failed', updated_at = now()
    where tenant_id = v_tenant;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.reconcile_disbursement(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_disbursement(uuid, boolean, text) to service_role;
