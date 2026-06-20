// @vitest-environment node
//
// Phase 2b / M1 acceptance — the per-tenant gateway connection store. Proves the security boundary
// that the rest of 2b is built on: a tenant's PayMongo sk_/whsk_ round-trip through Vault via the
// service-role RPCs, rotate in place on re-connect, and are UNREACHABLE by an operator session (RLS
// with no policy + execute revoked from authenticated). INTEGRATION test: requires the local
// Supabase stack + .env.local (same run recipe as tests/confirm-booking-gateway.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

function loadEnvFile(file: string): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // file may be absent; env may already be set by the shell/CI
  }
}
// .env.local wins if present (dev override); otherwise the local Supabase stack vars live in
// .env.development. Both are tried so the integration test runs without a hand-made .env.local.
loadEnvFile(".env.local");
loadEnvFile(".env.development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
// service_role: the role the gateway DAL uses (the gateway_* RPCs are granted to it only).
const admin = createClient(url, secretKey, noPersist);

const createdUserIds: string[] = [];

type Operator = { userId: string; tenantId: string; client: SupabaseClient };

async function makeOperator(email: string): Promise<Operator> {
  const password = "test-password-123456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user!.id;
  createdUserIds.push(userId);

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (tErr) throw tErr;

  const client = createClient(url, publishableKey, noPersist);
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;

  return { userId, tenantId: tenant!.id as string, client };
}

async function store(
  tenantId: string,
  sk: string,
  whsk: string,
  token: string,
  webhookId?: string,
): Promise<void> {
  const { error } = await admin.rpc("gateway_store_connection", {
    p_tenant_id: tenantId,
    p_sk: sk,
    p_whsk: whsk,
    p_webhook_token: token,
    p_webhook_id: webhookId ?? undefined,
  });
  if (error) throw error;
}

afterAll(async () => {
  // auth.users ON DELETE CASCADE removes the tenant and its connection row.
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("gateway connection store (M1)", () => {
  let op: Operator;

  beforeAll(async () => {
    op = await makeOperator(`gw-conn-${Date.now()}@example.com`);
  });

  it("round-trips sk_/whsk_ through Vault via the service-role RPCs", async () => {
    const token = `tok_${op.tenantId}`;
    await store(op.tenantId, "sk_test_ABC", "whsk_test_XYZ", token);

    const { data, error } = await admin.rpc("gateway_get_connection", {
      p_tenant_id: op.tenantId,
    });
    expect(error).toBeNull();
    const row = (data as unknown[])[0] as {
      provider: string;
      sk: string;
      whsk: string;
      webhook_token: string;
      webhook_id: string | null;
      status: string;
    };
    expect(row.provider).toBe("paymongo");
    expect(row.sk).toBe("sk_test_ABC");
    expect(row.whsk).toBe("whsk_test_XYZ");
    expect(row.webhook_token).toBe(token);
    expect(row.status).toBe("active");
  });

  it("rotates the secrets in place on re-connect (still one row)", async () => {
    await store(op.tenantId, "sk_test_NEW", "whsk_test_NEW", `tok2_${op.tenantId}`, "wh_123");

    const { count, error: cErr } = await admin
      .from("tenant_gateway_connections")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", op.tenantId);
    expect(cErr).toBeNull();
    expect(count).toBe(1);

    const { data } = await admin.rpc("gateway_get_connection", { p_tenant_id: op.tenantId });
    const row = (data as { sk: string; whsk: string; webhook_id: string | null }[])[0];
    expect(row.sk).toBe("sk_test_NEW");
    expect(row.whsk).toBe("whsk_test_NEW");
    expect(row.webhook_id).toBe("wh_123");
  });

  it("returns no row for a tenant with no connection", async () => {
    const fresh = await makeOperator(`gw-none-${Date.now()}@example.com`);
    const { data, error } = await admin.rpc("gateway_get_connection", {
      p_tenant_id: fresh.tenantId,
    });
    expect(error).toBeNull();
    expect((data as unknown[]).length).toBe(0);
  });

  it("denies an operator session any access to the connection table or RPCs", async () => {
    // RLS with no policy → the operator's own row is invisible (empty, not an error).
    const { data: rows } = await op.client.from("tenant_gateway_connections").select("*");
    expect(rows ?? []).toHaveLength(0);

    // Execute is revoked from authenticated → the read RPC is forbidden.
    const { error: readErr } = await op.client.rpc("gateway_get_connection", {
      p_tenant_id: op.tenantId,
    });
    expect(readErr).not.toBeNull();

    // …and so is the write RPC.
    const { error: writeErr } = await op.client.rpc("gateway_store_connection", {
      p_tenant_id: op.tenantId,
      p_sk: "sk_attacker",
      p_whsk: "whsk_attacker",
      p_webhook_token: "tok_attacker",
    });
    expect(writeErr).not.toBeNull();
  });
});

describe("gateway connection status + disconnect (M2)", () => {
  let op: Operator;

  beforeAll(async () => {
    op = await makeOperator(`gw-m2-${Date.now()}@example.com`);
  });

  it("status RPC is self-scoped and never leaks secrets", async () => {
    // Before any connection: the operator's own session sees not-connected.
    const before = await op.client.rpc("gateway_connection_status");
    expect(before.error).toBeNull();
    expect((before.data as { connected: boolean }[])[0].connected).toBe(false);

    await store(op.tenantId, "sk_test_STATUS", "whsk_test_STATUS", `tok_status_${op.tenantId}`);

    const after = await op.client.rpc("gateway_connection_status");
    expect(after.error).toBeNull();
    const row = (after.data as Record<string, unknown>[])[0];
    expect(row.connected).toBe(true);
    expect(row.provider).toBe("paymongo");
    // Non-secret only: the sk/whsk must NOT be present on the status payload.
    expect(Object.keys(row)).toEqual(
      expect.arrayContaining(["connected", "provider", "status", "updated_at"]),
    );
    expect(JSON.stringify(row)).not.toContain("sk_test_STATUS");
    expect(JSON.stringify(row)).not.toContain("whsk_test_STATUS");

    // Self-scoped: a different operator's session sees their OWN (not-connected) status.
    const other = await makeOperator(`gw-m2-other-${Date.now()}@example.com`);
    const otherStatus = await other.client.rpc("gateway_connection_status");
    expect((otherStatus.data as { connected: boolean }[])[0].connected).toBe(false);
  });

  it("denies an operator session the disconnect RPC", async () => {
    const { error } = await op.client.rpc("gateway_delete_connection", {
      p_tenant_id: op.tenantId,
    });
    expect(error).not.toBeNull();
  });

  it("service-role disconnect removes the row and returns the old webhook id", async () => {
    await store(op.tenantId, "sk_test_DC", "whsk_test_DC", `tok_dc_${op.tenantId}`, "wh_dc_1");

    const { data: webhookId, error } = await admin.rpc("gateway_delete_connection", {
      p_tenant_id: op.tenantId,
    });
    expect(error).toBeNull();
    expect(webhookId).toBe("wh_dc_1");

    // Row is gone (the decrypting reader returns no row; Vault secrets are dropped server-side).
    const { data: rows } = await admin.rpc("gateway_get_connection", { p_tenant_id: op.tenantId });
    expect((rows as unknown[]).length).toBe(0);

    // And the operator's own status flips back to not-connected.
    const status = await op.client.rpc("gateway_connection_status");
    expect((status.data as { connected: boolean }[])[0].connected).toBe(false);
  });
});
