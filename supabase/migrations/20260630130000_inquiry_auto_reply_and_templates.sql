-- S3 — auto-acknowledge + quick-reply templates. Adds an 'auto' message sender (a system ack that
-- reassures the guest WITHOUT clearing "needs reply"), per-operator auto-reply config, and saved
-- reply templates. Builds on 20260630120000_guest_inquiries.sql.

-- 1. Allow an 'auto' sender alongside guest/operator (the inline check is named *_sender_check).
alter table public.inquiry_messages drop constraint inquiry_messages_sender_check;
alter table public.inquiry_messages
  add constraint inquiry_messages_sender_check check (sender in ('guest', 'operator', 'auto'));

-- 2. The trap fix: an 'auto' message must NOT mark the thread handled. CASE so only a real operator
--    reply clears awaiting_operator; 'auto' (and any future system sender) leaves it untouched, so the
--    inquiry stays on the operator's "needs reply" list until a human answers.
create or replace function public.bump_inquiry_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiry_threads
    set last_message_at = new.created_at,
        awaiting_operator = case
          when new.sender = 'guest' then true
          when new.sender = 'operator' then false
          else awaiting_operator
        end
    where id = new.thread_id;
  return new;
end;
$$;

-- 3. Per-operator auto-reply config. On by default (zero setup); null text = use the app default copy.
--    Extend the column allowlist (operator_verification revoked table-wide UPDATE) so the operator can
--    set these on their own row via tenants_update_own RLS.
alter table public.tenants
  add column inquiry_auto_reply_enabled boolean not null default true,
  add column inquiry_auto_reply text;
grant update (inquiry_auto_reply_enabled, inquiry_auto_reply) on public.tenants to authenticated;

-- 4. Saved reply templates (per tenant). Same RLS idiom as tenant_payment_methods.
create table public.inquiry_templates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  title      text not null,
  body       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index inquiry_templates_tenant_idx on public.inquiry_templates (tenant_id, sort_order);

alter table public.inquiry_templates enable row level security;
create policy "inquiry_templates_select_own" on public.inquiry_templates for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "inquiry_templates_insert_own" on public.inquiry_templates for insert
  to authenticated with check (tenant_id = (select public.current_tenant_id()));
create policy "inquiry_templates_update_own" on public.inquiry_templates for update
  to authenticated using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy "inquiry_templates_delete_own" on public.inquiry_templates for delete
  to authenticated using (tenant_id = (select public.current_tenant_id()));
grant select, insert, update, delete on public.inquiry_templates to authenticated;
grant all on public.inquiry_templates to service_role;
