/**
 * Pure slug generation for public property URLs (`/[property-slug]`). The slug is
 * a one-way-door public contract (architecture P9), so keep this deterministic and
 * unit-tested. Global uniqueness is enforced by the DB unique constraint, not here.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (combining marks)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/** Append a short numeric suffix, e.g. on a uniqueness collision: `beach-house` → `beach-house-2`. */
export function suffixSlug(slug: string, n: number): string {
  return `${slug}-${n}`;
}
