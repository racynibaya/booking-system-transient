-- F1.3 — Public per-operator booking page: cover image storage + anonymous read path.

-- ---------------------------------------------------------------------------
-- Cover image (the public booking page's full-bleed background).
-- ---------------------------------------------------------------------------
alter table public.properties add column cover_image_path text;

-- ---------------------------------------------------------------------------
-- Storage: a PUBLIC bucket for property images (booking-page backgrounds are
-- meant to be seen). Writes are scoped to the operator's tenant by path:
-- objects live under `{tenant_id}/…`, enforced by RLS on storage.objects.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

create policy "property_images_public_read"
  on storage.objects for select
  using (bucket_id = 'property-images');

create policy "property_images_tenant_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

create policy "property_images_tenant_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

create policy "property_images_tenant_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

-- ---------------------------------------------------------------------------
-- get_public_listing(slug): the anonymous read path (architecture P2). SECURITY
-- DEFINER + hardened, so it can read across RLS but returns ONLY public-safe
-- fields for the one matching property — bookings as DATE RANGES ONLY (no guest
-- PII). Returns null when the slug doesn't exist (→ the page 404s).
-- ---------------------------------------------------------------------------
create or replace function public.get_public_listing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'property', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'area', p.area,
      'address', p.address,
      'description', p.description,
      'cover_image_path', p.cover_image_path
    ),
    'room_types', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rt.id,
            'name', rt.name,
            'capacity', rt.capacity,
            'quantity', rt.quantity,
            'base_price', rt.base_price,
            'description', rt.description,
            'bookings', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('check_in', b.check_in, 'check_out', b.check_out)
                )
                from public.bookings b
                where b.room_type_id = rt.id
                  and b.status in ('held', 'confirmed')
                  and (b.hold_expires_at is null or b.hold_expires_at > now())
                  and b.check_out >= current_date
              ),
              '[]'::jsonb
            ),
            'blocks', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('start_date', ab.start_date, 'end_date', ab.end_date)
                )
                from public.availability_blocks ab
                where ab.room_type_id = rt.id
                  and ab.end_date >= current_date
              ),
              '[]'::jsonb
            )
          )
          order by rt.created_at
        )
        from public.room_types rt
        where rt.property_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from public.properties p
  where p.slug = p_slug;
$$;

revoke execute on function public.get_public_listing(text) from public;
grant execute on function public.get_public_listing(text) to anon, authenticated;

-- Public booking page (anon guests) calls the existing engine. It already validates
-- everything in-body (room, capacity, dates, blocks, quantity), so anon is safe.
grant execute on function public.create_booking_hold(
  uuid, date, date, integer, text, text, text, integer
) to anon;
