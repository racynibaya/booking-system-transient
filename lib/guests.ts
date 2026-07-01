// S1 — guest identity for the CRM. Bookings store guest contact inline (no guest entity), so a
// repeat guest is derived: group an operator's bookings by a stable key. Phone first (most reliable
// for walk-ins/transients), email next, name as a last resort. Pure + framework-free so the DAL and
// the pages key off the exact same value, and it's unit-testable.
export function guestKey(
  phone?: string | null,
  email?: string | null,
  name?: string | null,
): string {
  const p = (phone ?? "").replace(/[\s-]/g, "");
  if (p) return p;
  const e = (email ?? "").trim().toLowerCase();
  if (e) return e;
  return (name ?? "").trim().toLowerCase();
}
