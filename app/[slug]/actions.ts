"use server";

import { z } from "zod";

import { createAnonClient, createServiceClient } from "@/lib/supabase/server";

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

export type GcashDetails = {
  name: string | null;
  number: string | null;
  qrUrl: string | null;
};

export type BookingResult =
  | {
      ok: true;
      bookingId: string;
      holdExpiresAt: string | null;
      total: number | null;
      deposit: number | null;
      gcash: GcashDetails;
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
    p_guest_email: d.guestEmail || undefined,
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

  // GCash is delivered WITH the hold (never via the public listing — anti-scrape). anon has
  // no grant on tenants, so read it through the service-role client.
  const gcash = await getGcashDetails(booking.tenant_id);

  return {
    ok: true,
    bookingId: booking.id,
    holdExpiresAt: booking.hold_expires_at,
    total: booking.total_amount,
    deposit: booking.deposit_amount,
    gcash,
  };
}

async function getGcashDetails(tenantId: string): Promise<GcashDetails> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("tenants")
    .select("gcash_name, gcash_number, gcash_qr_path")
    .eq("id", tenantId)
    .single();

  const qrUrl = data?.gcash_qr_path
    ? admin.storage.from("property-images").getPublicUrl(data.gcash_qr_path).data.publicUrl
    : null;

  return { name: data?.gcash_name ?? null, number: data?.gcash_number ?? null, qrUrl };
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
