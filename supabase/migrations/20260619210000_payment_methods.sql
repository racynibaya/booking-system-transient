-- F2.x — Payment-methods foundation. Generalize the single hardcoded GCash payout
-- (tenants.gcash_name/number/qr_path) into a per-operator SET of payment methods. Operator-as-
-- merchant, display + proof only — NO payment gateway (DESIGN D8); that's the later hotel slice.
-- The old tenants.gcash_* columns are KEPT this migration and dropped in a follow-up cleanup once
-- every reader/writer is repointed (branch-by-abstraction).

-- 1. Supported method types now: PH wallets + bank. (cash-on-arrival is intentionally NOT here —
--    it has no account to display/verify and no deposit; that's a separate booking-model decision.)
create type public.payment_method_type as enum ('gcash', 'maya', 'bank', 'grabpay');

-- 2. One operator (tenant) has many methods. account_name/number nullable at the DB level (the
--    form enforces what each type needs); qr_path lives in the public 'property-images' bucket,
--    same as gcash_qr_path today. bank_name only meaningful for type = 'bank'.
create table public.tenant_payment_methods (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  type           public.payment_method_type not null,
  account_name   text,
  account_number text,
  bank_name      text,
  qr_path        text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tenant_payment_methods_tenant_idx on public.tenant_payment_methods (tenant_id);

-- 3. RLS — operator CRUDs own rows (same idiom as the domain tables). Guests read via the
--    server-side service-role path in app/[slug]/actions.ts, never directly.
alter table public.tenant_payment_methods enable row level security;
create policy "tenant_payment_methods_select_own" on public.tenant_payment_methods for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "tenant_payment_methods_insert_own" on public.tenant_payment_methods for insert
  to authenticated with check (tenant_id = (select public.current_tenant_id()));
create policy "tenant_payment_methods_update_own" on public.tenant_payment_methods for update
  to authenticated using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy "tenant_payment_methods_delete_own" on public.tenant_payment_methods for delete
  to authenticated using (tenant_id = (select public.current_tenant_id()));
grant select, insert, update, delete on public.tenant_payment_methods to authenticated;
grant all on public.tenant_payment_methods to service_role;

-- 4. Backfill: each tenant with a GCash payout becomes one 'gcash' method. Runs BEFORE the
--    re-verify trigger is created (below) so the backfill itself never flags anyone. The
--    not-exists guard makes it idempotent — a re-run can never create duplicate gcash methods.
insert into public.tenant_payment_methods (tenant_id, type, account_name, account_number, qr_path)
select t.id, 'gcash', t.gcash_name, t.gcash_number, t.gcash_qr_path
from public.tenants t
where (t.gcash_name is not null or t.gcash_number is not null or t.gcash_qr_path is not null)
  and not exists (
    select 1 from public.tenant_payment_methods pm
    where pm.tenant_id = t.id and pm.type = 'gcash'
  );

-- 5. Re-verify flagging moves here from tenants.flag_gcash_change. When an APPROVED operator
--    adds/edits/removes a payout method, stamp tenants.gcash_changed_at (= "payout changed; the
--    public gate's 3-day grace + the admin alert kick in"). SECURITY DEFINER because operators
--    have no grant on gcash_changed_at. The old tenants trigger stays (harmless — gcash_* no longer
--    changes) and is dropped in the cleanup migration.
create or replace function public.flag_payout_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  update public.tenants
    set gcash_changed_at = now()
    where id = v_tenant and verification_status = 'approved';
  return coalesce(new, old);
end;
$$;

create trigger trg_flag_payout_change
  after insert or update or delete on public.tenant_payment_methods
  for each row execute function public.flag_payout_change();
