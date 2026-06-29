import { toConfirmationBooking, type NotificationBookingRow } from "@/lib/email/notifications";
import { sendEmail } from "@/lib/email/resend";
import { guestConfirmedEmail } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/server";

// Shared Xendit Payment Session webhook body — everything AFTER token verification (the route verifies
// x-callback-token, then hands the verified raw body here; architecture P7, mirroring
// lib/paymongo/webhook-handler.ts). A completed PAY session confirms the booking via
// confirm_booking_gateway with p_provider 'xendit' → the SAME confirm (idempotency, AMOUNT_MISMATCH,
// paid-but-expired rescue, SLOT_TAKEN) but NO payout_ledger accrual (the Split Rule already routed the
// commission to the Master and the operator's share settled to their own sub-account).
//
// We ALWAYS return 200 for a well-formed event (handled, ignored, or idempotent no-op) so Xendit stops
// retrying; only malformed shape (400) or a transient confirm failure (500) is non-200.
type SessionEvent = {
  event?: string;
  data?: { reference_id?: string; status?: string; amount?: number; payment_id?: string };
};

export async function handleVerifiedXenditSessionEvent(rawBody: string): Promise<Response> {
  let event: SessionEvent;
  try {
    event = JSON.parse(rawBody) as SessionEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  // Only a COMPLETED PAY session confirms a booking; acknowledge everything else (expired, etc.).
  if (event.event !== "payment_session.completed" || event.data?.status !== "COMPLETED") {
    return new Response("ignored", { status: 200 });
  }

  // We set reference_id = bookingId when creating the session (lib/xendit/client.createPaymentSession).
  const bookingId = event.data.reference_id;
  if (!bookingId) {
    return new Response("no reference_id in session", { status: 200 });
  }

  // PHP is PLAIN PESOS (not centavos) — pass the settled amount straight through; the RPC verifies it
  // against the stamped gateway_charge_amount (AMOUNT_MISMATCH otherwise).
  const paidAmount = typeof event.data.amount === "number" ? event.data.amount : undefined;
  const providerRef = event.data.payment_id ?? null;

  const admin = createServiceClient();
  const { data: booking, error } = await admin.rpc("confirm_booking_gateway", {
    p_booking_id: bookingId,
    p_provider: "xendit",
    p_provider_ref: providerRef ?? undefined,
    p_amount: paidAmount,
    p_raw_payload: event as never,
  });

  if (error) {
    // PERMANENT business errors will never succeed on retry → 200 so Xendit stops; transient (DB/network)
    // → 500 so Xendit retries. SLOT_TAKEN / AMOUNT_MISMATCH mean the guest paid but we can't honor it —
    // a refund is needed (Slice 3); the reconcile sweep + this acknowledged log are the safety net.
    const permanent = ["SLOT_TAKEN", "AMOUNT_MISMATCH", "NOT_CONFIRMABLE", "UNKNOWN_BOOKING"].some(
      (code) => error.message.includes(code),
    );
    return new Response(`confirm failed: ${error.message}`, { status: permanent ? 200 : 500 });
  }

  // Real confirm (composite row, guard on a real field — NULL-composite renders all-null). Email guest.
  if (booking?.id) {
    await sendGuestConfirmation(booking as NotificationBookingRow);
    return new Response("ok", { status: 200 });
  }

  // RPC no-op'd (replay) — harmless only if THIS payment is already on file; otherwise a distinct second
  // payment landed on an already-confirmed booking (guest charged twice) → log loudly for out-of-band refund.
  await flagSecondPaymentIfDistinct(admin, bookingId, providerRef);
  return new Response("ok", { status: 200 });
}

async function sendGuestConfirmation(booking: NotificationBookingRow): Promise<void> {
  if (!booking.guest_email) return;
  const { subject, html } = guestConfirmedEmail(toConfirmationBooking(booking));
  await sendEmail({ to: booking.guest_email, subject, html });
}

async function flagSecondPaymentIfDistinct(
  admin: ReturnType<typeof createServiceClient>,
  bookingId: string,
  providerRef: string | null,
): Promise<void> {
  if (!providerRef) {
    console.error(`[xendit] SECOND_PAYMENT? no provider_ref to verify; booking=${bookingId}`);
    return;
  }
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (!existing) {
    console.error(
      `[xendit] SECOND_PAYMENT booking=${bookingId} provider_ref=${providerRef} — paid against an already-confirmed booking; refund needed`,
    );
  }
}
