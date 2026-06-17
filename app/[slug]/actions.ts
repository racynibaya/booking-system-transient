"use server";

import { z } from "zod";

import { createAnonClient } from "@/lib/supabase/server";

// Public booking input (P5: validated at the trust boundary). The guest is anonymous.
const publicBookingInput = z.object({
  roomTypeId: z.uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  numGuests: z.number().int().positive(),
  guestName: z.string().trim().min(1, "Your name is required").max(120),
  guestPhone: z.string().trim().max(40).optional().or(z.literal("")),
  guestEmail: z.email().optional().or(z.literal("")),
});
export type PublicBookingInput = z.infer<typeof publicBookingInput>;

export type BookingResult =
  | { ok: true; holdExpiresAt: string | null }
  | { ok: false; error: string };

export async function createPublicBooking(input: PublicBookingInput): Promise<BookingResult> {
  const parsed = publicBookingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const d = parsed.data;

  // Anon, session-less client → the create_booking_hold RPC (granted anon) enforces
  // the no-double-booking invariant atomically (architecture P1).
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("create_booking_hold", {
    p_room_type_id: d.roomTypeId,
    p_check_in: d.checkIn,
    p_check_out: d.checkOut,
    p_num_guests: d.numGuests,
    p_guest_name: d.guestName,
    p_guest_phone: d.guestPhone || undefined,
    p_guest_email: d.guestEmail || undefined,
  });

  if (error) {
    const m = error.message;
    const friendly = m.includes("NO_AVAILABILITY")
      ? "Just taken — those dates aren't available anymore."
      : m.includes("INVALID_GUESTS")
        ? "That's more guests than this room holds."
        : m.includes("INVALID_RANGE")
          ? "Check-out must be after check-in."
          : "Something went wrong. Please try again.";
    return { ok: false, error: friendly };
  }

  const booking = data as { hold_expires_at: string | null } | null;
  return { ok: true, holdExpiresAt: booking?.hold_expires_at ?? null };
}
