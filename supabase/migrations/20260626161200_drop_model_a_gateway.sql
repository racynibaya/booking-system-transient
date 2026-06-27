-- Dead-code cleanup: retire Model-A (per-tenant operator-as-merchant PayMongo gateway). Superseded by
-- the centralized aggregator (one platform account + payout ledger); its app surface is removed in the
-- same change. Drop the 5 self-scoped/service-role RPCs and the connection store. The table holds 0
-- rows and has no inbound FKs, so no Vault secrets are orphaned. Recoverable from git history.
--
-- NOT touched: confirm_booking_gateway (shared with the aggregator — its null gateway_charge_amount
-- branch is a harmless coalesce) and the flat /api/webhooks/paymongo endpoint.

drop function if exists public.gateway_connection_status();
drop function if exists public.gateway_delete_connection(uuid);
drop function if exists public.gateway_get_connection(uuid);
drop function if exists public.gateway_get_connection_by_token(text);
drop function if exists public.gateway_store_connection(uuid, text, text, text, text);

drop table if exists public.tenant_gateway_connections;
