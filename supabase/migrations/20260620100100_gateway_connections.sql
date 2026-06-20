-- Phase 2b / M1 — per-tenant gateway connection store (operator-as-merchant, Merchant Model A).
-- Each Business-tier operator brings their own PayMongo account; we hold their secret key (sk_) and
-- webhook signing secret (whsk_) so the per-tenant checkout (M4) and the token-routed webhook (M3)
-- can act AS that operator. These are the most sensitive per-tenant data we will ever store, so:
--
--   * The raw keys live ENCRYPTED in Supabase Vault (libsodium authenticated encryption), never in
--     a plain column. The table holds only the Vault secret ids + non-secret routing metadata.
--   * The table has RLS on with ZERO operator grant -- operators cannot read it at all, not even
--     their own row. Only service_role (RLS-bypassing) reaches the rows.
--   * Vault itself is not reachable by service_role over the Data API, so all access goes through
--     the two SECURITY DEFINER RPCs below, granted to service_role ONLY (same trust-boundary
--     pattern as confirm_booking_gateway and the admin_* RPCs -- architecture P1: secrets/money
--     never go through app-level check-then-write).
--
-- Two distinct "tokens" -- do not conflate:
--   * sk_ / whsk_  -- the operator's PayMongo CREDENTIALS (encrypted here).
--   * webhook_token -- OUR opaque, unguessable URL id that routes an inbound webhook to one tenant
--     (M3: /api/webhooks/paymongo/[token]). Not a crypto secret; verification still rests on whsk_.

create extension if not exists supabase_vault with schema vault;

create table public.tenant_gateway_connections (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  provider       text not null default 'paymongo',
  sk_secret_id   uuid not null,          -- -> vault.secrets.id (encrypted sk_)
  whsk_secret_id uuid not null,          -- -> vault.secrets.id (encrypted whsk_)
  webhook_token  text not null unique,   -- our routing id for /api/webhooks/paymongo/[token] (M3)
  webhook_id     text,                   -- PayMongo's webhook id (for later management); set in M2
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id)                     -- one connection per tenant for now
);
create index tenant_gateway_connections_tenant_idx on public.tenant_gateway_connections (tenant_id);

-- RLS on, but NO policies and NO grant to anon/authenticated: operators never touch this table.
-- service_role bypasses RLS; granted explicitly so local and any fresh DB match hosted defaults.
alter table public.tenant_gateway_connections enable row level security;
grant all on public.tenant_gateway_connections to service_role;

-- ---------------------------------------------------------------------------
-- gateway_store_connection -- create or update a tenant's connection, encrypting sk_/whsk_ into
-- Vault. Re-connect (a tenant already has a row) UPDATES the existing Vault secrets in place via
-- vault.update_secret, so we never orphan or duplicate them. Vault secret NAME is left NULL to
-- sidestep Vault's unique-name constraint entirely; the description carries the tenant id for
-- human auditing, and the row's *_secret_id is the real handle. Returns the row WITHOUT secrets.
-- ---------------------------------------------------------------------------
create or replace function public.gateway_store_connection(
  p_tenant_id    uuid,
  p_sk           text,
  p_whsk         text,
  p_webhook_token text,
  p_webhook_id   text default null
)
returns public.tenant_gateway_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.tenant_gateway_connections;
  v_sk_id    uuid;
  v_whsk_id  uuid;
  v_row      public.tenant_gateway_connections;
begin
  select * into v_existing
  from public.tenant_gateway_connections
  where tenant_id = p_tenant_id;

  if found then
    -- Re-connect: rotate the secrets in place, keep the same Vault ids.
    perform vault.update_secret(v_existing.sk_secret_id, p_sk);
    perform vault.update_secret(v_existing.whsk_secret_id, p_whsk);

    update public.tenant_gateway_connections
    set webhook_token = p_webhook_token,
        webhook_id    = p_webhook_id,
        status        = 'active',
        updated_at    = now()
    where tenant_id = p_tenant_id
    returning * into v_row;
  else
    v_sk_id   := vault.create_secret(p_sk,   null, 'gateway sk for tenant ' || p_tenant_id);
    v_whsk_id := vault.create_secret(p_whsk, null, 'gateway whsk for tenant ' || p_tenant_id);

    insert into public.tenant_gateway_connections (
      tenant_id, provider, sk_secret_id, whsk_secret_id, webhook_token, webhook_id
    ) values (
      p_tenant_id, 'paymongo', v_sk_id, v_whsk_id, p_webhook_token, p_webhook_id
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- gateway_get_connection -- the decrypting reader. Joins the connection row to the decrypted Vault
-- secrets and returns the plaintext sk_/whsk_ plus routing metadata. service_role only; this is the
-- only path that ever yields a decrypted key, so the trust boundary is one function to audit.
-- ---------------------------------------------------------------------------
create or replace function public.gateway_get_connection(p_tenant_id uuid)
returns table (
  provider      text,
  sk            text,
  whsk          text,
  webhook_token text,
  webhook_id    text,
  status        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.provider,
         sk.decrypted_secret,
         whsk.decrypted_secret,
         c.webhook_token,
         c.webhook_id,
         c.status
  from public.tenant_gateway_connections c
  join vault.decrypted_secrets sk   on sk.id   = c.sk_secret_id
  join vault.decrypted_secrets whsk on whsk.id = c.whsk_secret_id
  where c.tenant_id = p_tenant_id;
$$;

-- Webhook/checkout server paths only: service_role. Never operators/anon/public. Supabase grants
-- execute to anon/authenticated by default on new public functions, so revoke them explicitly.
revoke execute on function public.gateway_store_connection(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.gateway_store_connection(uuid, text, text, text, text)
  to service_role;

revoke execute on function public.gateway_get_connection(uuid)
  from public, anon, authenticated;
grant execute on function public.gateway_get_connection(uuid)
  to service_role;
