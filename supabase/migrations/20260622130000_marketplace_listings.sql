-- Marketplace (homepage discovery surface). One query returning card-level data for every
-- publicly-visible operator, so the browse grid doesn't fan out into N× get_public_listing.
--
-- The visibility predicate MUST stay byte-for-byte identical to get_public_listing's WHERE
-- clause (20260620140000_public_listing_accepts_online_payment.sql): a card the guest can see
-- here must resolve when they click through to /[slug]. If the two ever diverge, the grid
-- shows listings that 404 — keep them in lockstep.
--
-- Ordering is a stable-per-day shuffle (md5 of id+date) rather than alphabetical, so no operator
-- is permanently pinned to slot 1 vs the bottom of the grid. It re-rolls once per day.
-- Verified-owner-only is automatic: the approved filter already excludes pending/suspended.

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
      order by md5(p.id::text || current_date::text)
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
