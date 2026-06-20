-- Phase 2a hardening — prevent double-charging a guest via the PayMongo gateway.
--
-- The bug: createGatewayCheckout (app/[slug]/actions.ts) minted a brand-new hosted Checkout
-- Session on EVERY call while the booking sat in 'held'. A guest who double-clicked Pay, refreshed
-- the redirect, or opened two tabs got two distinct sessions → two real charges. The confirm RPC's
-- idempotency protected our DB (one deposit row) but could not un-charge the card, and the second
-- payment's webhook landed on an already-'confirmed' booking as a silent no-op — invisible.
--
-- The fix: remember the open session on the booking so repeat calls hand back the SAME single-use
-- session URL instead of creating another. A PayMongo checkout session can only be paid once, so
-- reusing it makes the common double-click/refresh/two-tab case impossible to double-charge.
--
-- Nullable, no backfill: existing bookings have no open session; the column fills on first checkout.

alter table public.bookings
  add column if not exists gateway_checkout_url text;
