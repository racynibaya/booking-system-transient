// @vitest-environment node
//
// Integration — the disbursement state machine (claim_due_payouts / mark_payout_paid /
// mark_payout_failed). The money-correctness guarantees the daily payout cron rests on:
//   * a tenant's CLEARED balance is claimed exactly once (no double-pay under a concurrent run),
//   * rows that haven't cleared (clear_eta in the future) are never claimed,
//   * mark_paid / mark_failed only ever apply to rows still 'payable'.
// Requires the local Supabase stack (same run recipe as tests/booking-hold.test.ts).
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

type Claim = Database["public"]["Functions"]["claim_due_payouts"]["Returns"][number];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const userIds: string[] = [];

async function makeTenant(): Promise<string> {
  const email = `payout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
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

async function payoutAccount(tenantId: string): Promise<void> {
  await admin.from("tenant_payout_accounts").insert({
    tenant_id: tenantId,
    method: "gcash",
    payout_name: "Juan Dela Cruz",
    account_number: "09171234567",
    payout_bic: "GXCHPHM2XXX",
  });
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
    p_check_in: "2027-08-10",
    p_check_out: "2027-08-12",
    p_num_guests: 1,
    p_guest_name: "G",
  });
  return held!.id as string;
}

// Insert an accrual row directly so the state-machine test is independent of the confirm flow.
async function accrue(
  tenantId: string,
  bookingId: string,
  owner: number,
  due: boolean,
): Promise<void> {
  await admin.from("payout_ledger").insert({
    tenant_id: tenantId,
    booking_id: bookingId,
    stay_value: 1000,
    deposit_amount: 500,
    operator_commission: 50,
    guest_service_fee: 60,
    paymongo_fee: 20,
    owner_payout: owner,
    clear_eta: due ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
  });
}

function mine(claims: Claim[] | null, tid: string): Claim[] {
  return (claims ?? []).filter((c) => c.tenant_id === tid);
}

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id); // cascades all data
});

describe("payout disbursement state machine", () => {
  it("claims a tenant's cleared balance once, sums owner_payout, returns the destination", async () => {
    const tid = await makeTenant();
    await payoutAccount(tid);
    const b1 = await makeBooking(tid);
    const b2 = await makeBooking(tid);
    await accrue(tid, b1, 450, true);
    await accrue(tid, b2, 300, true);

    const { data: claims } = await admin.rpc("claim_due_payouts");
    const claim = mine(claims, tid);
    expect(claim).toHaveLength(1);
    expect(Number(claim[0].total)).toBe(750);
    expect(claim[0].method).toBe("gcash");
    expect(claim[0].account_number).toBe("09171234567");
    expect(claim[0].payout_bic).toBe("GXCHPHM2XXX");

    // Both rows are now reserved under the same payout_id.
    const { data: rows } = await admin
      .from("payout_ledger")
      .select("status, payout_id")
      .eq("tenant_id", tid);
    expect(rows!.every((r) => r.status === "payable" && r.payout_id === claim[0].payout_id)).toBe(
      true,
    );

    // Claiming again grabs nothing for this tenant — no double-claim.
    const { data: again } = await admin.rpc("claim_due_payouts");
    expect(mine(again, tid)).toHaveLength(0);

    // mark_payout_paid flips payable → paid and stamps the provider ref.
    const { data: n } = await admin.rpc("mark_payout_paid", {
      p_payout_id: claim[0].payout_id,
      p_provider_ref: "tr_test_1",
    });
    expect(n).toBe(2);
    const { data: paidRows } = await admin
      .from("payout_ledger")
      .select("status, payout_ref")
      .eq("tenant_id", tid);
    expect(paidRows!.every((r) => r.status === "paid" && r.payout_ref === "tr_test_1")).toBe(true);

    // Re-marking is a no-op (already paid, not payable) — idempotent.
    const { data: n2 } = await admin.rpc("mark_payout_paid", {
      p_payout_id: claim[0].payout_id,
      p_provider_ref: "tr_test_2",
    });
    expect(n2).toBe(0);
  });

  it("never claims a balance that hasn't cleared yet", async () => {
    const tid = await makeTenant();
    await payoutAccount(tid);
    const b = await makeBooking(tid);
    await accrue(tid, b, 400, false); // clear_eta in the future
    const { data: claims } = await admin.rpc("claim_due_payouts");
    expect(mine(claims, tid)).toHaveLength(0);
  });

  it("mark_payout_failed flips payable → failed with a reason", async () => {
    const tid = await makeTenant();
    await payoutAccount(tid);
    const b = await makeBooking(tid);
    await accrue(tid, b, 200, true);
    const claim = mine((await admin.rpc("claim_due_payouts")).data, tid)[0];

    const { data: n } = await admin.rpc("mark_payout_failed", {
      p_payout_id: claim.payout_id,
      p_reason: "invalid_destination_account",
    });
    expect(n).toBe(1);
    const { data: row } = await admin
      .from("payout_ledger")
      .select("status, fail_reason")
      .eq("booking_id", b)
      .single();
    expect(row!.status).toBe("failed");
    expect(row!.fail_reason).toBe("invalid_destination_account");
  });

  it("skips tenants with no active payout account", async () => {
    const tid = await makeTenant(); // no payout account
    const b = await makeBooking(tid);
    await accrue(tid, b, 500, true);
    const { data: claims } = await admin.rpc("claim_due_payouts");
    expect(mine(claims, tid)).toHaveLength(0);
    // The row stays 'clearing' — not stranded in 'payable'.
    const { data: row } = await admin
      .from("payout_ledger")
      .select("status")
      .eq("booking_id", b)
      .single();
    expect(row!.status).toBe("clearing");
  });
});

describe("async disbursement reconciliation (reconcile_disbursement)", () => {
  // Walk a payout to 'paid' the way the cron does (claim → mark_payout_paid), then reconcile it.
  async function paidPayout(): Promise<{ tid: string; payoutId: string; bookingId: string }> {
    const tid = await makeTenant();
    await payoutAccount(tid);
    const bookingId = await makeBooking(tid);
    await accrue(tid, bookingId, 400, true);
    const claim = mine((await admin.rpc("claim_due_payouts")).data, tid)[0];
    await admin.rpc("mark_payout_paid", { p_payout_id: claim.payout_id, p_provider_ref: "tr_x" });
    return { tid, payoutId: claim.payout_id, bookingId };
  }

  it("failure flips paid → failed, records the reason, and flags the destination", async () => {
    const { tid, payoutId, bookingId } = await paidPayout();

    const { data: n } = await admin.rpc("reconcile_disbursement", {
      p_payout_id: payoutId,
      p_succeeded: false,
      p_reason: "account_name_mismatch",
    });
    expect(n).toBe(1);

    const { data: row } = await admin
      .from("payout_ledger")
      .select("status, fail_reason")
      .eq("booking_id", bookingId)
      .single();
    expect(row!.status).toBe("failed");
    expect(row!.fail_reason).toBe("account_name_mismatch");

    // The destination is flagged so the next claim skips it until the operator re-saves.
    const { data: acct } = await admin
      .from("tenant_payout_accounts")
      .select("status")
      .eq("tenant_id", tid)
      .single();
    expect(acct!.status).toBe("failed");
  });

  it("a flagged destination is excluded from the next claim", async () => {
    const { tid, payoutId } = await paidPayout();
    await admin.rpc("reconcile_disbursement", { p_payout_id: payoutId, p_succeeded: false });

    // A fresh cleared accrual must NOT be claimed while the account is 'failed'.
    const b2 = await makeBooking(tid);
    await accrue(tid, b2, 300, true);
    const { data: claims } = await admin.rpc("claim_due_payouts");
    expect(mine(claims, tid)).toHaveLength(0);
  });

  it("success is an idempotent no-op (rows stay paid)", async () => {
    const { bookingId, payoutId } = await paidPayout();
    const { data: n } = await admin.rpc("reconcile_disbursement", {
      p_payout_id: payoutId,
      p_succeeded: true,
    });
    expect(n).toBe(0);
    const { data: row } = await admin
      .from("payout_ledger")
      .select("status")
      .eq("booking_id", bookingId)
      .single();
    expect(row!.status).toBe("paid");
  });

  it("re-running a failure reconcile is a no-op (not still 'paid')", async () => {
    const { payoutId } = await paidPayout();
    await admin.rpc("reconcile_disbursement", { p_payout_id: payoutId, p_succeeded: false });
    const { data: n2 } = await admin.rpc("reconcile_disbursement", {
      p_payout_id: payoutId,
      p_succeeded: false,
    });
    expect(n2).toBe(0);
  });
});
