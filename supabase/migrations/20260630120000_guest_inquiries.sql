-- M2 — Guest inquiries. A guest asks a question from a public listing (no account); it lands in
-- the operator's in-app Inbox. The guest later reads/continues the conversation on a tokenized,
-- no-login thread page. Guest-side reads/writes go through the server-side service-role path
-- (app actions validate the token), the same idiom as the guest deposit proof; operators access
-- their own threads via RLS. In-app only — no Messenger/SMS bridge (operator decision).

-- One thread per guest question, scoped to the operator (tenant) and the listing asked about.
-- `token` is the guest's unguessable handle to the thread (no account). `awaiting_operator` and
-- `last_message_at` are denormalized for the inbox list + the dashboard "unanswered" signal; a
-- trigger keeps them correct no matter which side inserts.
create table public.inquiry_threads (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,
  guest_name        text not null,
  guest_email       text not null,
  guest_phone       text,
  token             text not null unique default replace(gen_random_uuid()::text, '-', ''),
  awaiting_operator boolean not null default true,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index inquiry_threads_tenant_idx on public.inquiry_threads (tenant_id, last_message_at desc);

create table public.inquiry_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.inquiry_threads(id) on delete cascade,
  sender     text not null check (sender in ('guest', 'operator')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index inquiry_messages_thread_idx on public.inquiry_messages (thread_id, created_at);

-- Keep the thread's denorm fields correct regardless of who inserts (service-role guest path or
-- RLS operator path): a guest message means "awaiting operator", an operator reply clears it.
create or replace function public.bump_inquiry_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiry_threads
    set last_message_at = new.created_at,
        awaiting_operator = (new.sender = 'guest')
    where id = new.thread_id;
  return new;
end;
$$;
create trigger inquiry_messages_bump
  after insert on public.inquiry_messages
  for each row execute function public.bump_inquiry_thread();

-- RLS — operators read/update their own threads and read/insert messages on them. Guests never
-- touch these tables directly; the public form + thread page use the service-role path.
alter table public.inquiry_threads enable row level security;
alter table public.inquiry_messages enable row level security;

create policy "inquiry_threads_select_own" on public.inquiry_threads for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));
create policy "inquiry_threads_update_own" on public.inquiry_threads for update
  to authenticated using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

create policy "inquiry_messages_select_own" on public.inquiry_messages for select
  to authenticated using (
    exists (
      select 1 from public.inquiry_threads t
      where t.id = thread_id and t.tenant_id = (select public.current_tenant_id())
    )
  );
create policy "inquiry_messages_insert_own" on public.inquiry_messages for insert
  to authenticated with check (
    exists (
      select 1 from public.inquiry_threads t
      where t.id = thread_id and t.tenant_id = (select public.current_tenant_id())
    )
  );

grant select, update on public.inquiry_threads to authenticated;
grant select, insert on public.inquiry_messages to authenticated;
grant all on public.inquiry_threads to service_role;
grant all on public.inquiry_messages to service_role;
