-- F1.9 — Operator verification gate (anti-scam). A new operator lands in `pending`; their public
-- listing stays dark until an admin approves it. `suspended` is the instant-takedown lever.
-- Existing operators are backfilled to `approved` so nothing live breaks. Admin-only, self-guarded
-- RPCs do the approving (admin identity = tenants.is_admin).

-- 1) Verification status + admin flag on the operator (tenant).
create type public.tenant_verification as enum ('pending', 'approved', 'suspended');

alter table public.tenants
  add column verification_status public.tenant_verification not null default 'pending',
  add column is_admin boolean not null default false;

-- Existing operators are trusted — approve them so their live listings keep resolving.
update public.tenants set verification_status = 'approved';

-- 2) Lock down which columns an operator may change on their OWN row. tenants_update_own still
-- scopes the row, but without this an operator could UPDATE their own verification_status='approved'
-- / is_admin=true and defeat the gate. Column-level grant = allowlist of the safe profile/payout
-- fields only (the app only ever updates these — settings/actions.ts).
revoke update on public.tenants from authenticated;
grant update (name, gcash_name, gcash_number, gcash_qr_path) on public.tenants to authenticated;

-- 3) Gate the public listing on the operator being approved. Body identical to 20260618150000
-- except the tenants join + approved filter. A pending/suspended operator's slug returns null →
-- the public page 404s.
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
      'about', p.about,
      'amenities', coalesce(p.amenities, '[]'::jsonb),
      'dot_accredited', p.dot_accredited,
      'facebook_url', p.facebook_url,
      'instagram_url', p.instagram_url,
      'tiktok_url', p.tiktok_url,
      'check_in_time', p.check_in_time,
      'check_out_time', p.check_out_time,
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
            'photos', rt.photos,
            'bookings', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('check_in', b.check_in, 'check_out', b.check_out)
                )
                from public.bookings b
                where b.room_type_id = rt.id
                  and b.status in ('held', 'awaiting_confirmation', 'confirmed')
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
  join public.tenants t on t.id = p.tenant_id
  where p.slug = p_slug
    and t.verification_status = 'approved';
$$;

-- 4) Admin-only operations. SECURITY DEFINER (must read across tenants + auth.users), but every
-- call is guarded by is_admin on the caller, so a normal operator can't approve anyone.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.tenants where user_id = (select auth.uid())), false);
$$;

create or replace function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  gcash_name text,
  gcash_number text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, u.email::text, t.verification_status, t.gcash_name, t.gcash_number, t.created_at
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where public.is_current_user_admin()
  order by
    case t.verification_status when 'pending' then 0 when 'suspended' then 1 else 2 end,
    t.created_at desc;
$$;

create or replace function public.set_tenant_verification(
  p_tenant_id uuid,
  p_status public.tenant_verification
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  update public.tenants set verification_status = p_status where id = p_tenant_id;
end;
$$;

-- The functions self-guard on is_admin, so authenticated may call them; anon never can.
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.admin_list_operators() to authenticated;
grant execute on function public.set_tenant_verification(uuid, public.tenant_verification) to authenticated;
revoke execute on function public.admin_list_operators() from anon;
revoke execute on function public.set_tenant_verification(uuid, public.tenant_verification) from anon;
