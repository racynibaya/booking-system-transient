-- F2.x — Surface each operator's payout METHODS to the admin review queue. Operators now edit
-- payout via tenant_payment_methods (tenants.gcash_name/number are frozen), so the anti-scam
-- ID-match must read the methods. admin_list_operators returns a payment_methods jsonb array
-- (replacing the scalar gcash_name/gcash_number). The is_admin exclusion + queue ordering from
-- 20260619200000 are preserved.
drop function if exists public.admin_list_operators();
create or replace function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  verification_note text,
  gcash_changed_at timestamptz,
  payment_methods jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, u.email::text, t.verification_status, t.verification_note,
         t.gcash_changed_at,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'type', pm.type,
                       'account_name', pm.account_name,
                       'account_number', pm.account_number,
                       'bank_name', pm.bank_name
                     )
                     order by pm.sort_order, pm.created_at
                   )
            from public.tenant_payment_methods pm
            where pm.tenant_id = t.id),
           '[]'::jsonb
         ) as payment_methods,
         t.created_at
  from public.tenants t
  join auth.users u on u.id = t.user_id
  where public.is_current_user_admin() and not t.is_admin
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
