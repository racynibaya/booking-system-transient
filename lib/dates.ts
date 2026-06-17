/**
 * Calendar-date helpers. Availability dates are plain `YYYY-MM-DD` strings (the DB
 * columns are `date`, no timezone). String compare on ISO dates is chronological,
 * so all availability logic stays in strings. Convert to/from `Date` ONLY at the
 * UI edge (react-day-picker), and NEVER via `new Date("2026-10-10")` — that parses
 * as UTC midnight and shifts the day in negative-offset zones. Construct locally.
 */
export type DateStr = string; // 'YYYY-MM-DD'

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight — no UTC shift
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function todayStr(): DateStr {
  return toDateStr(new Date());
}
