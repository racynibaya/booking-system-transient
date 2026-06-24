-- Pilot packaging: every adopter is SOLO, not Free.
--
-- WHY: during the pilot the tier ladder is functional/cosmetic only (charging is dormant), and we
-- want a uniformly-Solo pilot so (a) Solo has a real identity over the never-used Free tier and
-- (b) the marketplace stays populated once discovery is gated to paid tiers (plan <> 'free'). Free
-- is reserved as the POST-PILOT 1-room floor / downgrade target; no adopter sits on it during the
-- pilot. See context: tier perks packaging design.
--
-- TWO CHANGES, both intentionally NON-billing:
--   1. New signups default to 'solo'. handle_new_user() inserts (user_id, name) only and never sets
--      plan, so the column default governs every signup — flipping it here is the whole mechanism.
--   2. One-time backfill of existing Free operators to Solo. Admin tenants are left alone (they are
--      not operators on the grid). subscription_status / paid_until are deliberately UNTOUCHED so
--      these rows stay trialing/null: no charge, no false "active" state. The marketplace boost gate
--      requires status='active' AND paid_until>=today, so a pilot Solo tenant is LISTED but UNBOOSTED
--      until real billing turns on post-pilot — which is correct.

alter table public.tenants alter column plan set default 'solo';

update public.tenants
set plan = 'solo'
where plan = 'free'
  and not is_admin;
