// @vitest-environment node
//
// Slice A acceptance — the consent audit record (tenant_consents). Pins the invariants the legal
// clickwrap depends on (context/legal-content.md §4): a consent row is written scoped to the
// operator, is IMMUTABLE (no update/delete — the audit guarantee), is only visible to its own
// tenant, and can also be written by the service-role path (the future signup seam). INTEGRATION
// test: requires the local Supabase stack + .env.local (same recipe as confirm-booking-gateway.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { recordConsent } from "@/lib/legal/consent";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // env may already be set by the shell/CI
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
const admin = createClient(url, secretKey, noPersist);

const createdUserIds: string[] = [];
const meta = { ip: "1.2.3.4", userAgent: "test-agent/1.0" };

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
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades tenant_consents
});

describe("tenant_consents — immutable operator consent audit record", () => {
  let op: Operator;
  beforeAll(async () => {
    op = await makeOperator(`consent-${Date.now()}@example.com`);
  });

  it("records a consent row scoped to the operator (context + version + IP + user-agent)", async () => {
    await recordConsent(op.client, { tenantId: op.tenantId, context: "operator_agreement", meta });

    const { data, error } = await op.client
      .from("tenant_consents")
      .select("tenant_id, context, terms_version, ip, user_agent")
      .eq("tenant_id", op.tenantId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      tenant_id: op.tenantId,
      context: "operator_agreement",
      terms_version: "2026-07-01",
      ip: "1.2.3.4",
      user_agent: "test-agent/1.0",
    });
  });

  it("refuses an insert scoped to another tenant (RLS with-check)", async () => {
    const other = await makeOperator(`consent-other-${Date.now()}@example.com`);
    // op's client trying to write a row for other's tenant → RLS with-check denies it.
    await expect(
      recordConsent(op.client, { tenantId: other.tenantId, context: "operator_agreement", meta }),
    ).rejects.toBeTruthy();
  });

  it("is IMMUTABLE — no update or delete grant to the operator", async () => {
    const { data: rows } = await op.client
      .from("tenant_consents")
      .select("id")
      .eq("tenant_id", op.tenantId)
      .limit(1);
    const id = rows![0].id as string;

    const upd = await op.client
      .from("tenant_consents")
      .update({ terms_version: "tampered" })
      .eq("id", id)
      .select();
    expect(upd.error).not.toBeNull(); // permission denied — no update grant

    const del = await op.client.from("tenant_consents").delete().eq("id", id).select();
    expect(del.error).not.toBeNull(); // permission denied — no delete grant

    // The row is untouched.
    const { data: after } = await admin
      .from("tenant_consents")
      .select("terms_version")
      .eq("id", id)
      .single();
    expect(after!.terms_version).toBe("2026-07-01");
  });

  it("is only visible to its own tenant (RLS select-own)", async () => {
    const other = await makeOperator(`consent-peek-${Date.now()}@example.com`);
    const { data } = await other.client
      .from("tenant_consents")
      .select("id")
      .eq("tenant_id", op.tenantId);
    expect(data).toHaveLength(0); // can't see another operator's consents
  });

  it("accepts a service-role write (the signup seam, no operator session)", async () => {
    const solo = await makeOperator(`consent-svc-${Date.now()}@example.com`);
    await recordConsent(admin, { tenantId: solo.tenantId, context: "operator_signup", meta });
    const { data } = await admin
      .from("tenant_consents")
      .select("context")
      .eq("tenant_id", solo.tenantId);
    expect(data).toHaveLength(1);
    expect(data![0].context).toBe("operator_signup");
  });
});
