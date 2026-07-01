import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Behavior lock for the two thin async-outcome webhooks (payout + refund). Neither moves money or
// writes state yet (the operator sees the result as their sub-account balance changing); they exist to
// ACK Xendit (200 for any well-formed event so retries stop) and to log a failure loudly until a
// payout/refund-history surface lands. These tests pin that contract so a future change can't silently
// turn a failure into a swallowed 200 with no log, or start 500-looping Xendit on a malformed body.

import { handleVerifiedXenditPayoutEvent } from "./payout-webhook-handler";
import { handleVerifiedXenditRefundEvent } from "./refund-webhook-handler";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleVerifiedXenditPayoutEvent", () => {
  it("400s on malformed JSON", async () => {
    expect((await handleVerifiedXenditPayoutEvent("{x")).status).toBe(400);
  });

  it("200s and stays quiet on a success", async () => {
    const res = await handleVerifiedXenditPayoutEvent(
      JSON.stringify({ event: "payout.succeeded", data: { id: "po_1", status: "SUCCEEDED" } }),
    );
    expect(res.status).toBe(200);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("200s but logs loudly on a failure", async () => {
    const res = await handleVerifiedXenditPayoutEvent(
      JSON.stringify({
        event: "payout.failed",
        data: { id: "po_2", reference_id: "wd_2", failure_code: "INSUFFICIENT_BALANCE" },
      }),
    );
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("payout.failed"));
  });
});

describe("handleVerifiedXenditRefundEvent", () => {
  it("400s on malformed JSON", async () => {
    expect((await handleVerifiedXenditRefundEvent("{x")).status).toBe(400);
  });

  it("200s and stays quiet on a success", async () => {
    const res = await handleVerifiedXenditRefundEvent(
      JSON.stringify({ event: "refund.succeeded", data: { id: "rf_1", status: "SUCCEEDED" } }),
    );
    expect(res.status).toBe(200);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("200s but logs loudly on a failure", async () => {
    const res = await handleVerifiedXenditRefundEvent(
      JSON.stringify({
        event: "refund.failed",
        data: { id: "rf_2", reference_id: "bk_2", failure_code: "INSUFFICIENT_BALANCE" },
      }),
    );
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("refund.failed"));
  });
});
