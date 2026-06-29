import { describe, expect, it } from "vitest";

import { parseAccountStatus, parseAccountEvent, shouldApplyStatusTransition } from "./status";

describe("parseAccountStatus", () => {
  it("accepts every Xendit status verbatim", () => {
    for (const s of [
      "INVITED",
      "REGISTERED",
      "AWAITING_DOCS",
      "PENDING_VERIFICATION",
      "LIVE",
      "SUSPENDED",
    ]) {
      expect(parseAccountStatus(s)).toBe(s);
    }
  });

  it("rejects unknown / wrong-case / empty (fails safe)", () => {
    expect(parseAccountStatus("live")).toBeNull(); // case-sensitive on purpose
    expect(parseAccountStatus("APPROVED")).toBeNull(); // not Xendit's vocabulary
    expect(parseAccountStatus("")).toBeNull();
    expect(parseAccountStatus(null)).toBeNull();
    expect(parseAccountStatus(undefined)).toBeNull();
  });
});

describe("shouldApplyStatusTransition", () => {
  it("ignores a duplicate (same status)", () => {
    expect(shouldApplyStatusTransition("LIVE", "LIVE")).toBe(false);
    expect(shouldApplyStatusTransition("INVITED", "INVITED")).toBe(false);
  });

  it("applies forward progress up the onboarding ladder", () => {
    expect(shouldApplyStatusTransition("INVITED", "REGISTERED")).toBe(true);
    expect(shouldApplyStatusTransition("AWAITING_DOCS", "PENDING_VERIFICATION")).toBe(true);
    expect(shouldApplyStatusTransition("PENDING_VERIFICATION", "LIVE")).toBe(true);
  });

  it("ignores a backward (stale/replayed) ladder event", () => {
    expect(shouldApplyStatusTransition("LIVE", "PENDING_VERIFICATION")).toBe(false);
    expect(shouldApplyStatusTransition("REGISTERED", "INVITED")).toBe(false);
  });

  it("always honors a takedown, even out of order", () => {
    expect(shouldApplyStatusTransition("LIVE", "SUSPENDED")).toBe(true);
    expect(shouldApplyStatusTransition("INVITED", "SUSPENDED")).toBe(true);
  });

  it("only LIVE reinstates a suspended account; stale ladder events stay ignored", () => {
    expect(shouldApplyStatusTransition("SUSPENDED", "LIVE")).toBe(true);
    expect(shouldApplyStatusTransition("SUSPENDED", "PENDING_VERIFICATION")).toBe(false);
    expect(shouldApplyStatusTransition("SUSPENDED", "INVITED")).toBe(false);
  });
});

describe("parseAccountEvent", () => {
  it("maps account.registered (id at data.user_id) → REGISTERED", () => {
    expect(
      parseAccountEvent({
        event: "account.registered",
        data: { user_id: "sub_123", account_info: { payments_enabled: false } },
      }),
    ).toEqual({ subAccountId: "sub_123", status: "REGISTERED" });
  });

  it("maps account.activated with payments_enabled → LIVE", () => {
    expect(
      parseAccountEvent({
        event: "account.activated",
        data: { user_id: "sub_123", account_info: { payments_enabled: true } },
      }),
    ).toEqual({ subAccountId: "sub_123", status: "LIVE" });
  });

  it("ignores account.activated when payments are not yet enabled", () => {
    expect(
      parseAccountEvent({
        event: "account.activated",
        data: { user_id: "sub_123", account_info: { payments_enabled: false } },
      }),
    ).toBeNull();
  });

  it("maps account.suspended (id at data.id, not user_id) → SUSPENDED", () => {
    expect(
      parseAccountEvent({
        event: "account.suspended",
        data: { id: "sub_123", status: "SUSPENDED", reason: "FRAUD_PROMO_ABUSE" },
      }),
    ).toEqual({ subAccountId: "sub_123", status: "SUSPENDED" });
  });

  it("maps OWNED account.created/updated (id at data.id) via data.status", () => {
    expect(
      parseAccountEvent({
        event: "account.created",
        data: { id: "sub_owned", status: "REGISTERED" },
      }),
    ).toEqual({ subAccountId: "sub_owned", status: "REGISTERED" });
    expect(
      parseAccountEvent({ event: "account.updated", data: { id: "sub_owned", status: "LIVE" } }),
    ).toEqual({ subAccountId: "sub_owned", status: "LIVE" });
  });

  it("ignores unrelated events and malformed bodies", () => {
    // account.created without a parseable status → null (the OWNED path needs a status).
    expect(parseAccountEvent({ event: "account.created", data: { id: "x" } })).toBeNull();
    expect(
      parseAccountEvent({ event: "account_holder.capabilities.status", data: { id: "x" } }),
    ).toBeNull();
    expect(parseAccountEvent({ event: "account.registered" })).toBeNull(); // no data
    expect(parseAccountEvent(null)).toBeNull();
    expect(parseAccountEvent("nope")).toBeNull();
  });
});
