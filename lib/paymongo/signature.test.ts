import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";

import { parsePaymongoSignature, verifyWebhookSignature, toCentavos } from "./signature";

const SECRET = "whsk_test_example_secret";

// Build a valid Paymongo-Signature header for a given body, the way PayMongo would.
function sign(rawBody: string, slot: "te" | "li", secret = SECRET, t = "1700000000"): string {
  const sig = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return slot === "te" ? `t=${t},te=${sig},li=` : `t=${t},te=,li=${sig}`;
}

describe("toCentavos", () => {
  it("converts pesos to integer centavos", () => {
    expect(toCentavos(1)).toBe(100);
    expect(toCentavos(1500.5)).toBe(150050);
    expect(toCentavos(2250)).toBe(225000);
  });
});

describe("parsePaymongoSignature", () => {
  it("parses t/te/li", () => {
    expect(parsePaymongoSignature("t=123,te=abc,li=def")).toEqual({
      timestamp: "123",
      test: "abc",
      live: "def",
    });
  });

  it("rejects a header missing the timestamp or both signatures", () => {
    expect(parsePaymongoSignature("te=abc,li=def")).toBeNull();
    expect(parsePaymongoSignature("t=123,te=,li=")).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid" } } });

  it("accepts a correctly signed body (test slot)", () => {
    expect(verifyWebhookSignature(body, sign(body, "te"), SECRET)).toBe(true);
  });

  it("accepts a correctly signed body (live slot)", () => {
    expect(verifyWebhookSignature(body, sign(body, "li"), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = sign(body, "te");
    expect(verifyWebhookSignature(body + " ", header, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "te"), "whsk_wrong")).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "garbage", SECRET)).toBe(false);
  });
});
