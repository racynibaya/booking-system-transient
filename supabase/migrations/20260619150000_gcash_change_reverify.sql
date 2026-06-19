-- F1.12 — Re-verify GCash changes. When an APPROVED operator changes their payout GCash, it's
-- flagged (gcash_changed_at). They stay live for a 24h grace window; if the admin hasn't re-verified
-- within 24h, the public gate hides them (down) until re-approved. Closes the "verify clean, then
-- swap the payout to a scammer account" hole. Enforced lazily at the gate — no cron.

alter table public.tenants add column gcash_changed_at timestamptz;

-- Auto-flag any payout change by a live operator. A BEFORE trigger so it can stamp gcash_changed_at
-- even though operators have no column grant on it (their settings update only touches gcash_*).
-- New/pending operators and admin status changes don't flag (old & new must both be approved).
create or replace function public.flag_gcash_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.verification_status = 'approved'
     and new.verification_status = 'approved'
     and (new.gcash_number is distinct from old.gcash_number
          or new.gcash_name is distinct from old.gcash_name
          or new.gcash_qr_path is distinct from old.gcash_qr_path) then
    new.gcash_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_flag_gcash_change
  before update on public.tenants
  for each row execute function public.flag_gcash_change();

-- Public gate — additionally hide an approved operator whose flagged GCash change has passed the 24h
-- grace window (not re-verified in time → down). Body otherwise identical to 20260619120000.
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
    and t.verification_status = 'approved'
    and (t.gcash_changed_at is null or t.gcash_changed_at > now() - interval '24 hours');
$$;

-- set_tenant_verification — any admin decision also resolves the GCash flag (clears gcash_changed_at).
drop function if exists public.set_tenant_verification(uuid, public.tenant_verification, text);
create or replace function public.set_tenant_verification(
  p_tenant_id uuid,
  p_status public.tenant_verification,
  p_note text default null
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
  update public.tenants
    set verification_status = p_status,
        verification_note = p_note,
        gcash_changed_at = null
    where id = p_tenant_id;
end;
$$;
grant execute on function public.set_tenant_verification(uuid, public.tenant_verification, text) to authenticated;
revoke execute on function public.set_tenant_verification(uuid, public.tenant_verification, text) from anon;

-- admin_list_operators — return gcash_changed_at; sort flagged operators up alongside pending.
drop function if exists public.admin_list_operators();
create or replace function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  verification_note text,
  gcash_changed_at timestamptz,
  gcash_name text,
  gcash_number text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, u.email::text, t.verification_status, t.verification_note,
         t.gcash_changed_at, t.gcash_name, t.gcash_number, t.created_at
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where public.is_current_user_admin()
  order by
    case
      when t.verification_status in ('pending', 'changes_requested') then 0
      when t.gcash_changed_at is not null then 0
      when t.verification_status = 'suspended' then 1
      else 2
    end,
    t.created_at desc;
$$;
grant execute on function public.admin_list_operators() to authenticated;
revoke execute on function public.admin_list_operators() from anon;
