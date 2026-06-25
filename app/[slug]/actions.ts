"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { sendEmail } from "@/lib/email/resend";
import { guestRequestReceivedEmail } from "@/lib/email/templates";
import { createCheckoutSession, toCentavos } from "@/lib/paymongo/client";
import { getGatewayConnection } from "@/lib/supabase/gateway-dal";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from "@/lib/validation";

// Public booking input (P5: validated at the trust boundary). The guest is anonymous.
const publicBookingInput = z.object({
  roomTypeId: z.uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  numGuests: z.number().int().positive(),
  guestName: z.string().trim().min(1, "Your name is required").max(120),
  guestPhone: z.string().trim().max(40).optional().or(z.literal("")),
  guestEmail: z.email("Please enter a valid email address"),
  // Attribution tag from the booking link (?src=…). Pure metadata for the operator; never
  // touches the money path. Stamped after the hold via a best-effort service-role update.
  source: z.string().trim().max(60).optional(),
});
export type PublicBookingInput = z.infer<typeof publicBookingInput>;

export type PublicPaymentMethod = {
  type: PaymentMethodType;
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  qrUrl: string | null;
};

export type BookingResult =
  | {
      ok: true;
      bookingId: string;
      holdExpiresAt: string | null;
      total: number | null;
      deposit: number | null;
      paymentMethods: PublicPaymentMethod[];
    }
  | { ok: false; error: string };

// The guest holds the slot for this long — long enough to open GCash, pay, screenshot, and
// upload before the hold lapses (F1.4 paid-but-expired mitigation).
const HOLD_MINUTES = process.env.NODE_ENV === "development" ? 1 : 30;

export async function createPublicBooking(input: PublicBookingInput): Promise<BookingResult> {
  const parsed = publicBookingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const d = parsed.data;

  // Anon, session-less client → the create_booking_hold RPC (granted anon) enforces
  // the no-double-booking invariant atomically (architecture P1) and stamps total/deposit.
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("create_booking_hold", {
    p_room_type_id: d.roomTypeId,
    p_check_in: d.checkIn,
    p_check_out: d.checkOut,
    p_num_guests: d.numGuests,
    p_guest_name: d.guestName,
    p_guest_phone: d.guestPhone || undefined,
    p_guest_email: d.guestEmail,
    p_hold_minutes: HOLD_MINUTES,
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

  const booking = data as {
    id: string;
    tenant_id: string;
    hold_expires_at: string | null;
    total_amount: number | null;
    deposit_amount: number | null;
  } | null;
  if (!booking) return { ok: false, error: "Something went wrong. Please try again." };

  // Stamp the attribution tag best-effort, AFTER the atomic hold (the money-critical RPC stays
  // untouched). Service-role: anon has no UPDATE grant. set-once-when-null so a later request can't
  // overwrite it; an email/availability failure here never affects the booking the guest just made.
  if (d.source) {
    const admin = createServiceClient();
    await admin
      .from("bookings")
      .update({ source: d.source })
      .eq("id", booking.id)
      .is("source", null);
  }

  // Auto-acknowledge (Pro/Business perk): email the guest the moment the hold lands, so they're never
  // left silent and get a nudge to finish paying. Gated by plan and best-effort — a send failure (or a
  // non-Pro tenant) never affects the booking the guest just made. Awaited (not fire-and-forget) so it
  // actually completes before this serverless invocation ends.
  if (d.guestEmail) {
    await sendRequestAck(booking.tenant_id, d, booking.total_amount, booking.deposit_amount);
  }

  // Payout methods are delivered WITH the hold (never via the public listing — anti-scrape). anon
  // has no grant on the table, so read through the service-role client.
  const paymentMethods = await getPaymentMethodsForGuest(booking.tenant_id);

  return {
    ok: true,
    bookingId: booking.id,
    holdExpiresAt: booking.hold_expires_at,
    total: booking.total_amount,
    deposit: booking.deposit_amount,
    paymentMethods,
  };
}

// Pro/Business auto-acknowledge. Reads the tenant's plan (anon has no grant → service role) and only
// emails for plan in ('pro','business'). Never throws: any failure here is swallowed so it can't roll
// back the guest's hold (sendEmail itself is already best-effort and dry-runs without RESEND_API_KEY).
async function sendRequestAck(
  tenantId: string,
  input: PublicBookingInput,
  totalAmount: number | null,
  depositAmount: number | null,
): Promise<void> {
  try {
    const admin = createServiceClient();
    const { data: tenant } = await admin.from("tenants").select("plan").eq("id", tenantId).single();
    if (tenant?.plan !== "pro" && tenant?.plan !== "business") return;

    const { subject, html } = guestRequestReceivedEmail(
      {
        guestName: input.guestName,
        guestEmail: input.guestEmail || null,
        guestPhone: input.guestPhone || null,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numGuests: input.numGuests,
        depositAmount,
        totalAmount,
      },
      { holdMinutes: HOLD_MINUTES },
    );
    await sendEmail({ to: input.guestEmail as string, subject, html });
  } catch {
    // best-effort: an ack failure never affects the booking
  }
}

async function getPaymentMethodsForGuest(tenantId: string): Promise<PublicPaymentMethod[]> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("tenant_payment_methods")
    .select("type, account_name, account_number, bank_name, qr_path, sort_order, created_at")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((m) => ({
    type: m.type,
    label: PAYMENT_METHOD_LABELS[m.type],
    accountName: m.account_name,
    accountNumber: m.account_number,
    bankName: m.bank_name,
    qrUrl: m.qr_path
      ? admin.storage.from("property-images").getPublicUrl(m.qr_path).data.publicUrl
      : null,
  }));
}

// --- Gateway checkout (Phase 2a spike — PayMongo, Business tier) --------------------------
//
// The instant-confirmation alternative to GCash+proof: create a hosted PayMongo Checkout
// Session for the booking's deposit and return its URL for the guest to pay on. Confirmation
// happens out-of-band via the webhook (app/api/webhooks/paymongo) → confirm_booking_gateway —
// the redirect back is best-effort UX, never the source of truth (architecture P10).
//
// Operator-as-merchant (B8): the deposit is charged on the HOST's own PayMongo account via their
// per-tenant connection (M1 Vault store), looked up here by tenant. We NEVER fall back to a platform
// env key — that would route a guest's money to the wrong merchant. The booking hold, the metadata
// contract, and the webhook are identical to the 2a path; only the key source is per-tenant.
export type GatewayCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function createGatewayCheckout(bookingId: string): Promise<GatewayCheckoutResult> {
  if (!z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  // Service-role: anon can't read bookings. The booking id is the guest's capability; we only
  // start a checkout for a live hold awaiting payment.
  const admin = createServiceClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "tenant_id, status, deposit_amount, gateway_checkout_url, guest_name, guest_email, property:properties(slug, name)",
    )
    .eq("id", bookingId)
    .single();

  if (!booking) return { ok: false, error: "We couldn't find that booking." };
  if (booking.status !== "held") {
    return { ok: false, error: "This booking is no longer awaiting payment." };
  }
  if (!booking.deposit_amount || booking.deposit_amount <= 0) {
    return { ok: false, error: "This booking has no deposit to collect." };
  }

  // Double-charge guard: if we already opened a session for this held booking, hand back the SAME
  // single-use URL. A PayMongo checkout session can only be paid once, so reusing it makes a
  // double-click / refresh / two-tab double-charge impossible.
  if (booking.gateway_checkout_url) {
    return { ok: true, checkoutUrl: booking.gateway_checkout_url };
  }

  // The host's own PayMongo connection (operator-as-merchant). No active connection → online payment
  // isn't available for this host; never fall back to a platform key (B8). A connection only exists
  // once the operator connects in Settings, which is itself gated on plan='business' (M2).
  const connection = await getGatewayConnection(booking.tenant_id);
  if (!connection || connection.status !== "active") {
    return { ok: false, error: "Online payment isn't available for this host yet." };
  }

  const property = booking.property as { slug: string; name: string } | null;
  const slug = property?.slug ?? "";

  // Build absolute return URLs from the inbound request origin (no site-URL env needed for the
  // spike). The webhook is the truth; ?b is only so the return page can show a friendly status.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  try {
    const { checkoutUrl } = await createCheckoutSession({
      secretKey: connection.sk,
      lineItems: [
        {
          name: `Deposit — ${property?.name ?? "booking"}`,
          amount: toCentavos(Number(booking.deposit_amount)),
          quantity: 1,
        },
      ],
      description: `Booking deposit (${bookingId})`,
      successUrl: `${origin}/${slug}/pay/return?b=${bookingId}`,
      cancelUrl: `${origin}/${slug}`,
      // The webhook maps the payment back to this booking/tenant via these.
      metadata: { booking_id: bookingId, tenant_id: booking.tenant_id },
    });

    // Persist the session so any repeat call reuses it (above). Claim atomically — only the call
    // that finds the column still null "wins". If two calls created sessions concurrently, the
    // loser's session is left unused and BOTH callers redirect to the single stored URL, so the
    // guest still sees one payment page.
    const { data: claimed } = await admin
      .from("bookings")
      .update({ gateway_checkout_url: checkoutUrl })
      .eq("id", bookingId)
      .is("gateway_checkout_url", null)
      .select("gateway_checkout_url")
      .maybeSingle();
    if (claimed?.gateway_checkout_url) {
      return { ok: true, checkoutUrl: claimed.gateway_checkout_url };
    }
    // Lost the race — another concurrent call already stored a session; reuse theirs.
    const { data: existing } = await admin
      .from("bookings")
      .select("gateway_checkout_url")
      .eq("id", bookingId)
      .single();
    return { ok: true, checkoutUrl: existing?.gateway_checkout_url ?? checkoutUrl };
  } catch {
    return { ok: false, error: "Couldn't start the payment. Please try again." };
  }
}

// --- Proof upload (F1.4) -----------------------------------------------------------------
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export type ProofResult = { ok: true } | { ok: false; error: string };

export async function submitProof(formData: FormData): Promise<ProofResult> {
  const bookingId = formData.get("bookingId");
  const file = formData.get("proof");

  if (typeof bookingId !== "string" || !z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please attach your GCash payment screenshot." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Please upload an image (JPG, PNG, WEBP, or HEIC)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That image is too large — keep it under 5 MB." };
  }

  // Service-role: anon can't read bookings (to resolve the tenant folder) or write the
  // private bucket. The booking id is the guest's capability; the RPC guards the state.
  const admin = createServiceClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("tenant_id")
    .eq("id", bookingId)
    .single();
  if (!booking) return { ok: false, error: "We couldn't find that booking." };

  const path = `${booking.tenant_id}/${bookingId}/proof.${EXT[file.type] ?? "jpg"}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return { ok: false, error: "Upload failed. Please try again." };
  }

  const { error } = await admin.rpc("submit_proof", {
    p_booking_id: bookingId,
    p_proof_url: path,
  });
  if (error) {
    const m = error.message;
    const friendly = m.includes("SLOT_TAKEN")
      ? "Your hold lapsed and the dates were taken — please don't send payment. Contact the host."
      : m.includes("NOT_HELD")
        ? "This booking can no longer accept a payment proof."
        : "Something went wrong. Please try again.";
    return { ok: false, error: friendly };
  }

  return { ok: true };
}
