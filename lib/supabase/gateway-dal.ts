import "server-only";

import { createServiceClient } from "./server";

// Gateway Data Access Layer (Phase 2b). The ONLY module that handles a tenant's decrypted PayMongo
// credentials — kept in one place so the trust boundary is easy to audit, the same way cross-tenant
// reads live only in lib/supabase/admin-dal.ts. Everything here uses the service-role client and
// goes through the two SECURITY DEFINER RPCs (gateway_store_connection / gateway_get_connection),
// which are the only callers Vault is reachable through (architecture P1: secrets never go through
// app-level check-then-write). Raw sk_/whsk_ live encrypted in Vault; this layer is where they are
// briefly in plaintext to make a PayMongo call (M3/M4) — never logged, never returned to a client.

export type GatewayConnection = {
  provider: string;
  sk: string;
  whsk: string;
  webhookToken: string;
  webhookId: string | null;
  status: string;
};

export type StoreGatewayConnectionInput = {
  tenantId: string;
  sk: string;
  whsk: string;
  webhookToken: string;
  webhookId?: string | null;
};

// Create or rotate a tenant's gateway connection (encrypts sk_/whsk_ into Vault). Idempotent per
// tenant: a second call rotates the secrets in place and keeps a single row.
export async function storeGatewayConnection(input: StoreGatewayConnectionInput): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.rpc("gateway_store_connection", {
    p_tenant_id: input.tenantId,
    p_sk: input.sk,
    p_whsk: input.whsk,
    p_webhook_token: input.webhookToken,
    p_webhook_id: input.webhookId ?? undefined,
  });
  if (error) throw new Error(`storeGatewayConnection failed: ${error.message}`);
}

// Read a tenant's decrypted connection, or null if they have none. The decrypted keys live only in
// the returned object — callers (M3 webhook verify, M4 checkout) use them and let them go out of
// scope; do not persist or log them.
export async function getGatewayConnection(tenantId: string): Promise<GatewayConnection | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("gateway_get_connection", { p_tenant_id: tenantId });
  if (error) throw new Error(`getGatewayConnection failed: ${error.message}`);

  // The RPC returns a set (0 or 1 row for the unique tenant).
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    provider: row.provider,
    sk: row.sk,
    whsk: row.whsk,
    webhookToken: row.webhook_token,
    webhookId: row.webhook_id,
    status: row.status,
  };
}
