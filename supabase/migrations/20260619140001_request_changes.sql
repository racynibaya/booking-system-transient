-- F1.11b — "Request changes" review path. Instead of only approve/reject, the admin can bounce an
-- operator back with a reason (e.g. a blurry ID) — they stay in the funnel (changes_requested,
-- still dark) and re-upload. Option A: one free-text note per operator.

-- The admin's feedback. Cleared on approve/suspend (set_tenant_verification writes it every call).
alter table public.tenants add column verification_note text;

-- set_tenant_verification — widen to carry the note. approve/suspend omit it (→ null → clears);
-- request-changes passes the reason. Drop+recreate because the signature changes.
drop function if exists public.set_tenant_verification(uuid, public.tenant_verification);
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
        verification_note = p_note
    where id = p_tenant_id;
end;
$$;
grant execute on function public.set_tenant_verification(uuid, public.tenant_verification, text) to authenticated;
revoke execute on function public.set_tenant_verification(uuid, public.tenant_verification, text) from anon;

-- resubmit_verification — an operator who was sent back re-uploads, flipping themselves
-- changes_requested → pending so the admin re-reviews. Safe: only the caller's own tenant and only
-- that one transition (the column-grant lockdown still stops any other self-status change).
create or replace function public.resubmit_verification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tenants
    set verification_status = 'pending'
    where user_id = (select auth.uid())
      and verification_status = 'changes_requested';
end;
$$;
grant execute on function public.resubmit_verification() to authenticated;
revoke execute on function public.resubmit_verification() from anon;

-- admin_list_operators — return the note; sort changes_requested alongside pending (needs action).
drop function if exists public.admin_list_operators();
create or replace function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  verification_note text,
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
         t.gcash_name, t.gcash_number, t.created_at
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where public.is_current_user_admin()
  order by
    case t.verification_status
      when 'pending' then 0
      when 'changes_requested' then 0
      when 'suspended' then 1
      else 2
    end,
    t.created_at desc;
$$;
grant execute on function public.admin_list_operators() to authenticated;
revoke execute on function public.admin_list_operators() from anon;
