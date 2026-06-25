"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { toConfirmationBooking, type NotificationBookingRow } from "@/lib/email/notifications";
import { sendEmail } from "@/lib/email/resend";
import {
  guestCancelledEmail,
  guestConfirmedEmail,
  operatorBookingEmail,
} from "@/lib/email/templates";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createAnonClient, createClient } from "@/lib/supabase/server";
import { manualBookingInput, type ManualBookingInput } from "@/lib/validation";

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

// Operator cancels a booking (F2.1). A plain status write — no RPC needed: the
// bookings_update_own RLS policy already scopes the update to the operator's own
// tenant, and flipping status to 'cancelled' drops the row out of the occupancy
// predicate (held/awaiting_confirmation/confirmed) shared by create_booking_hold,
// get_public_listing and the calendar — so inventory frees automatically.
//
// The .in() guard keeps it idempotent: a re-cancel, or cancelling an already-
// terminal booking (cancelled/expired/completed/no_show), updates 0 rows → no-op.
//
// F2.3: notify the guest once. The .select().maybeSingle() returns the flipped row on the
// winning call and null on a no-op re-cancel (0 rows) — so we send the cancellation email
// ONLY when a row actually changed, the same fire-once guard as confirmBooking.
// The optional reason is bounded to keep the email + column sane; an empty/blank string
// normalizes to null so a no-note cancel doesn't store "".
const cancelReason = z.string().trim().max(500).optional();

export async function cancelBooking(bookingId: string, reason?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const parsedReason = cancelReason.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "That reason is too long (500 characters max)." };
  }
  const cancellationReason = parsedReason.data?.length ? parsedReason.data : null;

  const user = await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };

  const supabase = await createClient();
  const { data: cancelled, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancellation_reason: cancellationReason })
    .eq("id", bookingId)
    .in("status", ["held", "awaiting_confirmation", "confirmed"])
    .select(
      "guest_name, guest_email, guest_phone, check_in, check_out, num_guests, deposit_amount, total_amount",
    )
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't cancel this booking. Please try again." };

  // Best-effort guest notification — never affects the result (the booking is cancelled
  // either way). Only the winning call has a row to send for. reply-to is the operator so the
  // guest's reply actually reaches the host (there's no in-app messaging).
  if (cancelled?.guest_email) {
    const { subject, html } = guestCancelledEmail(
      toConfirmationBooking(cancelled),
      cancellationReason,
    );
    await sendEmail({
      to: cancelled.guest_email,
      subject,
      html,
      replyTo: user.email ?? undefined,
    });
  }

  revalidatePath("/bookings");
  return { ok: true };
}

// Operator records an off-platform booking (F2.2 — the core wedge). One booking engine
// (architecture P7): we go through the SAME create_booking_hold RPC as the public guest
// flow, so availability, the occupancy lock, and total/deposit stamping are shared — never
// a direct insert (authenticated has no INSERT grant on bookings). The RPC always creates a
// 'held' row; if the operator marked it confirmed, we flip it with a guarded UPDATE under
// the bookings_update_own RLS policy (same mechanism as cancelBooking), so no new migration.
//
// We pass a SHORT hold so that if the confirm-UPDATE fails the stray row self-expires fast
// rather than holding inventory for the default window.
const MANUAL_HOLD_MINUTES = 5;

export async function createManualBooking(input: ManualBookingInput): Promise<ActionResult> {
  const parsed = manualBookingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const d = parsed.data;

  const user = await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };

  // create_booking_hold is granted to anon (the public guest flow), NOT to authenticated —
  // so we call the one booking engine the same way the public path does, via the anon
  // client. It's SECURITY DEFINER and derives tenant_id from the room, and the form only
  // offers the operator's own rooms, so the hold lands under their tenant. The confirm flip
  // below then runs on the operator's RLS-scoped session client.
  const anon = createAnonClient();
  const { data, error } = await anon.rpc("create_booking_hold", {
    p_room_type_id: d.roomTypeId,
    p_check_in: d.checkIn,
    p_check_out: d.checkOut,
    p_num_guests: d.numGuests,
    p_guest_name: d.guestName,
    p_guest_phone: d.guestPhone || undefined,
    p_guest_email: d.guestEmail || undefined,
    p_hold_minutes: MANUAL_HOLD_MINUTES,
  });

  if (error) {
    const m = error.message;
    const friendly = m.includes("NO_AVAILABILITY")
      ? "Those dates aren't available for this room."
      : m.includes("INVALID_GUESTS")
        ? "That's more guests than this room holds."
        : m.includes("INVALID_RANGE")
          ? "Check-out must be after check-in."
          : m.includes("UNKNOWN_ROOM_TYPE")
            ? "That room couldn't be found. Please pick again."
            : "Something went wrong. Please try again.";
    return { ok: false, error: friendly };
  }

  // Guard on a real field, not row truthiness (PostgREST renders a NULL composite as an
  // all-null OBJECT — same trap as confirmBooking).
  const booking = data as (NotificationBookingRow & { id: string }) | null;
  if (!booking?.id) return { ok: false, error: "Something went wrong. Please try again." };

  if (d.status === "confirmed") {
    // Guarded UPDATE mirroring cancelBooking, on the operator's RLS-scoped session client:
    // .in(["held"]) is the row we just created, so this is idempotent and race-safe (a
    // concurrent expiry updates 0 rows harmlessly).
    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "confirmed", hold_expires_at: null })
      .eq("id", booking.id)
      .in("status", ["held"]);
    if (updateError) {
      // The booking IS real (held, dates protected) — make it visible and tell the operator.
      revalidatePath("/bookings");
      return {
        ok: false,
        error: "Booking saved but couldn't be marked confirmed. Open it from the dashboard.",
      };
    }
    // Best-effort guest confirmation (+ operator notification), mirroring the F1.5 confirm
    // flow. Never affects the result; the helper already guards on a present guest_email.
    await sendConfirmationEmails(booking, user.email ?? null);
  }

  revalidatePath("/bookings");
  redirect("/bookings");
}

// Best-effort. sendEmail never throws, but we also never let an email outcome
// affect the action result — the booking is already confirmed (build-plan F1.5).
async function sendConfirmationEmails(
  b: NotificationBookingRow,
  operatorEmail: string | null,
): Promise<void> {
  const data = toConfirmationBooking(b);

  const sends: Promise<boolean>[] = [];

  if (b.guest_email) {
    const { subject, html } = guestConfirmedEmail(data);
    // reply-to the operator so the guest can reply straight to their host.
    sends.push(
      sendEmail({ to: b.guest_email, subject, html, replyTo: operatorEmail ?? undefined }),
    );
  }
  if (operatorEmail) {
    const { subject, html } = operatorBookingEmail(data);
    sends.push(sendEmail({ to: operatorEmail, subject, html }));
  }

  await Promise.allSettled(sends);
}
