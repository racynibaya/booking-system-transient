// @vitest-environment node
//
// Integration — the refund state machine (claim_refund / finish_refund / abort_refund), Slice 6. The
// money-correctness guarantees the admin refund rests on:
//   * a booking's accrual is reserved into 'refunding' at most once (no double-refund under a re-click),
//   * a refund of a not-yet-disbursed accrual ends 'refunded'; a refund of an already-paid (or in-flight
//     'payable') accrual ends 'clawed_back' — never silently eats a paid-out balance,
//   * abort restores the prior status so the daily cron can still pay the operator,
//   * only an accrual still 'refunding' can be finished/aborted (idempotent).
// Requires the local Supabase stack (same run recipe as tests/payout-disbursement.test.ts).
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

type RefundClaim = Database["public"]["Functions"]["claim_refund"]["Returns"][number];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const userIds: string[] = [];

async function makeTenant(): Promise<string> {
  const email = `refund-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123456",
    email_confirm: true,
  });
  if (error) throw error;
  userIds.push(data.user!.id);
  const { data: t } = await admin
    .from("tenants")
    .select("id")
    .eq("user_id", data.user!.id)
    .single();
  return t!.id as string;
}

async function makeBooking(tenantId: string): Promise<string> {
  const { data: prop } = await admin
    .from("properties")
    .insert({ tenant_id: tenantId, name: "P", slug: `p-${Math.random().toString(36).slice(2, 9)}` })
    .select("id")
    .single();
  const { data: rt } = await admin
    .from("room_types")
    .insert({
      tenant_id: tenantId,
      property_id: prop!.id,
      name: "R",
      capacity: 2,
      quantity: 1,
      base_price: 1000,
    })
    .select("id")
    .single();
  const { data: held } = await admin.rpc("create_booking_hold", {
    p_room_type_id: rt!.id,
    p_check_in: "2027-09-10",
    p_check_out: "2027-09-12",
    p_num_guests: 1,
    p_guest_name: "G",
  });
  return held!.id as string;
}

// A confirmed deposit payment (carries the pi_ the refund resolves to pay_, and the captured charge).
async function depositPayment(tenantId: string, bookingId: string, amount: number): Promise<void> {
  await admin.from("payments").insert({
    tenant_id: tenantId,
    booking_id: bookingId,
    provider: "paymongo",
    provider_ref: "pi_test_ref",
    amount,
    kind: "deposit",
    status: "confirmed",
  });
}

// Insert an accrual row in a given state directly so the refund state-machine test is independent of
// the confirm + disbursement flow.
async function accrue(
  tenantId: string,
  bookingId: string,
  status: Database["public"]["Enums"]["payout_ledger_status"],
): Promise<void> {
  await admin.from("payout_ledger").insert({
    tenant_id: tenantId,
    booking_id: bookingId,
    stay_value: 1000,
    deposit_amount: 500,
    operator_commission: 50,
    guest_service_fee: 60,
    paymongo_fee: 20,
    owner_payout: 450,
    status,
    clear_eta: "2020-01-01T00:00:00Z",
  });
}

async function statusOf(bookingId: string) {
  const { data } = await admin
    .from("payout_ledger")
    .select("status, refund_ref, refund_amount")
    .eq("booking_id", bookingId)
    .single();
  return data!;
}

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("refund state machine", () => {
  it("refunds a not-yet-disbursed accrual: clearing → refunding → refunded, no clawback", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    await depositPayment(tid, b, 8704.66);
    await accrue(tid, b, "clearing");

    const { data: claims } = await admin.rpc("claim_refund", { p_booking_id: b });
    const claim = (claims ?? []) as RefundClaim[];
    expect(claim).toHaveLength(1);
    expect(claim[0].prior_status).toBe("clearing");
    expect(claim[0].provider_ref).toBe("pi_test_ref");
    expect(Number(claim[0].paid_amount)).toBe(8704.66);
    expect((await statusOf(b)).status).toBe("refunding");

    const { data: n } = await admin.rpc("finish_refund", {
      p_booking_id: b,
      p_refund_ref: "ref_test_1",
      p_amount: 8704.66,
      p_clawback: false,
    });
    expect(n).toBe(1);
    const row = await statusOf(b);
    expect(row.status).toBe("refunded");
    expect(row.refund_ref).toBe("ref_test_1");
    expect(Number(row.refund_amount)).toBe(8704.66);
  });

  it("refunds an already-paid accrual as a clawback: paid → refunding → clawed_back", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    await depositPayment(tid, b, 5000);
    await accrue(tid, b, "paid");

    const { data: claims } = await admin.rpc("claim_refund", { p_booking_id: b });
    expect(((claims ?? []) as RefundClaim[])[0].prior_status).toBe("paid");

    await admin.rpc("finish_refund", {
      p_booking_id: b,
      p_refund_ref: "ref_test_2",
      p_amount: 5000,
      p_clawback: true,
    });
    expect((await statusOf(b)).status).toBe("clawed_back");
  });

  it("a second claim grabs nothing — no double-refund", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    await depositPayment(tid, b, 1000);
    await accrue(tid, b, "clearing");

    const { data: first } = await admin.rpc("claim_refund", { p_booking_id: b });
    expect((first ?? []) as RefundClaim[]).toHaveLength(1);
    const { data: second } = await admin.rpc("claim_refund", { p_booking_id: b });
    expect((second ?? []) as RefundClaim[]).toHaveLength(0);
  });

  it("abort restores the prior status (no money moved)", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    await depositPayment(tid, b, 1000);
    await accrue(tid, b, "paid");

    await admin.rpc("claim_refund", { p_booking_id: b });
    expect((await statusOf(b)).status).toBe("refunding");

    const { data: n } = await admin.rpc("abort_refund", {
      p_booking_id: b,
      p_restore_status: "paid",
    });
    expect(n).toBe(1);
    expect((await statusOf(b)).status).toBe("paid");

    // Re-running finish/abort after the reservation is gone is a no-op.
    const { data: n2 } = await admin.rpc("abort_refund", {
      p_booking_id: b,
      p_restore_status: "paid",
    });
    expect(n2).toBe(0);
  });

  it("claim is a no-op on an already-refunded booking", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    await depositPayment(tid, b, 1000);
    await accrue(tid, b, "refunded");

    const { data: claims } = await admin.rpc("claim_refund", { p_booking_id: b });
    expect((claims ?? []) as RefundClaim[]).toHaveLength(0);
  });

  it("claim is a no-op on a booking with no accrual", async () => {
    const tid = await makeTenant();
    const b = await makeBooking(tid);
    const { data: claims } = await admin.rpc("claim_refund", { p_booking_id: b });
    expect((claims ?? []) as RefundClaim[]).toHaveLength(0);
  });
});
