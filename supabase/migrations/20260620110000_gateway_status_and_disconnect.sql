-- Phase 2b / M2 — connect-UI support: a non-secret status reader and a disconnect/cleanup path for
-- tenant_gateway_connections (M1). Two RPCs with deliberately different trust levels:
--
--   * gateway_connection_status() -- SELF-SCOPED, granted to authenticated. Returns ONLY non-secret
--     metadata (never sk_/whsk_) for the CALLER'S OWN tenant via current_tenant_id(), so the Settings
--     UI can show "connected?" without ever touching the secret boundary (gateway_get_connection
--     stays service_role-only).
--   * gateway_delete_connection() -- service_role ONLY. Removes the connection row AND its Vault
--     secrets so a disconnect/switch doesn't orphan encrypted keys (the M1 open issue). Returns the
--     old webhook_id so the caller can best-effort delete the webhook on PayMongo's side.
--
-- supabase_vault 0.3.1 ships create_secret/update_secret but NO delete_secret, so we remove the
-- secrets directly from vault.secrets (a real table) by id.

-- ---------------------------------------------------------------------------
-- gateway_connection_status -- self-scoped, non-secret. Always returns exactly one row: either the
-- caller's connection metadata (connected = true) or a not-connected sentinel.
-- ---------------------------------------------------------------------------
create or replace function public.gateway_connection_status()
returns table (
  connected  boolean,
  provider   text,
  status     text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select true, c.provider, c.status, c.updated_at
  from public.tenant_gateway_connections c
  where c.tenant_id = public.current_tenant_id()
  union all
  select false, null::text, null::text, null::timestamptz
  where not exists (
    select 1 from public.tenant_gateway_connections
    where tenant_id = public.current_tenant_id()
  );
$$;

-- Self-scoped read: operators may call it (it returns only their own non-secret status).
revoke execute on function public.gateway_connection_status() from public, anon;
grant execute on function public.gateway_connection_status() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- gateway_delete_connection -- service_role only. Deletes the connection row and its two Vault
-- secrets. Returns the old webhook_id (or null) so the caller can best-effort remove the webhook on
-- PayMongo. No-ops (returns null) when the tenant has no connection.
-- ---------------------------------------------------------------------------
create or replace function public.gateway_delete_connection(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        public.tenant_gateway_connections;
begin
  select * into v_row
  from public.tenant_gateway_connections
  where tenant_id = p_tenant_id;

  if not found then
    return null;
  end if;

  delete from public.tenant_gateway_connections where tenant_id = p_tenant_id;
  delete from vault.secrets where id in (v_row.sk_secret_id, v_row.whsk_secret_id);

  return v_row.webhook_id;
end;
$$;

revoke execute on function public.gateway_delete_connection(uuid) from public, anon, authenticated;
grant execute on function public.gateway_delete_connection(uuid) to service_role;
