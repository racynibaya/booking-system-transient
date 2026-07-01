// @vitest-environment node
//
// Xendit rail acceptance — the confirm seam for p_provider='xendit'. The existing
// confirm-booking-gateway.test.ts proves this RPC for the PayMongo/centralized path; nothing
// exercises the LIVE Xendit branch against the real DB. The one behaviour that differs by provider:
// confirm_booking_gateway SKIPS the payout_ledger accrual for 'xendit' (the xenPlatform Split Rule
// already routed the commission to the Master at capture and the operator's share settled to their
// own sub-account — custody-clean, nothing to accrue). This spec pins that skip + the plain confirm
// contract (idempotency, amount guard) for the Xendit provider.
//
// SCOPE: this is the DB money-seam only. The external Xendit legs (createPaymentSession / createSplitRule
// / createPayout) hit Xendit's sandbox and need MANAGED test-mode keys — out of scope until those keys
// exist (that's the same go-live blocker). Here we simulate what a completed PAY session hands the RPC.
//
// INTEGRATION test: requires the local Supabase stack + .env.local (same recipe as
// tests/confirm-booking-gateway.test.ts).
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
  const slug = `xnd-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
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

// What the Xendit session webhook hands the RPC (lib/xendit/session-webhook-handler.ts): the settled
// amount as plain pesos + payment_id as the provider ref, p_provider='xendit'.
function xenditConfirm(
  bookingId: string,
  opts: { ref?: string; amount?: number; payload?: unknown } = {},
) {
  return admin.rpc("confirm_booking_gateway", {
    p_booking_id: bookingId,
    p_provider: "xendit",
    p_provider_ref: opts.ref ?? "xnd_pay_123",
    p_amount: opts.amount ?? null,
    p_raw_payload: (opts.payload ?? null) as never,
  });
}

function payments(bookingId: string) {
  return admin
    .from("payments")
    .select("id, provider, provider_ref, amount, kind, status")
    .eq("booking_id", bookingId);
}

function ledgerRows(bookingId: string) {
  return admin.from("payout_ledger").select("booking_id").eq("booking_id", bookingId);
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("confirm_booking_gateway — Xendit provider (custody-clean split rail)", () => {
  let op: Operator;
  beforeAll(async () => {
    op = await makeOperator(`xnd-${Date.now()}@example.com`);
  });

  it("confirms a held booking, records one xendit deposit payment, and does NOT accrue payout_ledger", async () => {
    // A tenant_payout_accounts row WOULD trigger centralized accrual for a non-xendit provider — we
    // seed one here precisely so the assertion proves the skip is driven by p_provider='xendit', not
    // by a missing account. A real Xendit operator carries tenant_xendit_accounts instead (the RPC
    // reads neither on this path); this is the sharpest way to pin the provider-driven branch.
    await admin.from("tenant_payout_accounts").insert({
      tenant_id: op.tenantId,
      method: "gcash",
      payout_name: "Juan Dela Cruz",
      account_number: "09171234567",
    });

    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-08-10", "2027-08-13");
    expect(held.error).toBeNull();
    const bookingId = held.data!.id as string;
    const deposit = Number(held.data!.deposit_amount);

    // createPaymentSession stamps the grossed-up guest total on the booking; the webhook settles that
    // exact amount. Stamp it so we prove the ledger skip happens EVEN WITH a charge amount present.
    const grossed = Math.round((deposit + 321) * 100) / 100;
    await admin.from("bookings").update({ gateway_charge_amount: grossed }).eq("id", bookingId);

    const res = await xenditConfirm(bookingId, { ref: "xnd_pay_1", amount: grossed });
    expect(res.error).toBeNull();
    expect(res.data!.status).toBe("confirmed");
    expect(res.data!.hold_expires_at).toBeNull();

    const pays = await payments(bookingId);
    expect(pays.data).toHaveLength(1);
    expect(pays.data![0]).toMatchObject({
      provider: "xendit",
      provider_ref: "xnd_pay_1",
      kind: "deposit",
      status: "confirmed",
    });
    expect(Number(pays.data![0].amount)).toBe(grossed);

    // The custody-clean guarantee: the Split Rule already routed the money, so NOTHING accrues.
    const ledger = await ledgerRows(bookingId);
    expect(ledger.error).toBeNull();
    expect(ledger.data).toHaveLength(0);
  });

  it("is idempotent — a replayed session webhook is a no-op, never a second payment", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-09-10", "2027-09-13");
    const bookingId = held.data!.id as string;

    const first = await xenditConfirm(bookingId, { ref: "xnd_dup" });
    expect(first.error).toBeNull();
    expect(first.data!.status).toBe("confirmed");

    const replay = await xenditConfirm(bookingId, { ref: "xnd_dup" });
    expect(replay.error).toBeNull();
    // Already-confirmed → SQL NULL, which PostgREST renders as an all-null composite; guard on a
    // real field, not row truthiness (same trap the session handler's NULL-composite check handles).
    expect(replay.data?.id).toBeFalsy();

    expect((await payments(bookingId)).data).toHaveLength(1);
  });

  it("refuses a settled amount != the stamped grossed-up charge (AMOUNT_MISMATCH), leaving the hold intact", async () => {
    const room = await makeRoomType(op.tenantId, { quantity: 1, capacity: 4 });
    const held = await hold(room.roomTypeId, "2027-10-10", "2027-10-13");
    const bookingId = held.data!.id as string;
    const deposit = Number(held.data!.deposit_amount);
    const grossed = Math.round((deposit + 321) * 100) / 100;
    await admin.from("bookings").update({ gateway_charge_amount: grossed }).eq("id", bookingId);

    // Settling the bare deposit (not the grossed-up charge we actually created the session for).
    const res = await xenditConfirm(bookingId, { ref: "xnd_wrong", amount: deposit });
    expect(res.error).not.toBeNull();
    expect(res.error!.message).toContain("AMOUNT_MISMATCH");

    expect((await payments(bookingId)).data).toHaveLength(0);
    const { data: b } = await admin.from("bookings").select("status").eq("id", bookingId).single();
    expect(b!.status).toBe("held");
  });
});
