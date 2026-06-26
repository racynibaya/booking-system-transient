// @vitest-environment node
//
// The ACTIVATION half of the subscription money rail (companion to subscription-enforcement.test.ts).
// The lapse rule closes an operator who PAID then expired; this closes the other door — a never-paid
// signup (or delete-and-re-signup) who could otherwise book free forever. Mechanism: a free-trial window
// (tenants.trial_ends_at). Past it with no payment, under enforce + require_activation, the page closes —
// while GRANDFATHERED (null trial) and IN-TRIAL operators stay open, so no pilot is ever wrongful-closed.
//
// Gated by TWO switches (enforcement_mode='enforce' AND require_activation=true), so it ships doubly
// dormant. INTEGRATION test: local Supabase stack + .env.local (same recipe as tests/booking-hold.test.ts).
import { createClient } from "@supabase/supabase-js";
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
const admin = createClient(url, secretKey, noPersist);
const anon = createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];

async function makeOperator(email: string): Promise<{ tenantId: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123456",
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
  return { tenantId: tenant!.id as string };
}

async function makeRoom(tenantId: string): Promise<string> {
  const { data: property, error: pErr } = await admin
    .from("properties")
    .insert({
      tenant_id: tenantId,
      name: "Test Property",
      slug: `prop-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;
  const { data: room, error: rErr } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Test Room",
      capacity: 4,
      quantity: 5,
      base_price: 1500,
    })
    .select("id")
    .single();
  if (rErr) throw rErr;
  return room!.id as string;
}

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

// A never-paid operator: paid_until null, with an explicit trial deadline.
async function setNeverPaid(tenantId: string, trialEndsAt: string | null) {
  const { error } = await admin
    .from("tenants")
    .update({ subscription_status: "trialing", paid_until: null, trial_ends_at: trialEndsAt })
    .eq("id", tenantId);
  if (error) throw error;
}

async function setConfig(mode: "off" | "dry_run" | "enforce", requireActivation: boolean) {
  const { error } = await admin
    .from("billing_config")
    .update({ enforcement_mode: mode, require_activation: requireActivation })
    .eq("id", true);
  if (error) throw error;
}

async function entitlement(tenantId: string) {
  const { data, error } = await admin
    .from("tenant_subscription_entitlement")
    .select("is_unactivated, can_accept_bookings")
    .eq("tenant_id", tenantId)
    .single();
  if (error) throw error;
  return data!;
}

function holdAnon(roomTypeId: string) {
  return anon.rpc("create_booking_hold", {
    p_room_type_id: roomTypeId,
    p_check_in: isoDate(400),
    p_check_out: isoDate(403),
    p_num_guests: 2,
    p_guest_name: "Guest",
  });
}

afterAll(async () => {
  await setConfig("off", false); // never leave either switch on for other suites
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

describe("activation: a fresh signup is grandfathered/in-trial by default — nothing changes while inert", () => {
  it("a brand-new operator gets a ~14-day trial window (open now)", async () => {
    const op = await makeOperator(`act-fresh-${Date.now()}@example.com`);
    const { data } = await admin
      .from("tenants")
      .select("trial_ends_at, paid_until")
      .eq("id", op.tenantId)
      .single();
    expect(data!.paid_until).toBeNull();
    // default (current_date + 14): comfortably in the future
    expect(new Date(data!.trial_ends_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("even an expired-trial never-payer books while require_activation is off (doubly dormant)", async () => {
    await setConfig("enforce", false); // lapse half on, activation half OFF
    const op = await makeOperator(`act-dormant-${Date.now()}@example.com`);
    const room = await makeRoom(op.tenantId);
    await setNeverPaid(op.tenantId, isoDate(-30)); // trial long gone
    expect((await entitlement(op.tenantId)).can_accept_bookings).toBe(true);
    expect((await holdAnon(room)).error).toBeNull();
    await setConfig("off", false);
  });
});

describe("activation: enforce + require_activation — the never-pay gap, closed", () => {
  beforeAll(() => setConfig("enforce", true));
  afterAll(() => setConfig("off", false));

  it("matrix: grandfathered(null)→open, in-trial→open, in-grace→open, past-grace→CLOSED", async () => {
    const mk = async (trial: string | null) => {
      const op = await makeOperator(`act-mx-${Math.random().toString(36).slice(2)}@example.com`);
      await setNeverPaid(op.tenantId, trial);
      return entitlement(op.tenantId);
    };
    expect((await mk(null)).can_accept_bookings).toBe(true); // grandfathered: never trial-expires
    expect((await mk(isoDate(7))).can_accept_bookings).toBe(true); // still in trial
    expect((await mk(isoDate(-2))).can_accept_bookings).toBe(true); // within 3-day grace
    const closed = await mk(isoDate(-5)); // trial ended, past grace, never paid
    expect(closed.is_unactivated).toBe(true);
    expect(closed.can_accept_bookings).toBe(false);
  });

  it("blocks the booking engine for an unactivated operator (same chokepoint, both paths)", async () => {
    const op = await makeOperator(`act-block-${Date.now()}@example.com`);
    const room = await makeRoom(op.tenantId);
    await setNeverPaid(op.tenantId, isoDate(-10));
    const res = await holdAnon(room);
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("SUBSCRIPTION_LAPSED");
  });

  it("a grandfathered pilot (null trial) is NEVER closed, even with both switches on", async () => {
    const op = await makeOperator(`act-pilot-${Date.now()}@example.com`);
    const room = await makeRoom(op.tenantId);
    await setNeverPaid(op.tenantId, null);
    expect((await holdAnon(room)).error).toBeNull();
  });

  it("paying reopens an expired-trial operator instantly (live evaluation)", async () => {
    const op = await makeOperator(`act-pay-${Date.now()}@example.com`);
    const room = await makeRoom(op.tenantId);
    await setNeverPaid(op.tenantId, isoDate(-10));
    expect((await holdAnon(room)).error).not.toBeNull(); // closed

    const rec = await admin.rpc("record_subscription_payment", {
      p_tenant_id: op.tenantId,
      p_plan: "pro",
      p_amount: 2500,
      p_checkout_id: `cs_act_${Date.now()}`,
      p_provider_ref: null,
    });
    expect(rec.error).toBeNull();
    expect((await entitlement(op.tenantId)).can_accept_bookings).toBe(true);
    expect((await holdAnon(room)).error).toBeNull(); // reopened
  });
});
