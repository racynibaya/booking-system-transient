// PayMongo's fixed refund-reason enum. Lives in its own (non server-only) module so both the
// server refund client and client-side refund UI can import it without pulling in `server-only`.
export const REFUND_REASONS = [
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "others",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];
