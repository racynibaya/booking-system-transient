-- F2.1: let the operator attach a reason when cancelling a booking.
-- Nullable free-text — most cancellations have no note, and historical rows have none.
-- Written by cancelBooking under the existing bookings_update_own RLS policy (no new grant
-- needed: it's the operator updating their own tenant's row), surfaced to the guest in the
-- cancellation email and kept as a record for disputes.
alter table public.bookings
  add column cancellation_reason text;
