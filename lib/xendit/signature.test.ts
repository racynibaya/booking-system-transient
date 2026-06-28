import { describe, expect, it } from "vitest";

import { verifyCallbackToken } from "./signature";

describe("verifyCallbackToken", () => {
  const token = "xnd_callback_tok_abc123";

  it("accepts an exact match", () => {
    expect(verifyCallbackToken(token, token)).toBe(true);
  });

  it("rejects a different token of the same length", () => {
    const wrong = "xnd_callback_tok_abc124"; // last char differs, same length
    expect(verifyCallbackToken(wrong, token)).toBe(false);
  });

  it("rejects a token of a different length (no throw)", () => {
    expect(verifyCallbackToken(token + "x", token)).toBe(false);
    expect(verifyCallbackToken("short", token)).toBe(false);
  });

  it("rejects a missing/blank received header", () => {
    expect(verifyCallbackToken(null, token)).toBe(false);
    expect(verifyCallbackToken(undefined, token)).toBe(false);
    expect(verifyCallbackToken("", token)).toBe(false);
  });

  it("rejects when the expected token is unset (dormant env)", () => {
    expect(verifyCallbackToken(token, undefined)).toBe(false);
    expect(verifyCallbackToken(token, "")).toBe(false);
  });
});
