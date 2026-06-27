"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/env";
import { notifyAdminsClawback } from "@/lib/email/gcash-alert";
import {
  createRefund,
  REFUND_REASONS,
  resolvePaymentId,
  toCentavos,
  type RefundReason,
} from "@/lib/paymongo/client";
import { getCurrentTenant } from "@/lib/supabase/dal";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type AdminResult = { ok: true } | { ok: false; error: string };

export type OperatorDoc = { kind: string; url: string };

// Load an operator's verification documents as short-lived signed URLs, for admin review. Gated on
// is_admin; uses the service-role client because the docs bucket is private + cross-tenant.
export async function getOperatorDocs(
  tenantId: string,
): Promise<{ ok: true; docs: OperatorDoc[] } | { ok: false; error: string }> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("verification_documents")
    .select("kind, storage_path")
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: "Couldn't load documents." };

  const docs: OperatorDoc[] = [];
  for (const d of data ?? []) {
    const { data: signed } = await admin.storage
      .from("verification-docs")
      .createSignedUrl(d.storage_path, 600); // 10 min
    if (signed?.signedUrl) docs.push({ kind: d.kind, url: signed.signedUrl });
  }

  // Surface the GCash QR from Settings (public bucket) so the admin can match the name on it
  // against the gov ID — it's the same account they get paid to, no separate upload needed.
  const { data: tenant } = await admin
    .from("tenants")
    .select("gcash_qr_path")
    .eq("id", tenantId)
    .single();
  if (tenant?.gcash_qr_path) {
    const url = admin.storage.from("property-images").getPublicUrl(tenant.gcash_qr_path)
      .data.publicUrl;
    docs.push({ kind: "gcash_qr", url });
  }

  // Put the gov ID and GCash QR next to each other — that's the name-match check.
  const ORDER: Record<string, number> = {
    gov_id: 0,
    gcash_qr: 1,
    business_permit: 2,
    property_proof: 3,
  };
  docs.sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));

  return { ok: true, docs };
}

export type OperatorListingRoom = {
  id: string;
  name: string;
  capacity: number;
  quantity: number;
  base_price: number;
  description: string | null;
  photo_urls: string[];
};

export type OperatorListing = {
  name: string;
  slug: string;
  area: string | null;
  address: string | null;
  description: string | null;
  about: string | null;
  amenities: string[];
  cover_url: string | null;
  photo_urls: string[];
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  rooms: OperatorListingRoom[];
};

// Load the property + rooms an operator created, for admin review BEFORE approval — a troll/malice
// check on the public-facing content (an unverified operator's listing is invisible everywhere else,
// since get_public_listing gates on verification_status='approved'). Gated on is_admin; uses the
// service-role client for the cross-tenant read. Images live in the public property-images bucket,
// so getPublicUrl is enough — no signed URLs (same bucket the public listing reads from).
export async function getOperatorListing(
  tenantId: string,
): Promise<{ ok: true; listing: OperatorListing | null } | { ok: false; error: string }> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const admin = createServiceClient();
  const { data: property, error } = await admin
    .from("properties")
    .select(
      "id, name, slug, area, address, description, about, amenities, cover_image_path, photos, facebook_url, instagram_url, tiktok_url",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't load the listing." };
  if (!property) return { ok: true, listing: null };

  const publicUrl = (path: string) =>
    admin.storage.from("property-images").getPublicUrl(path).data.publicUrl;

  const { data: rooms } = await admin
    .from("room_types")
    .select("id, name, capacity, quantity, base_price, description, photos")
    .eq("property_id", property.id)
    .order("created_at", { ascending: true });

  const listing: OperatorListing = {
    name: property.name,
    slug: property.slug,
    area: property.area,
    address: property.address,
    description: property.description,
    about: property.about,
    amenities: (property.amenities as string[] | null) ?? [],
    cover_url: property.cover_image_path ? publicUrl(property.cover_image_path) : null,
    photo_urls: ((property.photos as string[] | null) ?? []).map(publicUrl),
    facebook_url: property.facebook_url,
    instagram_url: property.instagram_url,
    tiktok_url: property.tiktok_url,
    rooms: (rooms ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      quantity: r.quantity,
      base_price: r.base_price,
      description: r.description,
      photo_urls: ((r.photos as string[] | null) ?? []).map(publicUrl),
    })),
  };

  return { ok: true, listing };
}

// Approve / suspend / re-queue an operator. The set_tenant_verification RPC also self-checks
// is_admin (defense in depth), but we gate here too so a non-admin never reaches it.
export async function setVerification(
  tenantId: string,
  status: "pending" | "approved" | "suspended",
): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_verification", {
    p_tenant_id: tenantId,
    p_status: status,
  });
  if (error) return { ok: false, error: "Couldn't update — please try again." };

  revalidatePath("/admin/operators");
  return { ok: true };
}

// Bounce an operator back with a reason instead of rejecting them (e.g. a blurry ID). They move to
// changes_requested (still dark), see the note, and re-upload — then it returns to pending.
export async function requestChanges(tenantId: string, note: string): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Add a short reason so they know what to fix." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_verification", {
    p_tenant_id: tenantId,
    p_status: "changes_requested",
    p_note: trimmed,
  });
  if (error) return { ok: false, error: "Couldn't send — please try again." };

  revalidatePath("/admin/operators");
  return { ok: true };
}

// Admin refunds a guest's centralized deposit from the platform wallet (Slice 6). The money-correctness
// shape mirrors the disbursement cron: the PayMongo call sits BETWEEN two atomic, status-guarded ledger
// steps (claim_refund → finish/abort_refund), so a booking is refunded at most once and a paid-out
// operator share is always recorded as a clawback. MONEY-ONLY — this does not cancel the booking or
// free inventory; the operator cancels separately. Admin-only (cross-tenant, platform-wallet debit).
//
// Read-only preview for the admin refund tool: resolve a booking id to the human details + the
// captured online amount, so the admin sees what they're about to refund before confirming. Does NOT
// touch money or status (unlike claim_refund). Admin-only.
export type RefundPreview = {
  bookingId: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  propertyName: string | null;
  capturedAmount: number | null; // the confirmed online deposit payment (what can be refunded)
  ledgerStatus: string | null; // payout_ledger.status, or null if not a centralized booking
  refundable: boolean;
  note: string; // why it can't be refunded, when refundable is false
};

const REFUNDABLE_LEDGER = new Set(["clearing", "payable", "paid"]);

export async function adminLookupBookingForRefund(
  bookingId: string,
): Promise<{ ok: true; preview: RefundPreview } | { ok: false; error: string }> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };
  if (!z.uuid().safeParse(bookingId).success)
    return { ok: false, error: "Enter a valid booking ID." };

  const admin = createServiceClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, guest_name, check_in, check_out, properties(name)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "No booking found for that ID." };

  const [{ data: payment }, { data: ledger }] = await Promise.all([
    admin
      .from("payments")
      .select("amount, provider_ref")
      .eq("booking_id", bookingId)
      .eq("kind", "deposit")
      .eq("status", "confirmed")
      .maybeSingle(),
    admin.from("payout_ledger").select("status").eq("booking_id", bookingId).maybeSingle(),
  ]);

  const property = booking.properties as { name: string | null } | null;
  const capturedAmount = payment?.amount == null ? null : Number(payment.amount);
  const ledgerStatus = ledger?.status ?? null;

  let refundable = true;
  let note = "";
  if (!ledgerStatus) {
    refundable = false;
    note = "Not an online (centralized) booking — nothing to refund here.";
  } else if (!REFUNDABLE_LEDGER.has(ledgerStatus)) {
    refundable = false;
    note = `Already ${ledgerStatus.replace("_", " ")}.`;
  } else if (!payment?.provider_ref || !capturedAmount || capturedAmount <= 0) {
    refundable = false;
    note = "No captured online payment reference to refund.";
  }

  return {
    ok: true,
    preview: {
      bookingId,
      guestName: booking.guest_name,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      propertyName: property?.name ?? null,
      capturedAmount,
      ledgerStatus,
      refundable,
      note,
    },
  };
}

// --- Per-owner payout rates (early-adopter discount) -------------------------------------------
// commission_rate / service_fee_rate live on tenant_payout_accounts (decimals, e.g. 0.05 = 5%).
// Operators can't edit their own (column-level grants); admins set them here to grant a reduced
// early-adopter rate. The rates feed computeBookingSplit on every booking.
export type PayoutRates = { commissionRate: number; serviceFeeRate: number } | null;

export async function adminGetPayoutRates(
  tenantId: string,
): Promise<{ ok: true; rates: PayoutRates } | { ok: false; error: string }> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };
  if (!z.uuid().safeParse(tenantId).success) return { ok: false, error: "Bad tenant." };

  const admin = createServiceClient();
  const { data } = await admin
    .from("tenant_payout_accounts")
    .select("commission_rate, service_fee_rate")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data) return { ok: true, rates: null }; // no payout account yet
  return {
    ok: true,
    rates: {
      commissionRate: Number(data.commission_rate),
      serviceFeeRate: Number(data.service_fee_rate),
    },
  };
}

// Rates are decimals in [0, 0.5] — a generous cap that still blocks fat-finger entries like "5"
// (=500%). The client converts the admin's percent input to a decimal before sending.
const rateInput = z.object({
  tenantId: z.uuid(),
  commissionRate: z.number().min(0).max(0.5),
  serviceFeeRate: z.number().min(0).max(0.5),
});

export async function adminSetPayoutRate(input: {
  tenantId: string;
  commissionRate: number;
  serviceFeeRate: number;
}): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const parsed = rateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Rates must be between 0% and 50%." };
  const { tenantId, commissionRate, serviceFeeRate } = parsed.data;

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("tenant_payout_accounts")
    .update({ commission_rate: commissionRate, service_fee_rate: serviceFeeRate })
    .eq("tenant_id", tenantId)
    .select("tenant_id")
    .maybeSingle();

  if (error) return { ok: false, error: "Couldn't update the rate. Please try again." };
  if (!data)
    return {
      ok: false,
      error:
        "This operator has no payout account yet — they set one up in Settings → Get paid first.",
    };

  revalidatePath("/admin/operators");
  return { ok: true };
}

// `amountPesos` omitted = full refund of the captured guest charge; a partial must be ≤ that charge.
const refundInput = z.object({
  bookingId: z.uuid(),
  reason: z.enum(REFUND_REASONS),
  amountPesos: z.number().positive().optional(),
});

export async function refundBooking(input: {
  bookingId: string;
  reason: RefundReason;
  amountPesos?: number;
}): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const parsed = refundInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the refund details." };
  const { bookingId, reason, amountPesos } = parsed.data;

  const sk = env.PAYMONGO_PLATFORM_SECRET_KEY;
  if (!sk) return { ok: false, error: "Refunds aren't available on this deployment." };

  const admin = createServiceClient();

  // Reserve the accrual into 'refunding'. An empty result = no centralized accrual, or it's already
  // refunding/refunded/clawed_back/failed — nothing to do, and we haven't touched money.
  const { data: claims, error: claimErr } = await admin.rpc("claim_refund", {
    p_booking_id: bookingId,
  });
  if (claimErr) return { ok: false, error: "Couldn't start the refund. Please try again." };
  const claim = claims?.[0];
  if (!claim) return { ok: false, error: "This booking has no refundable payment." };

  const priorStatus = claim.prior_status;
  const captured = claim.paid_amount == null ? null : Number(claim.paid_amount);

  // Restore the reservation and bail — used whenever we can't complete the PayMongo refund.
  const abort = async (msg: string): Promise<AdminResult> => {
    await admin.rpc("abort_refund", { p_booking_id: bookingId, p_restore_status: priorStatus });
    return { ok: false, error: msg };
  };

  if (!claim.provider_ref) return abort("No online payment reference on this booking to refund.");
  if (captured == null || captured <= 0) return abort("No captured amount to refund.");

  // Default to a full refund of the captured charge; a partial may not exceed it.
  const refundPesos = amountPesos ?? captured;
  if (refundPesos > captured) return abort("Refund can't exceed what the guest paid.");

  let refundRef: string;
  try {
    const paymentId = await resolvePaymentId(sk, claim.provider_ref);
    const refund = await createRefund({
      secretKey: sk,
      paymentId,
      amountCentavos: toCentavos(refundPesos),
      reason,
      notes: `Tuloy refund (booking ${bookingId})`,
      metadata: { booking_id: bookingId, tenant_id: claim.tenant_id },
    });
    refundRef = refund.id;
  } catch (e) {
    return abort(e instanceof Error ? e.message.slice(0, 300) : "Refund failed at PayMongo.");
  }

  // 'payable' is the in-flight transient between claim_due_payouts and mark_payout_paid (F3) — treat
  // it like 'paid': the disbursement may already be out, so record a clawback rather than eat it.
  const clawback = priorStatus === "paid" || priorStatus === "payable";
  await admin.rpc("finish_refund", {
    p_booking_id: bookingId,
    p_refund_ref: refundRef,
    p_amount: refundPesos,
    p_clawback: clawback,
  });

  if (clawback) {
    // Recover the operator's already-paid share by hand (v1) — ping admins with the figure.
    const { data: row } = await admin
      .from("payout_ledger")
      .select("owner_payout")
      .eq("booking_id", bookingId)
      .single();
    const { data: prop } = await admin
      .from("properties")
      .select("name")
      .eq("tenant_id", claim.tenant_id)
      .limit(1)
      .maybeSingle();
    await notifyAdminsClawback({
      bookingId,
      operatorName: prop?.name ?? null,
      owedAmount: row?.owner_payout == null ? 0 : Number(row.owner_payout),
    });
  }

  revalidatePath("/admin/operators");
  return { ok: true };
}
