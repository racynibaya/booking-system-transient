import { z } from "zod";

// Shared input schemas (architecture P5: validate once at the trust boundary).
// Used by the client form (zodResolver) AND the Server Action. Framework-free.
// No z.coerce / .default here: that splits a schema's input vs output types and
// breaks react-hook-form's generic. The form supplies typed values (checkbox →
// boolean, number inputs registered with valueAsNumber → number).

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// Optional URL field: a valid URL or empty string (the form sends "" when blank).
const optionalUrl = (max = 200) => z.url("Enter a valid URL").max(max).optional().or(z.literal(""));

// HTML <input type="time"> emits "HH:MM" (24h). Matches the `time` columns on properties.
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Invalid time");

export const propertyInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  // Optional: the Server Action derives a slug from the name when omitted.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
    .max(120)
    .optional()
    .or(z.literal("")),
  area: optionalText(60),
  address: optionalText(200),
  description: optionalText(2000),
  about: optionalText(2000),
  check_in_time: timeStr,
  check_out_time: timeStr,
  dot_accredited: z.boolean(),
  // Curated chips + free-text "Other". Free strings persisted to the jsonb column; bounded
  // to keep the public list sane. No .default() (see header note) — the form/action/page
  // all supply [] explicitly.
  amenities: z.array(z.string().trim().min(1).max(60)).max(40),
  // Per-property social links (optional URLs). Public by nature — surfaced on the listing.
  facebook_url: optionalUrl(),
  instagram_url: optionalUrl(),
  tiktok_url: optionalUrl(),
});
export type PropertyInput = z.infer<typeof propertyInput>;

// Operator GCash payout identity (tenant-level). Persisted on the tenants row; the QR image
// path is handled separately like the property cover image.
export const gcashInput = z.object({
  gcash_name: optionalText(80),
  gcash_number: optionalText(20),
});
export type GcashInput = z.infer<typeof gcashInput>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

// Half-open [start_date, end_date) — the end day is not blocked (matches bookings).
export const blockInput = z
  .object({
    start_date: dateStr,
    end_date: dateStr,
    reason: optionalText(120),
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });
export type BlockInput = z.infer<typeof blockInput>;

export const roomTypeInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  capacity: z.number().int().positive("Capacity must be at least 1"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  base_price: z.number().nonnegative("Price cannot be negative"),
  description: optionalText(2000),
});
export type RoomTypeInput = z.infer<typeof roomTypeInput>;

// Operator manual booking entry (F2.2). The same trust-boundary discipline as the
// public booking, plus a status the operator chooses: "confirmed" (walk-in / already
// arranged) or "held" (awaiting payment). propertyId only scopes the room dropdown in
// the form; the create_booking_hold RPC keys off roomTypeId.
export const manualBookingInput = z
  .object({
    propertyId: z.uuid(),
    roomTypeId: z.uuid(),
    checkIn: dateStr,
    checkOut: dateStr,
    numGuests: z.number().int().positive(),
    guestName: z.string().trim().min(1, "Guest name is required").max(120),
    guestPhone: optionalText(40),
    guestEmail: z.email().optional().or(z.literal("")),
    status: z.enum(["confirmed", "held"]),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });
export type ManualBookingInput = z.infer<typeof manualBookingInput>;
