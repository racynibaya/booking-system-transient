-- Phase A — admin billing visibility. The in-app answer to "how do we keep it in track": a single
-- self-guarded aggregate the /admin dashboard reads to surface who's paying, who renews soon, and who
-- has lapsed — so a silent non-payer shows up on a screen instead of being remembered (or not).
--
-- Same trust pattern as the other admin RPCs: SECURITY DEFINER to read across tenants, self-guarded
-- by is_current_user_admin() (a normal operator gets null), granted to authenticated, revoked from
-- anon. overdue_list carries just enough to chase (name, plan, lapse date) — no secrets.
create or replace function public.admin_billing_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_current_user_admin() then null
    else jsonb_build_object(
      'paying', (select count(*) from public.tenants where subscription_status = 'active'),
      'due_soon', (select count(*) from public.tenants
        where subscription_status = 'active'
          and paid_until is not null
          and paid_until <= current_date + 3),
      'past_due', (select count(*) from public.tenants where subscription_status = 'past_due'),
      'overdue_list', coalesce((
        select jsonb_agg(
          jsonb_build_object('name', name, 'plan', plan, 'paid_until', paid_until)
          order by paid_until asc nulls last)
        from public.tenants
        where subscription_status = 'past_due'
      ), '[]'::jsonb)
    )
  end;
$$;

revoke execute on function public.admin_billing_health() from anon;
grant execute on function public.admin_billing_health() to authenticated;
