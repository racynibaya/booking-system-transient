import { describe, it, expect } from "vitest";

import { slugify, suffixSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Beach House")).toBe("beach-house");
  });

  it("collapses runs of non-alphanumerics into single hyphens", () => {
    expect(slugify("Kahuna  Surf — Resort!!")).toBe("kahuna-surf-resort");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Urbiztondo-  ")).toBe("urbiztondo");
  });

  it("strips diacritics", () => {
    expect(slugify("Niño Café")).toBe("nino-cafe");
  });

  it("keeps digits", () => {
    expect(slugify("Room 101")).toBe("room-101");
  });

  it("returns empty string for punctuation-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("suffixSlug", () => {
  it("appends a numeric suffix", () => {
    expect(suffixSlug("beach-house", 2)).toBe("beach-house-2");
  });
});
