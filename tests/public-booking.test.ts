// @vitest-environment node
//
// F1.3 acceptance — the PUBLIC booking path (architecture P2): an anonymous guest
// (no account, publishable key only) can read a listing and create a hold through the
// SECURITY DEFINER seam — without ever touching the tables or seeing guest PII, and
// with the no-double-booking invariant still enforced. INTEGRATION test: requires the
// local Supabase stack + .env.local (see tests/tenant-isolation.test.ts for the recipe).
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
const admin = createClient(url, secretKey, noPersist);
// Anonymous client: publishable key, never signed in → the `anon` role, exactly as
// the public booking page calls it server-side.
const anon: SupabaseClient = createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];

async function makeOperatorTenant(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123456",
    email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user!.id);
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", data.user!.id)
    .single();
  if (tErr) throw tErr;
  // get_public_listing gates on verification_status='approved' (operator_verification migration);
  // real operators are approved, so approve the seeded tenant or the public read seam returns null.
  const { error: vErr } = await admin
    .from("tenants")
    .update({ verification_status: "approved" })
    .eq("id", tenant!.id);
  if (vErr) throw vErr;
  return tenant!.id as string;
}

async function makeListing(
  tenantId: string,
  slug: string,
  opts: { quantity: number; capacity: number },
) {
  const { data: property, error: pErr } = await admin
    .from("properties")
    .insert({ tenant_id: tenantId, name: "Seaside Transient", slug, area: "San Juan" })
    .select("id")
    .single();
  if (pErr) throw pErr;
  const { data: room, error: rErr } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Garden Room",
      capacity: opts.capacity,
      quantity: opts.quantity,
      base_price: 1800,
    })
    .select("id")
    .single();
  if (rErr) throw rErr;
  return { propertyId: property!.id as string, roomTypeId: room!.id as string };
}

function anonHold(roomTypeId: string, checkIn: string, checkOut: string, numGuests = 2) {
  return anon.rpc("create_booking_hold", {
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_num_guests: numGuests,
    p_guest_name: "Public Guest",
    p_guest_phone: "0917-000-0000",
    p_guest_email: "guest@example.com",
  });
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("get_public_listing (anonymous read seam, P2)", () => {
  let tenantId: string;
  let slug: string;
  let room: { propertyId: string; roomTypeId: string };

  beforeAll(async () => {
    const run = Date.now();
    tenantId = await makeOperatorTenant(`pub-${run}@example.com`);
    slug = `seaside-${run}`;
    room = await makeListing(tenantId, slug, { quantity: 1, capacity: 4 });
  });

  it("returns the listing's public-safe fields for the matching slug", async () => {
    const { data, error } = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(error).toBeNull();
    const listing = data as {
      property: { slug: string; name: string };
      room_types: { id: string; base_price: number }[];
    };
    expect(listing.property.slug).toBe(slug);
    expect(listing.property.name).toBe("Seaside Transient");
    expect(listing.room_types).toHaveLength(1);
    expect(listing.room_types[0].base_price).toBe(1800);
  });

  it("exposes bookings as DATE RANGES ONLY — no guest PII", async () => {
    // A confirmed booking carrying guest PII must surface only its dates publicly.
    await admin.from("bookings").insert({
      tenant_id: tenantId,
      property_id: room.propertyId,
      room_type_id: room.roomTypeId,
      guest_name: "Private Person",
      guest_email: "private@example.com",
      guest_phone: "0917-555-5555",
      check_in: "2027-09-10",
      check_out: "2027-09-13",
      num_guests: 2,
      status: "confirmed",
    });
    const { data } = await anon.rpc("get_public_listing", { p_slug: slug });
    const listing = data as { room_types: { bookings: Record<string, unknown>[] }[] };
    const bookings = listing.room_types[0].bookings;
    expect(bookings.length).toBeGreaterThan(0);
    for (const b of bookings) {
      expect(Object.keys(b).sort()).toEqual(["check_in", "check_out"]);
      const serialized = JSON.stringify(b);
      expect(serialized).not.toContain("Private Person");
      expect(serialized).not.toContain("private@example.com");
      expect(serialized).not.toContain("0917-555-5555");
    }
  });

  it("returns null for an unknown slug (→ the page 404s)", async () => {
    const { data, error } = await anon.rpc("get_public_listing", { p_slug: "does-not-exist" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("cannot read the tables directly as anon (RLS) — only through the seam", async () => {
    const props = await anon.from("properties").select("id");
    expect(props.data ?? []).toHaveLength(0);
  });
});

describe("create_booking_hold as anon (the wedge: a guest books, P1)", () => {
  it("an anonymous guest can place a hold", async () => {
    const run = Date.now();
    const tenantId = await makeOperatorTenant(`pub-hold-${run}@example.com`);
    const room = await makeListing(tenantId, `book-${run}`, { quantity: 1, capacity: 4 });
    const res = await anonHold(room.roomTypeId, "2027-10-10", "2027-10-13");
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });

  it("serializes concurrent anon holds on the last unit — exactly one wins", async () => {
    const run = Date.now();
    const tenantId = await makeOperatorTenant(`pub-race-${run}@example.com`);
    const room = await makeListing(tenantId, `race-${run}`, { quantity: 1, capacity: 4 });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => anonHold(room.roomTypeId, "2027-11-10", "2027-11-13")),
    );
    const won = results.filter((r) => !r.error);
    const lost = results.filter((r) => r.error);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(5);
    expect(lost.every((r) => r.error!.message.includes("NO_AVAILABILITY"))).toBe(true);
  });
});
