// @vitest-environment node
//
// Phase 3 / P3.1 guard — proves an operator session CANNOT set its own `tenants.plan`. The column
// lockdown (20260619120000_operator_verification.sql) revoked table-wide UPDATE and re-granted only
// name/gcash_* columns; `plan` was added later and Postgres does not extend a column-list grant to a
// new column, so an operator self-setting plan='business' must be denied. Manual-first billing (B4)
// depends on this: a plan is set by admin/service-role, never by the operator. INTEGRATION test:
// requires the local Supabase stack + .env.local/.env.development (same recipe as
// tests/gateway-connection.test.ts).
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
loadEnvFile(".env.local");
loadEnvFile(".env.development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
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

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("tenant plan lockdown (P3.1)", () => {
  let op: Operator;

  beforeAll(async () => {
    op = await makeOperator(`plan-lockdown-${Date.now()}@example.com`);
  });

  it("starts a new operator on the free plan", async () => {
    const { data } = await admin.from("tenants").select("plan").eq("id", op.tenantId).single();
    expect(data!.plan).toBe("free");
  });

  it("denies an operator self-setting plan='business'", async () => {
    // The update is rejected at the column-grant level; even if PostgREST returns no error, the
    // value must be unchanged when read back through service-role.
    await op.client.from("tenants").update({ plan: "business" }).eq("id", op.tenantId);

    const { data } = await admin.from("tenants").select("plan").eq("id", op.tenantId).single();
    expect(data!.plan).toBe("free");
  });

  it("still lets an operator update an allowlisted column (name)", async () => {
    const { error } = await op.client
      .from("tenants")
      .update({ name: "Renamed Transient" })
      .eq("id", op.tenantId);
    expect(error).toBeNull();

    const { data } = await admin.from("tenants").select("name").eq("id", op.tenantId).single();
    expect(data!.name).toBe("Renamed Transient");
  });
});
