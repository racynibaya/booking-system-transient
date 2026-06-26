import { describe, it, expect } from "vitest";

import { parseTransferCallback, type TransferCallbackEvent } from "./transfer-event";

// No real fixture yet (Money Movement isn't enabled), so these lock the SHAPES the parser defends
// against, not a captured event. The parser only needs the transfer id + our reference_number
// (= payout_id); the route re-fetches the authoritative status, so status is intentionally ignored.
// ⚠️ Confirm the real callback shape and add a fixture-backed case once Money Movement is live.
describe("parseTransferCallback", () => {
  it("reads id + reference_number from the data-envelope shape", () => {
    const event: TransferCallbackEvent = {
      data: {
        attributes: {
          data: { id: "tr_123", attributes: { reference_number: "payout-abc" } },
        },
      },
    };
    expect(parseTransferCallback(event)).toEqual({ transferId: "tr_123", payoutId: "payout-abc" });
  });

  it("reads from a flat transfer object", () => {
    const event: TransferCallbackEvent = { id: "tr_456", reference_number: "payout-def" };
    expect(parseTransferCallback(event)).toEqual({ transferId: "tr_456", payoutId: "payout-def" });
  });

  it("returns nulls when the fields are absent (route then acknowledges + ignores)", () => {
    expect(parseTransferCallback({})).toEqual({ transferId: null, payoutId: null });
  });
});
