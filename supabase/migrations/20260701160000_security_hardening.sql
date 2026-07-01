-- Security hardening — Slice 2 of the 2026-07 security diagnostic.
-- Two belt-and-suspenders DB guards. Neither changes any live behaviour today; both close a path that
-- a future mistake (or a party holding a booking UUID) could otherwise walk through.

-- 1. submit_proof: revoke the anon grant.
-- The proof-submit Server Action always calls this RPC through the service-role client (the storage
-- upload it depends on is itself service-role-gated), so the anon grant was unused by the app — but it
-- let anyone who knew a held booking's UUID call the RPC directly and flip held -> awaiting_confirmation
-- with an arbitrary proof_url (inventory griefing, no real payment). service_role keeps execute.
revoke execute on function public.submit_proof(uuid, text) from anon;

-- 2. tenants: block operator -> admin self-escalation at the row level.
-- Today the only thing stopping an operator from promoting themselves is the column-level UPDATE grant
-- (authenticated may update name/gcash_*/inquiry_auto_reply* only). A future whole-table
-- `grant update on public.tenants to authenticated` would silently reopen is_admin / verification_status
-- to self-service. This BEFORE UPDATE trigger fails closed regardless of grants: those two privileged
-- columns can only change when the statement runs as a non-API role — service_role (the server), or a
-- SECURITY DEFINER admin RPC executing as its postgres owner (set_tenant_verification etc.). A plain
-- authenticated/anon session that touches either column is rejected.
create or replace function public.tenants_block_privileged_self_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.is_admin is distinct from old.is_admin
    or new.verification_status is distinct from old.verification_status
  ) then
    raise exception 'PRIVILEGED_COLUMN_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tenants_block_privileged_self_update on public.tenants;
create trigger tenants_block_privileged_self_update
  before update on public.tenants
  for each row
  execute function public.tenants_block_privileged_self_update();
