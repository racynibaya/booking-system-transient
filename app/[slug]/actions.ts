"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { env } from "@/env";
import {
  DEFAULT_AUTO_REPLY,
  notifyGuestInquiryReceived,
  notifyOperatorNewInquiry,
} from "@/lib/email/inquiry";
import { sendEmail } from "@/lib/email/resend";
import { guestRequestReceivedEmail } from "@/lib/email/templates";
import { computeXenditSplit, meetsMinStay, MIN_STAY_NIGHTS } from "@/lib/pricing";
import { TERMS_VERSION } from "@/lib/legal/version";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from "@/lib/validation";
import { createPaymentSession, createSplitRule } from "@/lib/xendit/client";

// Public booking input (P5: validated at the trust boundary). The guest is anonymous.
const publicBookingInput = z
  .object({
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
    // Guest's acceptance of the Terms (Part A clickwrap). Enforced in the action body; the accepted
    // version is stamped onto the booking after the hold.
    termsAccepted: z.boolean().optional(),
  })
  // Basic range sanity (check-out after check-in). The per-property minimum-stay gate can't live
  // in the static schema — it depends on the room's property setting — so it's enforced in the
  // action body below (still server-side: the P5 trust boundary).
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
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

  // Throttle anonymous hold creation per IP so nobody can flood inventory with junk holds.
  if (!(await rateLimit(`pub:booking:${await clientIp()}`, 12, 300))) {
    return { ok: false, error: "Too many requests. Please wait a moment and try again." };
  }

  if (!d.termsAccepted) {
    return { ok: false, error: "Please accept the Terms to book." };
  }

  // Per-property guest-facing minimum stay (the authoritative server-side gate; the booking-card
  // mirrors it for UX). Config read, not money — fetched via the service client like the other
  // tenant reads here. Fall back to the default if the row can't be read, never skip the check.
  {
    const admin = createServiceClient();
    const { data: rt } = await admin
      .from("room_types")
      .select("properties(min_stay_nights)")
      .eq("id", d.roomTypeId)
      .single();
    const minNights = rt?.properties?.min_stay_nights ?? MIN_STAY_NIGHTS;
    if (!meetsMinStay(d.checkIn, d.checkOut, minNights)) {
      return {
        ok: false,
        error: `Minimum stay is ${minNights} ${minNights === 1 ? "night" : "nights"}.`,
      };
    }
  }

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
    const friendly = m.includes("SUBSCRIPTION_LAPSED")
      ? "This booking page is closed right now. Please contact the host to book."
      : m.includes("NO_AVAILABILITY")
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

  // Stamp the accepted Terms version onto the booking — the guest's clickwrap record (Part A).
  // Same best-effort, set-once, service-role pattern as the source stamp above.
  {
    const admin = createServiceClient();
    await admin
      .from("bookings")
      .update({ terms_version: TERMS_VERSION })
      .eq("id", booking.id)
      .is("terms_version", null);
  }

  // Auto-acknowledge (Pro/Business perk): email the guest the moment the hold lands, so they're never
  // left silent and get a nudge to finish paying. Gated by plan and best-effort — a send failure (or a
  // non-Pro tenant) never affects the booking the guest just made. Awaited (not fire-and-forget) so it
  // actually completes before this serverless invocation ends.
  if (d.guestEmail) {
    await sendRequestAck(d, booking.total_amount, booking.deposit_amount);
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

// Auto-acknowledge every inquiry (now standard for all hosts — tier gating removed at the commission
// cutover). Never throws: any failure here is swallowed so it can't roll back the guest's hold
// (sendEmail itself is already best-effort and dry-runs without RESEND_API_KEY).
async function sendRequestAck(
  input: PublicBookingInput,
  totalAmount: number | null,
  depositAmount: number | null,
): Promise<void> {
  try {
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

// Shared result type for the hosted-checkout action below (Xendit).
export type GatewayCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

// --- Xendit checkout (xenPlatform commission rail — Slice 2) ------------------------------
//
// The custody-clean checkout (replaces the retired aggregator platform checkout): the guest charge is a Payment Session
// created ON the operator's LIVE sub-account (for-user-id), with a flat-commission Split Rule routing
// Tuloy's 2.5% to the Master at capture — funds never touch a Tuloy balance, and the operator's share
// settles to their own sub-account (they self-withdraw). Dormant until XENDIT_SECRET_KEY +
// XENDIT_MASTER_ACCOUNT_ID are set AND the operator's kyc_status is LIVE. Confirmation is the Session
// webhook → confirm_booking_gateway (Slice 2c); the redirect is UX only. NOT yet wired to the pay
// button (the caller still uses the aggregator path) and UNVERIFIED end-to-end — needs a LIVE operator.
export async function createXenditCheckout(bookingId: string): Promise<GatewayCheckoutResult> {
  if (!z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!env.XENDIT_SECRET_KEY || !env.XENDIT_MASTER_ACCOUNT_ID) {
    return { ok: false, error: "Online payment isn't available right now." };
  }

  const admin = createServiceClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "tenant_id, status, deposit_amount, total_amount, gateway_checkout_url, property:properties(slug, name)",
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
  if (!booking.total_amount || booking.total_amount <= 0) {
    return { ok: false, error: "This booking has no total to charge." };
  }

  // Reuse the single-use session on any repeat call (double-charge guard).
  if (booking.gateway_checkout_url) {
    return { ok: true, checkoutUrl: booking.gateway_checkout_url };
  }

  // The operator must have a LIVE Xendit sub-account; it carries their per-owner commission rate.
  const { data: xa } = await admin
    .from("tenant_xendit_accounts")
    .select("sub_account_id, kyc_status, commission_rate")
    .eq("tenant_id", booking.tenant_id)
    .maybeSingle();
  if (!xa || xa.kyc_status !== "LIVE") {
    return { ok: false, error: "Online payment isn't available for this host yet." };
  }

  const split = computeXenditSplit(
    Number(booking.total_amount),
    Number(booking.deposit_amount),
    Number(xa.commission_rate),
  );

  const property = booking.property as { slug: string; name: string } | null;
  const slug = property?.slug ?? "";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  try {
    // One flat-commission split rule per booking (commission is a per-stay peso amount), routing
    // Tuloy's cut to the Master. Then a Payment Session on the operator's sub-account with it attached.
    const rule = await createSplitRule({
      secretKey: env.XENDIT_SECRET_KEY,
      name: `Tuloy commission ${bookingId}`,
      routes: [
        {
          flatAmount: split.commission,
          destinationAccountId: env.XENDIT_MASTER_ACCOUNT_ID,
          referenceId: `commission-${bookingId}`,
        },
      ],
    });

    const session = await createPaymentSession({
      secretKey: env.XENDIT_SECRET_KEY,
      forUserId: xa.sub_account_id,
      splitRuleId: rule.id,
      referenceId: bookingId,
      amount: split.guestTotal,
      description: `Booking deposit — ${property?.name ?? "booking"}`,
      successReturnUrl: `${origin}/${slug}/pay/return?b=${bookingId}`,
      cancelReturnUrl: `${origin}/${slug}`,
      metadata: { booking_id: bookingId, tenant_id: booking.tenant_id },
    });

    // Claim the session URL atomically (double-charge guard) + stamp the grossed-up charge so the
    // webhook's confirm verifies the settled amount against it.
    const { data: claimed } = await admin
      .from("bookings")
      .update({ gateway_checkout_url: session.sessionUrl, gateway_charge_amount: split.guestTotal })
      .eq("id", bookingId)
      .is("gateway_checkout_url", null)
      .select("gateway_checkout_url")
      .maybeSingle();
    if (claimed?.gateway_checkout_url) {
      return { ok: true, checkoutUrl: claimed.gateway_checkout_url };
    }
    const { data: existing } = await admin
      .from("bookings")
      .select("gateway_checkout_url")
      .eq("id", bookingId)
      .single();
    return { ok: true, checkoutUrl: existing?.gateway_checkout_url ?? session.sessionUrl };
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

// M2 — a guest asks a question from the public listing (no account). Service-role path (the guest
// is anonymous): resolve the listing by slug, open a thread, record the first message. A rendered
// public listing is already approved (get_public_listing gates it), so reaching here implies a live
// listing. Operator notification email lands in M2b.
const inquiryInput = z.object({
  slug: z.string().min(1),
  guestName: z.string().trim().min(1).max(100),
  guestEmail: z.string().trim().email().max(200),
  guestPhone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(2000),
});

export async function createInquiry(
  raw: z.infer<typeof inquiryInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = inquiryInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please add your name, email, and question." };
  }
  const { slug, guestName, guestEmail, guestPhone, message } = parsed.data;

  // Throttle inquiries per IP (each one fans out an operator email — spam + cost guard).
  if (!(await rateLimit(`pub:inquiry:${await clientIp()}`, 8, 300))) {
    return { ok: false, error: "Too many requests. Please wait a moment and try again." };
  }

  const admin = createServiceClient();
  const { data: prop } = await admin
    .from("properties")
    .select("id, tenant_id, name, tenants(inquiry_auto_reply_enabled, inquiry_auto_reply)")
    .eq("slug", slug)
    .maybeSingle();
  if (!prop) return { ok: false, error: "We couldn't find that listing." };

  const { data: thread, error: tErr } = await admin
    .from("inquiry_threads")
    .insert({
      tenant_id: prop.tenant_id,
      property_id: prop.id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
    })
    .select("id, token")
    .single();
  if (tErr || !thread)
    return { ok: false, error: "Couldn't send your question. Please try again." };

  const { error: mErr } = await admin
    .from("inquiry_messages")
    .insert({ thread_id: thread.id, sender: "guest", body: message });
  if (mErr) return { ok: false, error: "Couldn't send your question. Please try again." };

  // Best-effort: nudge the operator that a question came in (never blocks the guest's submit).
  await notifyOperatorNewInquiry({
    tenantId: prop.tenant_id,
    propertyName: prop.name,
    guestName,
    body: message,
  });

  // S3 auto-acknowledge (on by default): post a system 'auto' message so the guest is never left
  // silent — the 'auto' sender does NOT clear the thread's "needs reply" (a human still must answer)
  // — and email the guest their tokenized thread link right away.
  if (prop.tenants?.inquiry_auto_reply_enabled) {
    const autoBody = prop.tenants.inquiry_auto_reply?.trim() || DEFAULT_AUTO_REPLY;
    await admin
      .from("inquiry_messages")
      .insert({ thread_id: thread.id, sender: "auto", body: autoBody });
    await notifyGuestInquiryReceived({
      guestEmail,
      propertyName: prop.name,
      token: thread.token,
      autoReplyBody: autoBody,
    });
  }

  return { ok: true };
}
