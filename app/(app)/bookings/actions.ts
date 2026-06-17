"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { sendEmail } from "@/lib/email/resend";
import {
  guestConfirmedEmail,
  operatorBookingEmail,
  type ConfirmationBooking,
} from "@/lib/email/templates";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Operator confirms a paid booking (the F1.4 trigger seam) and F1.5 fires the
// notifications. The confirm_booking RPC is SECURITY INVOKER + RLS-scoped, so we
// use the operator's own session client — never service-role.
//
// Idempotency comes free from the RPC: it flips the row only WHERE status =
// 'awaiting_confirmation' and returns the booking on the winning call, null on any
// later call. So we send emails ONLY in the non-null branch → exactly once. A
// retried confirm returns null → no second email, no second payment row.
export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const user = await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };

  const supabase = await createClient();
  const { data: booking, error } = await supabase.rpc("confirm_booking", {
    p_booking_id: bookingId,
  });
  if (error) return { ok: false, error: "Couldn't confirm this booking. Please try again." };

  // No-op re-confirm → nothing to send. The RPC "returns null" for an already-confirmed
  // booking, but PostgREST renders a NULL composite as an all-null OBJECT ({id:null,…}) —
  // which is truthy — so guard on a real field, not the row's truthiness.
  if (booking?.id) {
    await sendConfirmationEmails(booking, user.email ?? null);
  }

  revalidatePath("/bookings");
  return { ok: true };
}

type BookingRow = {
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  num_guests: number;
  deposit_amount: number | null;
  total_amount: number | null;
};

// Best-effort. sendEmail never throws, but we also never let an email outcome
// affect the action result — the booking is already confirmed (build-plan F1.5).
async function sendConfirmationEmails(b: BookingRow, operatorEmail: string | null): Promise<void> {
  const data: ConfirmationBooking = {
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    guestPhone: b.guest_phone,
    checkIn: b.check_in,
    checkOut: b.check_out,
    numGuests: b.num_guests,
    depositAmount: b.deposit_amount,
    totalAmount: b.total_amount,
  };

  const sends: Promise<boolean>[] = [];

  if (b.guest_email) {
    const { subject, html } = guestConfirmedEmail(data);
    sends.push(sendEmail({ to: b.guest_email, subject, html }));
  }
  if (operatorEmail) {
    const { subject, html } = operatorBookingEmail(data);
    sends.push(sendEmail({ to: operatorEmail, subject, html }));
  }

  await Promise.allSettled(sends);
}
