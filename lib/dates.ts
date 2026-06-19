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

// Format a `YYYY-MM-DD` string as a friendly "Jun 20". Builds the Date locally
// (via fromDateStr) so there's no UTC day-shift. Returns the input unchanged if
// it doesn't parse.
export function formatDateShort(s: DateStr): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fromDateStr(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format a 24h "HH:MM" (or "HH:MM:SS") time string as a friendly "2:00 PM". Pure string
// math — no Date, no timezone. Returns the input unchanged if it doesn't look like a time.
export function formatTime(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${period}`;
}

// Render-time freshness check (e.g. the GCash re-verify 24h grace). Kept here so the impure
// `Date.now()` lives in a util, not in a component's render path.
export function isOlderThanHours(iso: string, hours: number): boolean {
  return Date.now() - new Date(iso).getTime() > hours * 60 * 60 * 1000;
}

// Whole days from today to a YYYY-MM-DD date (negative = in the past). Local-midnight based.
export function daysFromToday(s: DateStr): number {
  const ms = fromDateStr(s).getTime() - fromDateStr(todayStr()).getTime();
  return Math.round(ms / 86_400_000);
}

// Relative-day label for the bookings board pill ("Today", "Tomorrow", "in 3 days", "2 wk ago").
export function relativeDay(s: DateStr): string {
  const d = daysFromToday(s);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 0) return d < 14 ? `in ${d} days` : `in ${Math.round(d / 7)} wk`;
  const a = -d;
  return a < 14 ? `${a} days ago` : `${Math.round(a / 7)} wk ago`;
}
