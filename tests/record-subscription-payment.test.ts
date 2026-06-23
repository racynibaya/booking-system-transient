// @vitest-environment node
//
// Phase A acceptance — the subscription billing seam (record_subscription_payment). The platform
// PayMongo webhook records an operator's subscription payment with no operator session, idempotently,
// advancing the tenant's plan + paid_until. INTEGRATION test: requires the local Supabase stack +
// .env.local (same run recipe as tests/confirm-booking-gateway.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

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
// service_role: the role the webhook handler uses (record_subscription_payment is granted to it only).
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

function recordPayment(
  tenantId: string,
  opts: { plan?: string; amount?: number; checkoutId: string; ref?: string; months?: number },
) {
  return admin.rpc("record_subscription_payment", {
    p_tenant_id: tenantId,
    p_plan: opts.plan ?? "solo",
    p_amount: opts.amount ?? 990,
    p_checkout_id: opts.checkoutId,
    p_provider_ref: opts.ref ?? null,
    ...(opts.months !== undefined ? { p_months: opts.months } : {}),
  });
}

// Whole months between two date strings, ignoring the day-of-month (period boundaries are date-aligned).
function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function tenantBilling(tenantId: string) {
  return admin
    .from("tenants")
    .select("plan, subscription_status, paid_until")
    .eq("id", tenantId)
    .single();
}

function ledger(tenantId: string) {
  return admin.from("subscription_payments").select("*").eq("tenant_id", tenantId);
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("record_subscription_payment (the platform-billing webhook seam, P7/P10)", () => {
  let op: Operator;
  beforeAll(async () => {
    op = await makeOperator(`subs-${Date.now()}@example.com`);
  });

  it("records a payment → activates the plan, advances paid_until, writes one ledger row", async () => {
    const res = await recordPayment(op.tenantId, { plan: "pro", amount: 2500, checkoutId: "cs_a" });
    expect(res.error).toBeNull();
    expect(res.data!.id).toBeTruthy();
    expect(res.data!.plan).toBe("pro");

    const { data: t } = await tenantBilling(op.tenantId);
    expect(t!.plan).toBe("pro");
    expect(t!.subscription_status).toBe("active");
    expect(t!.paid_until).not.toBeNull();
    // paid_until is in the future (≈1 month out).
    expect(new Date(t!.paid_until as string).getTime()).toBeGreaterThan(Date.now());

    const rows = await ledger(op.tenantId);
    expect(rows.data).toHaveLength(1);
    expect(new Date(rows.data![0].period_end).getTime()).toBeGreaterThan(
      new Date(rows.data![0].period_start).getTime(),
    );
  });

  it("is idempotent — replaying the same checkout is a no-op, never a second month", async () => {
    const before = await tenantBilling(op.tenantId);

    const replay = await recordPayment(op.tenantId, {
      plan: "pro",
      amount: 2500,
      checkoutId: "cs_a",
    });
    expect(replay.error).toBeNull();
    // NULL composite renders as an all-null object via PostgREST — guard on a real field.
    expect(replay.data?.id).toBeFalsy();

    const after = await tenantBilling(op.tenantId);
    expect(after.data!.paid_until).toBe(before.data!.paid_until); // not double-extended
    expect((await ledger(op.tenantId)).data).toHaveLength(1); // still one row
  });

  it("stacks a distinct payment — extends paid_until from the existing date, not today", async () => {
    const before = await tenantBilling(op.tenantId);

    const second = await recordPayment(op.tenantId, {
      plan: "pro",
      amount: 2500,
      checkoutId: "cs_b",
    });
    expect(second.error).toBeNull();
    expect(second.data!.id).toBeTruthy();

    const after = await tenantBilling(op.tenantId);
    // The new period starts where the old one ended → paid_until pushed out another month.
    expect(new Date(after.data!.paid_until as string).getTime()).toBeGreaterThan(
      new Date(before.data!.paid_until as string).getTime(),
    );
    expect((await ledger(op.tenantId)).data).toHaveLength(2);
  });

  it("records an annual payment (p_months=12) → advances paid_until a full year", async () => {
    const annual = await makeOperator(`annual-${Date.now()}@example.com`);
    const res = await recordPayment(annual.tenantId, {
      plan: "pro",
      amount: 25000,
      checkoutId: "cs_year",
      months: 12,
    });
    expect(res.error).toBeNull();
    expect(res.data!.id).toBeTruthy();
    // The ledger period spans 12 months, not 1.
    expect(monthsBetween(res.data!.period_start, res.data!.period_end)).toBe(12);

    const { data: t } = await tenantBilling(annual.tenantId);
    expect(t!.plan).toBe("pro");
    expect(monthsBetween(new Date().toISOString().slice(0, 10), t!.paid_until as string)).toBe(12);
  });

  it("refuses an unknown tenant", async () => {
    const res = await recordPayment("00000000-0000-0000-0000-000000000000", {
      checkoutId: "cs_unknown",
    });
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("UNKNOWN_TENANT");
  });
});

describe("flag_past_due_subscriptions (the automated lapse flag)", () => {
  async function setBilling(tenantId: string, status: string, paidUntil: string) {
    const { error } = await admin
      .from("tenants")
      .update({ subscription_status: status, paid_until: paidUntil })
      .eq("id", tenantId);
    if (error) throw error;
  }

  it("flips only active tenants whose paid_until has lapsed", async () => {
    const lapsed = await makeOperator(`lapsed-${Date.now()}@example.com`);
    const current = await makeOperator(`current-${Date.now()}@example.com`);
    await setBilling(lapsed.tenantId, "active", "2020-01-01"); // long past
    await setBilling(current.tenantId, "active", "2999-01-01"); // far future

    const res = await admin.rpc("flag_past_due_subscriptions");
    expect(res.error).toBeNull();

    const after = async (id: string) =>
      (await admin.from("tenants").select("subscription_status").eq("id", id).single()).data!
        .subscription_status;
    expect(await after(lapsed.tenantId)).toBe("past_due");
    expect(await after(current.tenantId)).toBe("active");

    // Idempotent — re-running doesn't re-flip an already past_due tenant.
    await admin.rpc("flag_past_due_subscriptions");
    expect(await after(lapsed.tenantId)).toBe("past_due");
  });
});

describe("downgrade_lapsed_subscriptions (dormant enforcement — flip on post-pilot)", () => {
  async function setBilling(tenantId: string, plan: string, status: string, paidUntil: string) {
    const { error } = await admin
      .from("tenants")
      .update({ plan, subscription_status: status, paid_until: paidUntil })
      .eq("id", tenantId);
    if (error) throw error;
  }
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  it("downgrades a past-due tenant beyond the grace window to free; spares those within grace", async () => {
    const beyond = await makeOperator(`dg-beyond-${Date.now()}@example.com`);
    const within = await makeOperator(`dg-within-${Date.now()}@example.com`);
    await setBilling(beyond.tenantId, "pro", "past_due", daysAgo(10)); // > 7-day grace
    await setBilling(within.tenantId, "pro", "past_due", daysAgo(2)); //  < grace

    const res = await admin.rpc("downgrade_lapsed_subscriptions", { p_grace_days: 7 });
    expect(res.error).toBeNull();

    const row = async (id: string) =>
      (
        await admin
          .from("tenants")
          .select("plan, subscription_status, paid_until")
          .eq("id", id)
          .single()
      ).data!;
    const b = await row(beyond.tenantId);
    expect(b.plan).toBe("free");
    expect(b.subscription_status).toBe("cancelled");
    expect(b.paid_until).toBeNull();

    const w = await row(within.tenantId);
    expect(w.plan).toBe("pro"); // still within grace → untouched
    expect(w.subscription_status).toBe("past_due");
  });
});
