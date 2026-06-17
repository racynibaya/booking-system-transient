import { z } from "zod";

// Shared input schemas (architecture P5: validate once at the trust boundary).
// Used by the client form (zodResolver) AND the Server Action. Framework-free.
// No z.coerce / .default here: that splits a schema's input vs output types and
// breaks react-hook-form's generic. The form supplies typed values (checkbox →
// boolean, number inputs registered with valueAsNumber → number).

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

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
