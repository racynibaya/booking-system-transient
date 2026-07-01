-- Guest consent (the Part A clickwrap). Guests are anonymous — not tenants — so their acceptance of
-- the Terms is recorded on the booking itself (who = the booking's guest, when = created_at, version
-- = this column). Stamped best-effort AFTER create_booking_hold, exactly like bookings.source, so the
-- atomic no-double-booking RPC (P1) stays untouched.
alter table public.bookings add column if not exists terms_version text;
