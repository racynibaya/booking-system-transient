-- Phase 2b / M3 — token-routed webhook lookup.
--
-- An inbound PayMongo webhook lands at /api/webhooks/paymongo/[token], where {token} is the
-- connection's opaque webhook_token (NOT a secret — see 20260620100100). To verify the event we
-- need THAT tenant's whsk_, so this is the by-token twin of gateway_get_connection: same decrypting
-- reader, same one-function trust boundary, keyed on the unique webhook_token instead of tenant_id.
-- Returns tenant_id too so the route can scope/audit the confirm. service_role only.

create or replace function public.gateway_get_connection_by_token(p_token text)
returns table (
  tenant_id     uuid,
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
  select c.tenant_id,
         c.provider,
         sk.decrypted_secret,
         whsk.decrypted_secret,
         c.webhook_token,
         c.webhook_id,
         c.status
  from public.tenant_gateway_connections c
  join vault.decrypted_secrets sk   on sk.id   = c.sk_secret_id
  join vault.decrypted_secrets whsk on whsk.id = c.whsk_secret_id
  where c.webhook_token = p_token;
$$;

-- Webhook server path only: service_role. Revoke the default anon/authenticated grant explicitly.
revoke execute on function public.gateway_get_connection_by_token(text)
  from public, anon, authenticated;
grant execute on function public.gateway_get_connection_by_token(text)
  to service_role;
