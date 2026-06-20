// @vitest-environment node
//
// Phase 2a acceptance — the gateway confirm seam (confirm_booking_gateway). A PayMongo webhook
// confirms a paid booking with no operator session, idempotently, and is correct under the
// paid-but-expired race. INTEGRATION test: requires the local Supabase stack + .env.local
// (same run recipe as tests/booking-hold.test.ts).
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
// service_role: the role the webhook handler uses (confirm_booking_gateway is granted to it only).
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

function gatewayConfirm(
  bookingId: string,
  opts: { ref?: string; amount?: number; payload?: unknown } = {},
) {
  return admin.rpc("confirm_booking_gateway", {
    p_booking_id: bookingId,
    p_provider: "paymongo",
    p_provider_ref: opts.ref ?? "pi_test_123",
    p_amount: opts.amount ?? null,
    p_raw_payload: (opts.payload ?? null) as never,
  });
}

function payments(bookingId: string) {
  return admin
    .from("payments")
    .select("id, provider, provider_ref, amount, kind, status, raw_payload")
    .eq("booking_id", bookingId);
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("confirm_booking_gateway (the webhook confirm seam, P7/P10)", () => {
  let op: Operator;
  beforeAll(async () => {
    op = await makeOperator(`gw-${Date.now()}@example.com`);
  });

  it("confirms a live held booking and records exactly one deposit payment", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-01-10", "2027-01-13");
    expect(held.error).toBeNull();
    const bookingId = held.data!.id as string;

    const res = await gatewayConfirm(bookingId, { ref: "pi_live_1", payload: { ok: true } });
    expect(res.error).toBeNull();
    expect(res.data!.status).toBe("confirmed");
    expect(res.data!.hold_expires_at).toBeNull();

    const pays = await payments(bookingId);
    expect(pays.data).toHaveLength(1);
    expect(pays.data![0]).toMatchObject({
      provider: "paymongo",
      provider_ref: "pi_live_1",
      kind: "deposit",
      status: "confirmed",
    });
    // amount defaults to the booking's stamped deposit_amount when not passed.
    expect(Number(pays.data![0].amount)).toBeGreaterThan(0);
  });

  it("is idempotent — a replayed webhook is a no-op, never a second payment", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-02-10", "2027-02-13");
    const bookingId = held.data!.id as string;

    const first = await gatewayConfirm(bookingId, { ref: "pi_dup" });
    expect(first.error).toBeNull();
    expect(first.data!.status).toBe("confirmed");

    const replay = await gatewayConfirm(bookingId, { ref: "pi_dup" });
    expect(replay.error).toBeNull();
    // Already-confirmed → no-op. The RPC returns SQL NULL, but PostgREST renders a NULL
    // composite as an all-null OBJECT ({id:null,…}) — so guard on a real field, not the row's
    // truthiness (the same trap confirmBooking() handles in app/(app)/bookings/actions.ts).
    expect(replay.data?.id).toBeFalsy();

    const pays = await payments(bookingId);
    expect(pays.data).toHaveLength(1);
  });

  it("records the settled amount when it matches the stamped deposit", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-03-10", "2027-03-13");
    const bookingId = held.data!.id as string;
    const deposit = Number(held.data!.deposit_amount);

    await gatewayConfirm(bookingId, { ref: "pi_amt", amount: deposit });
    const pays = await payments(bookingId);
    expect(Number(pays.data![0].amount)).toBe(deposit);
  });

  it("refuses a payment whose amount != the stamped deposit (AMOUNT_MISMATCH, inv. 3)", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-03-20", "2027-03-23");
    const bookingId = held.data!.id as string;
    const wrong = Number(held.data!.deposit_amount) + 1; // a centavo off is still a mismatch

    const res = await gatewayConfirm(bookingId, { ref: "pi_wrong", amount: wrong });
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("AMOUNT_MISMATCH");
    // Never confirmed, never recorded — the booking stays held for reconcile/refund.
    expect((await payments(bookingId)).data).toHaveLength(0);
    const { data: b } = await admin.from("bookings").select("status").eq("id", bookingId).single();
    expect(b!.status).toBe("held");
  });

  it("also confirms from awaiting_confirmation (proof-then-gateway edge)", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-04-10", "2027-04-13");
    const bookingId = held.data!.id as string;
    // Move it to awaiting_confirmation the way the public proof flow does.
    const proof = await admin.rpc("submit_proof", {
      p_booking_id: bookingId,
      p_proof_url: `${op.tenantId}/${bookingId}/proof.jpg`,
    });
    expect(proof.error).toBeNull();
    expect(proof.data!.status).toBe("awaiting_confirmation");

    const res = await gatewayConfirm(bookingId, { ref: "pi_aw" });
    expect(res.error).toBeNull();
    expect(res.data!.status).toBe("confirmed");
    expect((await payments(bookingId)).data).toHaveLength(1);
  });

  it("rescues a paid-but-expired hold when the slot is still free", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    // A held booking whose hold window already lapsed (webhook arrived late).
    const { data: stale } = await admin
      .from("bookings")
      .insert({
        tenant_id: op.tenantId,
        property_id: room.propertyId,
        room_type_id: room.roomTypeId,
        guest_name: "Late Payer",
        check_in: "2027-05-10",
        check_out: "2027-05-13",
        num_guests: 1,
        status: "held",
        hold_expires_at: new Date(Date.now() - 60_000).toISOString(),
        total_amount: 4500,
        deposit_amount: 2250,
      })
      .select("id")
      .single();

    const res = await gatewayConfirm(stale!.id as string, { ref: "pi_rescue" });
    expect(res.error).toBeNull();
    expect(res.data!.status).toBe("confirmed");
    expect(res.data!.hold_expires_at).toBeNull();
  });

  it("refuses a paid-but-expired hold when the slot was taken in the gap (SLOT_TAKEN)", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    // The late payer's lapsed hold...
    const { data: stale } = await admin
      .from("bookings")
      .insert({
        tenant_id: op.tenantId,
        property_id: room.propertyId,
        room_type_id: room.roomTypeId,
        guest_name: "Late Payer",
        check_in: "2027-06-10",
        check_out: "2027-06-13",
        num_guests: 1,
        status: "held",
        hold_expires_at: new Date(Date.now() - 60_000).toISOString(),
        total_amount: 4500,
        deposit_amount: 2250,
      })
      .select("id")
      .single();
    // ...and someone else took the only unit (quantity 1) in the meantime.
    await admin.from("bookings").insert({
      tenant_id: op.tenantId,
      property_id: room.propertyId,
      room_type_id: room.roomTypeId,
      guest_name: "Winner",
      check_in: "2027-06-10",
      check_out: "2027-06-13",
      num_guests: 1,
      status: "confirmed",
    });

    const res = await gatewayConfirm(stale!.id as string, { ref: "pi_taken" });
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("SLOT_TAKEN");
    expect((await payments(stale!.id as string)).data).toHaveLength(0);
  });

  it("refuses an unknown booking", async () => {
    const res = await gatewayConfirm("00000000-0000-0000-0000-000000000000");
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("UNKNOWN_BOOKING");
  });
});
