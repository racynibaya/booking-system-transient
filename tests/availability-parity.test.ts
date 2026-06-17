// @vitest-environment node
//
// F1.2 — guards the invariant duplication (architecture P1/P6): the TS calendar calc
// (lib/availability.ts isRangeBookable) MUST agree with the authoritative SQL enforcer
// (create_booking_hold) for the same inputs. Integration test against local Supabase
// (same harness as tests/booking-hold.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isRangeBookable, type BlockRange, type StayRange } from "@/lib/availability";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // env may already be set
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin: SupabaseClient = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const QUANTITY = 2;
const createdUserIds: string[] = [];

// Seeded state, mirrored in TS for the parity comparison.
const bookings: StayRange[] = [
  { checkIn: "2027-10-10", checkOut: "2027-10-13" }, // confirmed
  { checkIn: "2027-10-11", checkOut: "2027-10-12" }, // held (live)
];
const blocks: BlockRange[] = [{ start: "2027-10-20", end: "2027-10-22" }];

let roomTypeId: string;

beforeAll(async () => {
  const { data: user } = await admin.auth.admin.createUser({
    email: `parity-${Date.now()}@example.com`,
    password: "test-password-123456",
    email_confirm: true,
  });
  createdUserIds.push(user!.user!.id);
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", user!.user!.id)
    .single();
  const tenantId = tenant!.id as string;

  const { data: property } = await admin
    .from("properties")
    .insert({ tenant_id: tenantId, name: "Parity", slug: `parity-${Date.now()}` })
    .select("id")
    .single();
  const { data: room } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Room",
      capacity: 4,
      quantity: QUANTITY,
      base_price: 1000,
    })
    .select("id")
    .single();
  roomTypeId = room!.id as string;

  // Seed the two bookings + the block via the admin client (service_role bypasses RLS).
  await admin.from("bookings").insert([
    {
      tenant_id: tenantId,
      property_id: property!.id,
      room_type_id: roomTypeId,
      guest_name: "Confirmed",
      check_in: bookings[0].checkIn,
      check_out: bookings[0].checkOut,
      num_guests: 1,
      status: "confirmed",
    },
    {
      tenant_id: tenantId,
      property_id: property!.id,
      room_type_id: roomTypeId,
      guest_name: "Held",
      check_in: bookings[1].checkIn,
      check_out: bookings[1].checkOut,
      num_guests: 1,
      status: "held",
      hold_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  ]);
  await admin.from("availability_blocks").insert({
    tenant_id: tenantId,
    room_type_id: roomTypeId,
    start_date: blocks[0].start,
    end_date: blocks[0].end,
  });
});

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

// Ask the authoritative RPC whether a range is bookable, without leaving state behind.
async function rpcBookable(range: StayRange): Promise<boolean> {
  const { data, error } = await admin.rpc("create_booking_hold", {
    p_room_type_id: roomTypeId,
    p_check_in: range.checkIn,
    p_check_out: range.checkOut,
    p_num_guests: 1,
    p_guest_name: "parity-probe",
  });
  if (error) return false;
  const created = data as { id: string } | null;
  if (created?.id) await admin.from("bookings").delete().eq("id", created.id); // restore state
  return true;
}

describe("isRangeBookable parity with create_booking_hold", () => {
  const candidates: StayRange[] = [
    { checkIn: "2027-10-10", checkOut: "2027-10-13" }, // both bookings overlap → full
    { checkIn: "2027-10-10", checkOut: "2027-10-11" }, // 1 booking overlaps → ok
    { checkIn: "2027-10-11", checkOut: "2027-10-12" }, // 2 overlap → full
    { checkIn: "2027-10-13", checkOut: "2027-10-15" }, // half-open, no overlap → ok
    { checkIn: "2027-10-21", checkOut: "2027-10-23" }, // overlaps block → no
    { checkIn: "2027-10-25", checkOut: "2027-10-27" }, // clear → ok
  ];

  it.each(candidates)("agrees for %o", async (range) => {
    const ts = isRangeBookable(range, QUANTITY, bookings, blocks);
    const rpc = await rpcBookable(range);
    expect(ts).toBe(rpc);
  });
});
