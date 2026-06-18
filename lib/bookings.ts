import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

// A held booking whose hold has lapsed no longer occupies inventory — every occupancy query
// filters on (hold_expires_at is null or hold_expires_at > now()), so those dates are already
// free. But the stored `status` still says 'held', so the dashboard would show a dead hold as
// "Held" until something flips it. We reconcile that at read time: treat a lapsed hold as
// 'expired' for display, so the board matches reality without a background sweep.
//
// Only 'held' is overridden — 'awaiting_confirmation' clears hold_expires_at (sweep-exempt by
// design) and 'confirmed' has no expiry, so neither is affected.
export function effectiveStatus(
  status: BookingStatus,
  holdExpiresAt: string | null,
  now: number = Date.now(),
): BookingStatus {
  if (status === "held" && holdExpiresAt && Date.parse(holdExpiresAt) <= now) {
    return "expired";
  }
  return status;
}
