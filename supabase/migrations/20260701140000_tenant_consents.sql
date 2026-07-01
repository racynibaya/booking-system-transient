-- Slice A — consent/legal audit layer. An immutable record of each operator's acceptance of the
-- Terms / operator agreement (clickwrap), for the Data Privacy Act + enforceability requirement
-- (context/legal-content.md §4): capture who + when + IP + user-agent + the terms version shown.
--
-- Immutable audit record: mirrors the `payments` idiom (domain_schema.sql:169-177) — operator reads
-- + inserts own rows, NO update/delete grant, so a written consent can never be altered or erased.

create type public.consent_context as enum (
  'operator_signup',     -- accepted at account signup (F1 — wired via service-role, no session yet)
  'operator_agreement',  -- accepted the operator agreement (currently the Xendit KYC tos_accepted)
  'operator_listing'     -- second opt-in at first listing creation (lawyer's two-step clickwrap)
);

create table public.tenant_consents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  context       public.consent_context not null,
  terms_version text not null,
  ip            text,
  user_agent    text,
  accepted_at   timestamptz not null default now()
);

create index on public.tenant_consents (tenant_id);

-- RLS — same operator-scoping idiom as the rest of the schema; immutable like `payments`
-- (select + insert only, no update/delete grant to authenticated).
alter table public.tenant_consents enable row level security;
create policy "tenant_consents_select_own" on public.tenant_consents for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "tenant_consents_insert_own" on public.tenant_consents for insert
  to authenticated with check (tenant_id = (select public.current_tenant_id()));
grant select, insert on public.tenant_consents to authenticated;
grant all on public.tenant_consents to service_role;
