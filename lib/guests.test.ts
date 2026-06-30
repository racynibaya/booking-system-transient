import { describe, expect, it } from "vitest";

import { guestKey } from "./guests";

describe("guestKey", () => {
  it("prefers phone, normalized (spaces/dashes stripped)", () => {
    expect(guestKey("0917 123 4567", "a@b.com", "Juan")).toBe("09171234567");
    expect(guestKey("0917-123-4567", null, null)).toBe("09171234567");
    // same guest, two formats → same key
    expect(guestKey("0917 123 4567")).toBe(guestKey("09171234567"));
  });

  it("falls back to lowercased email when no phone", () => {
    expect(guestKey(null, "Maria@Example.com", "Maria")).toBe("maria@example.com");
    expect(guestKey("  ", "maria@example.com", "Maria")).toBe("maria@example.com");
  });

  it("falls back to lowercased name when no phone or email", () => {
    expect(guestKey(null, null, "Juan Dela Cruz")).toBe("juan dela cruz");
  });

  it("returns empty string when nothing identifies the guest", () => {
    expect(guestKey(null, null, null)).toBe("");
    expect(guestKey("", "", "")).toBe("");
  });
});
