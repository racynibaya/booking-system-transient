import { beforeEach, describe, expect, it, vi } from "vitest";

// Coverage for the Xendit account-status (KYC) webhook handler — the SINGLE writer of
// tenant_xendit_accounts.kyc_status. The pure parse/guard lives in ./status (tested in status.test.ts);
// this asserts the handler wiring around it: status classification (400 malformed / 500 transient DB /
// 200 everything else), the monotonic guard short-circuit, and the optimistic concurrency guard on the
// UPDATE (only writes if the row is still at the status we read).

const selectEqMaybeSingle = vi.fn();
const updateEqEq = vi.fn();

// from("tenant_xendit_accounts") supports two chains:
//   .select(...).eq("sub_account_id",…).maybeSingle()
//   .update(...).eq("id",…).eq("kyc_status",…)  (awaited → { error })
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: selectEqMaybeSingle }) }),
  update: () => ({ eq: () => ({ eq: updateEqEq }) }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({ from })),
}));

import { handleVerifiedXenditAccountEvent } from "./webhook-handler";

const SUB = "sub_owned_123";

function ownedEvent(status: string) {
  return JSON.stringify({ event: "account.updated", data: { id: SUB, status } });
}

beforeEach(() => {
  selectEqMaybeSingle.mockReset();
  updateEqEq.mockReset();
  updateEqEq.mockResolvedValue({ error: null });
  from.mockClear();
});

describe("handleVerifiedXenditAccountEvent", () => {
  it("400s on malformed JSON", async () => {
    const res = await handleVerifiedXenditAccountEvent("{nope");
    expect(res.status).toBe(400);
  });

  it("200-ignores an event that yields no account status", async () => {
    const res = await handleVerifiedXenditAccountEvent(
      JSON.stringify({ event: "account_holder.capabilities.status", data: { id: SUB } }),
    );
    expect(res.status).toBe(200);
    expect(selectEqMaybeSingle).not.toHaveBeenCalled();
  });

  it("200-acks an event for an unknown sub-account (no row yet)", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await handleVerifiedXenditAccountEvent(ownedEvent("LIVE"));
    expect(res.status).toBe(200);
    expect(updateEqEq).not.toHaveBeenCalled();
  });

  it("500s on a transient lookup failure (Xendit retries)", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const res = await handleVerifiedXenditAccountEvent(ownedEvent("LIVE"));
    expect(res.status).toBe(500);
  });

  it("applies a forward transition and 200s", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({
      data: { id: "row-1", kyc_status: "PENDING_VERIFICATION" },
      error: null,
    });
    const res = await handleVerifiedXenditAccountEvent(ownedEvent("LIVE"));
    expect(res.status).toBe(200);
    expect(updateEqEq).toHaveBeenCalledTimes(1);
  });

  it("no-ops (no UPDATE) on a backward/stale event", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({
      data: { id: "row-1", kyc_status: "LIVE" },
      error: null,
    });
    const res = await handleVerifiedXenditAccountEvent(ownedEvent("PENDING_VERIFICATION"));
    expect(res.status).toBe(200);
    expect(updateEqEq).not.toHaveBeenCalled();
  });

  it("500s when the UPDATE itself fails transiently", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({
      data: { id: "row-1", kyc_status: "AWAITING_DOCS" },
      error: null,
    });
    updateEqEq.mockResolvedValueOnce({ error: { message: "write timeout" } });
    const res = await handleVerifiedXenditAccountEvent(ownedEvent("LIVE"));
    expect(res.status).toBe(500);
  });

  it("honors a SUSPENDED takedown over a currently-LIVE row", async () => {
    selectEqMaybeSingle.mockResolvedValueOnce({
      data: { id: "row-1", kyc_status: "LIVE" },
      error: null,
    });
    const res = await handleVerifiedXenditAccountEvent(
      JSON.stringify({ event: "account.suspended", data: { id: SUB } }),
    );
    expect(res.status).toBe(200);
    expect(updateEqEq).toHaveBeenCalledTimes(1);
  });
});
