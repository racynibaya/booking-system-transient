-- Xendit commission rail / Slice 1 step 6b — surface each operator's Xendit KYC status in the admin
-- review queue, so an admin can see who can actually accept online (kyc_status='LIVE') vs who is still
-- onboarding/suspended. Adds one nullable column (null = operator hasn't started Xendit onboarding).
--
-- Adding a column to a RETURNS TABLE changes the return type, which CREATE OR REPLACE can't do, so this
-- DROPs and recreates (and therefore re-applies the grants). Body is otherwise verbatim from the live
-- definition (verified via pg_get_functiondef — the migration files have drifted): same payment_methods
-- aggregate, same ordering, same is_admin self-guard.
drop function if exists public.admin_list_operators();

create function public.admin_list_operators()
returns table (
  tenant_id uuid,
  name text,
  email text,
  verification_status public.tenant_verification,
  verification_note text,
  gcash_changed_at timestamptz,
  payment_methods jsonb,
  xendit_kyc_status public.xendit_account_status,
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
                       'type', pa.method,
                       'account_name', pa.payout_name,
                       'account_number', pa.account_number,
                       'bank_name', pa.bank_name
                     )
                   )
            from public.tenant_payout_accounts pa
            where pa.tenant_id = t.id),
           '[]'::jsonb
         ) as payment_methods,
         (select xa.kyc_status from public.tenant_xendit_accounts xa where xa.tenant_id = t.id)
           as xendit_kyc_status,
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

-- Re-apply grants lost on drop (self-guarded on is_admin, so authenticated may call; anon never).
grant execute on function public.admin_list_operators() to authenticated;
revoke execute on function public.admin_list_operators() from anon;
