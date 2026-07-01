"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenant } from "@/lib/supabase/dal";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createRefund, type RefundReason } from "@/lib/xendit/client";
import { env } from "@/env";

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

// --- Refund shell (Slice 3, OWNED) -------------------------------------------------------------
//
// Refund an online (Xendit) booking, drawn from the OPERATOR'S sub-account (createRefund, `for-user-id`)
// — counsel's rule that Tuloy never fronts refund money. INSUFFICIENT_BALANCE (operator already
// withdrew) → suspend their online-pay + flag for recovery from future settlements (D3).
//
// 🚧 TODO(split-refund): this refunds the FULL captured amount from the operator's sub-account, which
// leaves the operator bearing Tuloy's 2.5% commission (it went to the Master, not them). Whether/how to
// return our Master-side commission depends on Xendit's UNANSWERED split-vs-refund behavior (does a
// refund reverse the split?). Do NOT ship to real money until the AM confirms; see
// context/xendit-questions.md Q3. Admin-gated; the operator-facing refund UI was removed with the
// aggregator and is rebuilt when this unblocks.
export async function refundXenditBooking(
  bookingId: string,
  reason: RefundReason = "REQUESTED_BY_CUSTOMER",
): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Refunds aren't available on this deployment." };

  const admin = createServiceClient();

  // The original Xendit charge: amount + the payment_request_id the refund keys off (stored in the
  // confirm event's raw_payload by the session webhook).
  const { data: payment } = await admin
    .from("payments")
    .select("tenant_id, amount, raw_payload, status")
    .eq("booking_id", bookingId)
    .eq("provider", "xendit")
    .eq("status", "confirmed")
    .maybeSingle();
  if (!payment) return { ok: false, error: "No online payment found for this booking." };

  const raw = payment.raw_payload as { data?: { payment_request_id?: string } } | null;
  const paymentRequestId = raw?.data?.payment_request_id;
  if (!paymentRequestId)
    return { ok: false, error: "Missing the Xendit payment reference to refund." };

  const { data: xa } = await admin
    .from("tenant_xendit_accounts")
    .select("id, sub_account_id")
    .eq("tenant_id", payment.tenant_id)
    .maybeSingle();
  if (!xa) return { ok: false, error: "Operator has no Xendit account." };

  let failureCode: string | null = null;
  try {
    const refund = await createRefund({
      secretKey: sk,
      forUserId: xa.sub_account_id,
      paymentRequestId,
      amount: Number(payment.amount), // TODO(split-refund): full captured amount; commission-return pending
      reason,
      referenceId: `rf-${bookingId}`,
    });
    failureCode = refund.failureCode;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Refund failed." };
  }

  // Empty sub-account (operator already withdrew) → suspend their online-pay and flag for recovery (D3).
  if (failureCode === "INSUFFICIENT_BALANCE") {
    await admin
      .from("tenant_xendit_accounts")
      .update({ kyc_status: "SUSPENDED", updated_at: new Date().toISOString() })
      .eq("id", xa.id);
    console.error(
      `[xendit] refund INSUFFICIENT_BALANCE booking=${bookingId} tenant=${payment.tenant_id} — suspended; recover from future settlements`,
    );
    return {
      ok: false,
      error: "Operator's balance is empty — they've been suspended; recover manually.",
    };
  }

  return { ok: true };
}
