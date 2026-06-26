// @vitest-environment node
//
// The subscription ENFORCEMENT money rail (bulletproofing): one entitlement authority
// (tenant_subscription_entitlement) drives a single live guard inside create_booking_hold — the one
// engine BOTH the public guest flow and the operator manual-entry flow go through (architecture P7).
// This pins: dormancy while off, the lapse matrix, the engine guard, the humane line (existing data +
// renewal), and read-seam parity (/[slug] + grid). INTEGRATION test: requires the local Supabase stack
// + .env.local (same run recipe as tests/booking-hold.test.ts).
//
// NOTE billing_config is a single global row. We set enforcement_mode for a block and restore 'off'
// after. This only affects tenants that are lapsed (expired paid_until) AND hit the seams — every other
// test creates fresh trialing/null-paid_until tenants, which the matrix below proves are never closed.
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
// anon: exactly how BOTH booking paths reach the engine (public flow + operator manual entry both call
// create_booking_hold via an anon client). Hitting the RPC through anon covers both at once.
const anon = createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];

type Operator = { userId: string; tenantId: string };

async function makeOperator(email: string): Promise<Operator> {
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
  return { userId, tenantId: tenant!.id as string };
}

async function makeRoomType(tenantId: string, slug?: string): Promise<string> {
  const { data: property, error: pErr } = await admin
    .from("properties")
    .insert({
      tenant_id: tenantId,
      name: "Test Property",
      slug: slug ?? `prop-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  const { data: roomType, error: rErr } = await admin
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
  return roomType!.id as string;
}

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function setBilling(tenantId: string, paidUntil: string | null, status = "active") {
  const { error } = await admin
    .from("tenants")
    .update({ subscription_status: status, paid_until: paidUntil })
    .eq("id", tenantId);
  if (error) throw error;
}

async function setMode(mode: "off" | "dry_run" | "enforce") {
  const { error } = await admin
    .from("billing_config")
    .update({ enforcement_mode: mode })
    .eq("id", true);
  if (error) throw error;
}

async function entitlement(tenantId: string) {
  const { data, error } = await admin
    .from("tenant_subscription_entitlement")
    .select("is_lapsed, can_accept_bookings, counts_as_paid")
    .eq("tenant_id", tenantId)
    .single();
  if (error) throw error;
  return data!;
}

// Book through the engine via anon — mirrors both real paths. Far-future dates so availability never bites.
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
  await setMode("off"); // never leave enforcement on for other suites
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("dormant by construction (enforcement_mode = 'off', the pilot default)", () => {
  it("lets even a long-lapsed operator book — shipping this changes nothing until the switch flips", async () => {
    const op = await makeOperator(`enf-dormant-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    await setBilling(op.tenantId, isoDate(-100), "past_due"); // lapsed 100 days

    const ent = await entitlement(op.tenantId);
    expect(ent.is_lapsed).toBe(true); // the fact is computed...
    expect(ent.can_accept_bookings).toBe(true); // ...but off mode never enforces it

    const res = await holdAnon(room);
    expect(res.error).toBeNull();
  });
});

describe("enforcement_mode = 'enforce' — the lapse matrix + the engine guard", () => {
  beforeAll(() => setMode("enforce"));
  afterAll(() => setMode("off"));

  it("matrix: never-paid(null)→open, future→open, in-grace→open, past-grace→closed", async () => {
    const mk = async (paidUntil: string | null, status: string) => {
      const op = await makeOperator(`enf-mx-${Math.random().toString(36).slice(2)}@example.com`);
      await setBilling(op.tenantId, paidUntil, status);
      return entitlement(op.tenantId);
    };
    // grace_days = 3
    expect((await mk(null, "trialing")).can_accept_bookings).toBe(true); // never-paid: no wrongful close
    expect((await mk(isoDate(30), "active")).can_accept_bookings).toBe(true); // current
    expect((await mk(isoDate(-2), "past_due")).can_accept_bookings).toBe(true); // within 3-day grace
    expect((await mk(isoDate(-4), "past_due")).can_accept_bookings).toBe(false); // past grace → closed
  });

  it("blocks the booking engine for a lapsed operator (covers public AND manual entry — one chokepoint)", async () => {
    const op = await makeOperator(`enf-block-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    await setBilling(op.tenantId, isoDate(-10), "past_due");

    const res = await holdAnon(room);
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("SUBSCRIPTION_LAPSED");
  });

  it("still lets an in-grace operator book", async () => {
    const op = await makeOperator(`enf-grace-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    await setBilling(op.tenantId, isoDate(-2), "past_due"); // within 3-day grace
    expect((await holdAnon(room)).error).toBeNull();
  });

  it("never closes a never-paid / pilot operator (null paid_until) even with enforcement on", async () => {
    const op = await makeOperator(`enf-pilot-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    // fresh operator: trialing, paid_until null
    expect((await holdAnon(room)).error).toBeNull();
  });

  it("humane line: renewal reopens instantly with NO cron run (live evaluation)", async () => {
    const op = await makeOperator(`enf-renew-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    await setBilling(op.tenantId, isoDate(-10), "past_due");
    expect((await holdAnon(room)).error).not.toBeNull(); // closed

    // The webhook records a payment → advances paid_until. No cron, no status sweep needed.
    const rec = await admin.rpc("record_subscription_payment", {
      p_tenant_id: op.tenantId,
      p_plan: "pro",
      p_amount: 2500,
      p_checkout_id: `cs_renew_${Date.now()}`,
      p_provider_ref: null,
    });
    expect(rec.error).toBeNull();
    expect((await entitlement(op.tenantId)).can_accept_bookings).toBe(true);
    expect((await holdAnon(room)).error).toBeNull(); // reopened
  });

  it("admin_mark_subscription_paid recovers an operator wrongly closed by a missed webhook", async () => {
    const op = await makeOperator(`enf-recover-${Date.now()}@example.com`);
    const room = await makeRoomType(op.tenantId);
    await setBilling(op.tenantId, isoDate(-10), "past_due");
    expect((await holdAnon(room)).error).not.toBeNull();

    const fix = await admin.rpc("admin_mark_subscription_paid", {
      p_tenant_id: op.tenantId,
      p_paid_until: isoDate(20),
    });
    expect(fix.error).toBeNull();
    expect((await holdAnon(room)).error).toBeNull();
  });
});

describe("read-seam parity — the closed page disappears the same way the engine refuses", () => {
  let tenantId: string;
  let slug: string;

  beforeAll(async () => {
    const op = await makeOperator(`enf-seam-${Date.now()}@example.com`);
    tenantId = op.tenantId;
    slug = `seam-${Date.now()}`;
    await admin.from("tenants").update({ verification_status: "approved" }).eq("id", tenantId);
    await makeRoomType(tenantId, slug);
    await setBilling(tenantId, isoDate(-10), "past_due"); // lapsed past grace
  });

  it("resolves /[slug] while off, 404s (null) under enforce", async () => {
    await setMode("off");
    const open = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(open.error).toBeNull();
    expect(open.data).not.toBeNull();

    await setMode("enforce");
    const closed = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(closed.error).toBeNull();
    expect(closed.data).toBeNull(); // page closed → notFound()
    await setMode("off");
  });
});
