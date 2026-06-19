-- F1.10 — Operator verification documents. Operators upload ID / business permit / property-proof
-- photos so the admin has real evidence to vet before approving (the gate decides *who* publishes;
-- these docs are *how* you decide). Sensitive (gov IDs) → PRIVATE bucket, tenant-scoped storage RLS,
-- admin views via short-lived service-role signed URLs. Mirrors the payment-proofs pattern
-- (20260617122600).

-- Private bucket. Path shape: {tenant_id}/{kind}.{ext}
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Operator may read/write only objects under their own tenant folder. (Admin reads via service-role,
-- which bypasses RLS — no admin policy needed here.)
create policy "verification_docs_tenant_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

create policy "verification_docs_tenant_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

create policy "verification_docs_tenant_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

create policy "verification_docs_tenant_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
  );

-- Which docs an operator has uploaded. One current file per (tenant, kind); re-upload replaces.
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('gov_id', 'business_permit', 'property_proof')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind)
);

alter table public.verification_documents enable row level security;

-- Operator manages only their own document rows. The WITH CHECK stops them inserting a row pointed
-- at another tenant. Admins read across tenants via the service-role server action, not this policy.
create policy "verification_documents_own"
  on public.verification_documents for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

grant select, insert, update, delete on public.verification_documents to authenticated;
-- service_role is not auto-granted on new tables in this project (same as tenants) — the admin
-- review path reads this table via the service-role client.
grant all on public.verification_documents to service_role;
