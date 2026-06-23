-- Booking attribution (source).
--
-- Operators can't feel value they can't see. When the founder does manual demand-gen — posting an
-- operator's room into traveler FB groups with a tagged link (?src=tuloy) — bookings from that link
-- must arrive *announcing* that Tuloy drove them (dashboard badge + operator email), so the effort is
-- visible and the subscription feels earned.
--
-- Nullable; null = organic / the operator's own share link. Set best-effort by the public booking
-- action AFTER the atomic hold (create_booking_hold — the money-critical path — stays untouched).
-- Pure metadata, no behavior change to availability or money.
alter table public.bookings
  add column source text;

comment on column public.bookings.source is
  'Attribution tag from the booking link (?src=…), e.g. ''tuloy'' for founder-driven demand-gen. Null = organic / operator''s own share.';
