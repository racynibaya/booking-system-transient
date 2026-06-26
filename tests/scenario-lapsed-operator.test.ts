// @vitest-environment node
//
// SCENARIO (the business problem this whole change exists to fix): "Buy one month of Pro, max out the
// rooms, then go free forever." In a commission-free model the booking engine IS the paid value, so a
// lapsed operator who keeps taking bookings means nobody ever has a reason to renew. This walks the full
// lifecycle as one story and proves the exploit is closed — WITHOUT ever wrongful-closing a paying or
// pilot operator, and WITHOUT touching existing bookings.
//
// It exercises the real database through the same seams the app uses (architecture P7: one booking
// engine for both the public guest flow and operator manual entry). INTEGRATION test: requires the local
// Supabase stack + .env.local (same run recipe as tests/booking-hold.test.ts).
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
    // env may already be set by the shell/CI
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
const admin = createClient(url, secretKey, noPersist);
// anon: how BOTH booking paths reach the engine (public flow + operator manual entry both call
// create_booking_hold via an anon client). Hitting the RPC through anon exercises both at once.
const anon = createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

type Operator = { userId: string; tenantId: string; client: SupabaseClient };

async function makeApprovedOperator(email: string): Promise<Operator> {
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
  // Approved → publicly visible (the verification gate is separate from the subscription gate).
  await admin.from("tenants").update({ verification_status: "approved" }).eq("id", tenant!.id);

  const client = createClient(url, publishableKey, noPersist);
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { userId, tenantId: tenant!.id as string, client };
}

async function makeRoom(tenantId: string, slug: string): Promise<string> {
  const { data: property, error: pErr } = await admin
    .from("properties")
    .insert({ tenant_id: tenantId, name: "Surf House", slug })
    .select("id")
    .single();
  if (pErr) throw pErr;
  const { data: room, error: rErr } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Loft",
      capacity: 4,
      quantity: 5,
      base_price: 2000,
    })
    .select("id")
    .single();
  if (rErr) throw rErr;
  return room!.id as string;
}

function guestBooks(roomTypeId: string, checkIn: string, checkOut: string) {
  return anon.rpc("create_booking_hold", {
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_num_guests: 2,
    p_guest_name: "Walk-in Guest",
    p_guest_email: "guest@example.com",
  });
}

function recordProPayment(tenantId: string, checkoutId: string) {
  return admin.rpc("record_subscription_payment", {
    p_tenant_id: tenantId,
    p_plan: "pro",
    p_amount: 2500,
    p_checkout_id: checkoutId,
    p_provider_ref: null,
  });
}

async function setMode(mode: "off" | "dry_run" | "enforce") {
  const { error } = await admin
    .from("billing_config")
    .update({ enforcement_mode: mode })
    .eq("id", true);
  if (error) throw error;
}

async function setPaidUntil(tenantId: string, paidUntil: string | null, status: string) {
  const { error } = await admin
    .from("tenants")
    .update({ paid_until: paidUntil, subscription_status: status })
    .eq("id", tenantId);
  if (error) throw error;
}

afterAll(async () => {
  await setMode("off"); // never leave enforcement on for other suites
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("SCENARIO: 'buy one month of Pro, then go free forever' — the exploit, closed", () => {
  const run = Date.now();
  const slug = `surf-house-${run}`;
  let op: Operator;
  let room: string;
  let existingBookingId: string; // a real booking taken WHILE paying — must survive everything

  beforeAll(async () => {
    op = await makeApprovedOperator(`scenario-${run}@example.com`);
    room = await makeRoom(op.tenantId, slug);
    // Post-pilot world: enforcement is switched ON. The whole point is that, with it on, an HONEST
    // paying operator is completely unaffected — only a lapsed-past-grace one is closed.
    await setMode("enforce");
  });

  it("Act 1 — operator pays for Pro and takes a real booking", async () => {
    const pay = await recordProPayment(op.tenantId, `cs_scenario_a_${run}`);
    expect(pay.error).toBeNull();

    // Paying → fully entitled even with enforcement ON.
    const ent = await admin
      .from("tenant_subscription_entitlement")
      .select("can_accept_bookings, is_lapsed")
      .eq("tenant_id", op.tenantId)
      .single();
    expect(ent.data!.can_accept_bookings).toBe(true);
    expect(ent.data!.is_lapsed).toBe(false);

    // A guest books and pays — this booking is the operator's real revenue; it must be honored forever.
    const booked = await guestBooks(room, isoDate(40), isoDate(43));
    expect(booked.error).toBeNull();
    existingBookingId = (booked.data as { id: string }).id;

    // Their /[slug] page is live and they appear in the marketplace grid.
    const listing = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(listing.data).not.toBeNull();
    const grid = (await anon.rpc("list_public_listings")).data as { slug: string }[];
    expect(grid.some((r) => r.slug === slug)).toBe(true);
  });

  it("Act 2 — they stop paying, but within the 3-day grace nothing changes", async () => {
    await setPaidUntil(op.tenantId, isoDate(-2), "past_due"); // lapsed 2 days ago → still in grace

    const ent = await admin
      .from("tenant_subscription_entitlement")
      .select("can_accept_bookings")
      .eq("tenant_id", op.tenantId)
      .single();
    expect(ent.data!.can_accept_bookings).toBe(true); // grace forgives a late payment

    const stillWorks = await guestBooks(room, isoDate(50), isoDate(53));
    expect(stillWorks.error).toBeNull();
  });

  it("Act 3 — past grace, the exploit is closed: NO path can take a new booking", async () => {
    await setPaidUntil(op.tenantId, isoDate(-10), "past_due"); // well past the 3-day grace

    const ent = await admin
      .from("tenant_subscription_entitlement")
      .select("is_lapsed, can_accept_bookings")
      .eq("tenant_id", op.tenantId)
      .single();
    expect(ent.data!.is_lapsed).toBe(true);
    expect(ent.data!.can_accept_bookings).toBe(false);

    // (a) public guest flow — blocked at the one engine.
    const guest = await guestBooks(room, isoDate(60), isoDate(63));
    expect(guest.error).not.toBeNull();
    expect(guest.error!.message).toContain("SUBSCRIPTION_LAPSED");

    // (b) operator manual entry — SAME engine (P7), so it's blocked too. We model the manual path the
    // way the action does: create_booking_hold via the anon client. The side door is closed.
    const manual = await guestBooks(room, isoDate(64), isoDate(66));
    expect(manual.error!.message).toContain("SUBSCRIPTION_LAPSED");

    // (c) read seams: their /[slug] page 404s (null) and they drop off the marketplace grid.
    const listing = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(listing.data).toBeNull();
    const grid = (await anon.rpc("list_public_listings")).data as { slug: string }[];
    expect(grid.some((r) => r.slug === slug)).toBe(false);

    // (d) the operator's OWN dashboard knows it's closed → drives the "page closed, renew" banner +
    // the upfront notice on /bookings/new (nudge, not a lock).
    const ownSignal = await op.client.rpc("current_tenant_can_accept_bookings");
    expect(ownSignal.data).toBe(false);
  });

  it("Act 4 — the humane line: the existing booking is honored, the operator still manages it", async () => {
    // The booking taken while paying is untouched by the closure.
    const { data: booking } = await admin
      .from("bookings")
      .select("id, status")
      .eq("id", existingBookingId)
      .single();
    expect(booking).not.toBeNull();

    // The operator can still SEE and manage their existing bookings via their own session (closure only
    // blocks NEW-booking creation, which is the only thing create_booking_hold does).
    const ownView = await op.client.from("bookings").select("id").eq("id", existingBookingId);
    expect(ownView.data).toHaveLength(1);
  });

  it("Act 5 — renewal reopens everything instantly, with no cron run (live evaluation)", async () => {
    const pay = await recordProPayment(op.tenantId, `cs_scenario_renew_${run}`);
    expect(pay.error).toBeNull();

    const ent = await admin
      .from("tenant_subscription_entitlement")
      .select("can_accept_bookings")
      .eq("tenant_id", op.tenantId)
      .single();
    expect(ent.data!.can_accept_bookings).toBe(true);

    const rebooked = await guestBooks(room, isoDate(70), isoDate(73));
    expect(rebooked.error).toBeNull();

    const listing = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(listing.data).not.toBeNull();

    // The dashboard banner clears too.
    const ownSignal = await op.client.rpc("current_tenant_can_accept_bookings");
    expect(ownSignal.data).toBe(true);
  });
});
