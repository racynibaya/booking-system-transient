-- Marketplace discovery becomes a PAID perk, and the tier boost becomes VISIBLE.
--
-- TWO CHANGES to list_public_listings() (the grid on app/page.tsx), nothing else:
--
--   1. DISCOVERY GATE (Solo+ perk): add `t.plan <> 'free'` to the visibility predicate. A Free
--      operator is no longer discoverable on the marketplace grid — but their own bookable page at
--      /[slug] still resolves, because that route uses get_public_listing(), which we DO NOT touch.
--      This is a DELIBERATE divergence from the "keep the visibility predicate byte-for-byte
--      identical to get_public_listing" note in 20260622140000: the grid is now a strict subset of
--      what resolves directly. The one-way invariant still holds — every card shown here resolves at
--      /[slug] — we've only made some resolvable pages absent from the grid. During the pilot every
--      adopter is Solo (20260624120000_pilot_default_solo.sql), so this empties nothing.
--
--   2. FEATURED FLAG (make the existing graded boost felt): emit `featured` per row so the card can
--      render a badge. featured = an actively-paying Pro/Business tenant (the tiers whose boost is
--      large enough to be worth surfacing). Solo is listed but not "featured". Gate matches the boost
--      gate exactly (status='active' AND paid_until>=today), so a row is featured iff it is actually
--      getting its ranking edge. Dormant during the pilot (everyone is trialing), lights up with billing.
--
-- The daily roll + graded per-tier bonus ordering is reproduced UNCHANGED from 20260622140000.

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
        ),
        -- visible badge for the boosted, actively-paying tiers (Pro/Business). Same gate as the boost.
        'featured', (
          t.subscription_status = 'active'
          and t.paid_until >= current_date
          and t.plan in ('pro', 'business')
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
    and t.plan <> 'free'  -- discovery is a paid perk; Free keeps only its own /[slug] page
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '3 days');
$$;

grant execute on function public.list_public_listings() to anon, authenticated;
