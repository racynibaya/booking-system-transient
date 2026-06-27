-- Slice 7 cutover (commission-only): flatten the marketplace grid — remove all subscription-tier
-- wiring from list_public_listings.
--
-- WHY: with subscription gone there are no tiers to rank by and no "paid discovery" perk. The grid
-- becomes the plain daily reshuffle over every approved, non-admin, gcash-fresh host:
--   * drop the tenant_subscription_entitlement join + e.can_accept_bookings predicate.
--   * drop the t.plan <> 'free' discovery gate → every approved host is discoverable.
--   * drop the graded per-tier ranking bonus → ordering is the pure daily pseudo-random roll.
--   * drop the `featured` flag (a paid-tier badge) → app/page.tsx + listing-card drop it too.
-- get_public_listing already carries no entitlement reference (superseded by 20260626160100), so it is
-- intentionally NOT touched here. This removes the last reader of tenant_subscription_entitlement,
-- clearing the way for Slice C to drop that view + billing_config.

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
      -- plain daily reshuffle: stable-per-day pseudo-random roll keyed on (id + current_date). No tier
      -- edge anymore — every listing competes on the same uniform roll.
      order by
        (('x' || substr(md5(p.id::text || current_date::text), 1, 7))::bit(28)::int)::float8 / 268435456.0
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
