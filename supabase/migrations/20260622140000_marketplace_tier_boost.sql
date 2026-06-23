-- Marketplace ranking: give actively-paying operators a soft, GRADED edge in the grid by tier,
-- WITHOUT breaking the daily-reshuffle fairness from 20260622130000_marketplace_listings.sql.
--
-- HOW THE WEIGHTING WORKS
-- Each listing still gets the same stable-per-day pseudo-random roll keyed on (id + current_date),
-- normalized into a float in [0, 1):
--     roll = bits(md5(id || current_date)) / 2^28      -- uniform, re-rolls once per day
-- We then SUBTRACT a per-tier bonus and sort ascending (lower sorts first):
--     order by  roll - tier_bonus
-- A higher bonus shifts a listing's roll further down, so it lands earlier ON AVERAGE — but a
-- lower-tier (or free) listing that rolls below (other_roll - their_bonus) still beats it. So the
-- edge is real but SOFT: higher tiers are favored, nobody is permanently pinned to slot 1, and the
-- order still re-shuffles every day.
--
-- GRADED TIER BONUS (tunable — this block IS the ranking policy):
--     business 0.30  >  pro 0.15  >  solo 0.05  >  free 0
-- The strict ordering of the constants guarantees business > pro > solo on edge magnitude (at equal
-- rolls they sort in exactly that order). Free gets no boost. NOTE: the `free` tier is RETAINED
-- post-pilot as a 1-room tier (roomCap drops 4 -> 1 after the pilot); it still gets bonus 0 here.
-- To retune, just change the constants; to add a tier, add a branch.
--
-- GATE: only an ACTIVELY-PAYING operator gets any edge — applies to ALL paid tiers equally.
-- subscription_status lifecycle is trialing -> active -> past_due -> cancelled (see
-- 20260621100000_subscription_billing.sql / _past_due / _downgrade). A stale, overdue, or cancelled
-- paid row must NOT get its boost, so we require BOTH:
--     subscription_status = 'active'      -- currently paying (not trialing/past_due/cancelled)
--     paid_until >= current_date          -- belt-and-suspenders vs. cron lag flipping active->past_due
-- A non-qualifying tenant (any tier) simply gets bonus 0 and falls back to the plain daily shuffle.
--
-- The 28-bit slice (7 hex chars) keeps the int cast safely non-negative (max 2^28-1), avoiding the
-- signed-overflow foot-gun of casting a full 32-bit hex to int4.
--
-- VISIBILITY PREDICATE: kept byte-for-byte identical to the prior version (and to
-- get_public_listing). A card shown here must resolve at /[slug] — do not let these diverge.

create or replace function public.list_public_listings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'area', p.area,
        'cover_image_path', p.cover_image_path,
        'from_price', (
          select min(rt.base_price)
          from public.room_types rt
          where rt.property_id = p.id
        )
      )
      order by
        -- daily pseudo-random roll in [0, 1)
        (('x' || substr(md5(p.id::text || current_date::text), 1, 7))::bit(28)::int)::float8 / 268435456.0
        -- minus the graded per-tier bonus (the edge); only granted to an actively-paying tier
        - (case
             when t.subscription_status = 'active' and t.paid_until >= current_date then
               case t.plan
                 when 'business' then 0.30
                 when 'pro'      then 0.15
                 when 'solo'     then 0.05
                 else 0  -- free (retained post-pilot as a 1-room tier) / unknown
               end
             else 0
           end)
    ),
    '[]'::jsonb
  )
  from public.properties p
  join public.tenants t on t.id = p.tenant_id
  where t.verification_status = 'approved'
    and not t.is_admin
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;

grant execute on function public.list_public_listings() to anon, authenticated;
