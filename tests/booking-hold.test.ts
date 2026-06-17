// @vitest-environment node
//
// F0.2 acceptance — the booking invariant (architecture P1): "no double-booking" is
// enforced in one atomic DB operation (create_booking_hold), and tenant isolation (P2)
// holds on the new domain tables. INTEGRATION test: requires the local Supabase stack
// + .env.local (see tests/tenant-isolation.test.ts for the run recipe).
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

// Seed a property + room_type via the admin client (service_role bypasses RLS).
async function makeRoomType(
  tenantId: string,
  opts: { quantity: number; capacity: number },
): Promise<{ propertyId: string; roomTypeId: string }> {
  const slug = `prop-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: property, error: pErr } = await admin
    .from("properties")
    .insert({ tenant_id: tenantId, name: "Test Property", slug })
    .select("id")
    .single();
  if (pErr) throw pErr;

  const { data: roomType, error: rErr } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Test Room",
      capacity: opts.capacity,
      quantity: opts.quantity,
      base_price: 1500,
    })
    .select("id")
    .single();
  if (rErr) throw rErr;

  return { propertyId: property!.id as string, roomTypeId: roomType!.id as string };
}

function hold(roomTypeId: string, checkIn: string, checkOut: string, numGuests = 2) {
  return admin.rpc("create_booking_hold", {
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_num_guests: numGuests,
    p_guest_name: "Guest",
  });
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("create_booking_hold (the no-double-booking invariant, P1)", () => {
  let op: Operator;
  beforeAll(async () => {
    op = await makeOperator(`hold-${Date.now()}@example.com`);
  });

  it("serializes concurrent holds on the last unit — exactly one wins", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => hold(room.roomTypeId, "2027-01-10", "2027-01-13")),
    );
    const won = results.filter((r) => !r.error);
    const lost = results.filter((r) => r.error);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(5);
    expect(lost.every((r) => r.error!.message.includes("NO_AVAILABILITY"))).toBe(true);
  });

  it("treats same-day checkout/checkin as non-overlapping (half-open)", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const first = await hold(room.roomTypeId, "2027-02-10", "2027-02-13");
    const second = await hold(room.roomTypeId, "2027-02-13", "2027-02-15");
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
  });

  it("allows up to `quantity` overlapping holds, then refuses", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 2, capacity: 4 });
    const a = await hold(room.roomTypeId, "2027-03-10", "2027-03-13");
    const b = await hold(room.roomTypeId, "2027-03-11", "2027-03-14");
    const c = await hold(room.roomTypeId, "2027-03-12", "2027-03-15");
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).not.toBeNull();
    expect(c.error!.message).toContain("NO_AVAILABILITY");
  });

  it("refuses a hold overlapping an availability_block", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    await admin.from("availability_blocks").insert({
      tenant_id: op.tenantId,
      room_type_id: room.roomTypeId,
      start_date: "2027-04-10",
      end_date: "2027-04-20",
      reason: "maintenance",
    });
    const res = await hold(room.roomTypeId, "2027-04-12", "2027-04-14");
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("NO_AVAILABILITY");
  });

  it("ignores an expired hold when counting availability", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    await admin.from("bookings").insert({
      tenant_id: op.tenantId,
      property_id: room.propertyId,
      room_type_id: room.roomTypeId,
      guest_name: "Stale",
      check_in: "2027-05-10",
      check_out: "2027-05-13",
      num_guests: 1,
      status: "held",
      hold_expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const res = await hold(room.roomTypeId, "2027-05-10", "2027-05-13");
    expect(res.error).toBeNull();
  });

  it("validates guests against room capacity", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 2 });
    const res = await hold(room.roomTypeId, "2027-06-10", "2027-06-13", 5);
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("INVALID_GUESTS");
  });
});

describe("tenant isolation on the domain tables (P2)", () => {
  let a: Operator;
  let b: Operator;
  let roomA: { propertyId: string; roomTypeId: string };

  beforeAll(async () => {
    const run = Date.now();
    a = await makeOperator(`dom-a-${run}@example.com`);
    b = await makeOperator(`dom-b-${run}@example.com`);
    roomA = await makeRoomType(a.tenantId, { quantity: 1, capacity: 4 });
    await hold(roomA.roomTypeId, "2027-07-10", "2027-07-13"); // a booking owned by A
  });

  it("an operator cannot read another operator's properties/room_types/bookings", async () => {
    const props = await b.client.from("properties").select("id");
    const rooms = await b.client.from("room_types").select("id");
    const bookings = await b.client.from("bookings").select("id");
    expect(props.data).toHaveLength(0);
    expect(rooms.data).toHaveLength(0);
    expect(bookings.data).toHaveLength(0);
  });

  it("an operator cannot attach a room_type to another operator's property", async () => {
    // B's own tenant_id but A's property → composite FK (A's prop, B's tenant) has no match.
    const res = await b.client.from("room_types").insert({
      tenant_id: b.tenantId,
      property_id: roomA.propertyId,
      name: "Sneaky",
      capacity: 2,
      quantity: 1,
      base_price: 1000,
    });
    expect(res.error).not.toBeNull();
  });

  it("an operator cannot create rows under another operator's tenant_id (RLS with check)", async () => {
    const res = await b.client.from("properties").insert({
      tenant_id: a.tenantId, // not B's tenant
      name: "Impersonation",
      slug: `x-${Date.now()}`,
    });
    expect(res.error).not.toBeNull();
  });
});
