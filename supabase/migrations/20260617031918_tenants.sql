-- F0.1 — Auth + tenant-isolation seam (M0).
-- One operator = one Supabase Auth user = one tenants row (decision B3).
-- Isolation is a database guarantee via RLS, not an app convention (architecture P2):
-- "a leak here is a breach, not a bug."

-- ---------------------------------------------------------------------------
-- tenants: the operator account, keyed 1:1 to an auth user.
-- ---------------------------------------------------------------------------
create table public.tenants (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users (id) on delete cascade,
  name                text,
  subscription_status text not null default 'trialing',
  created_at          timestamptz not null default now()
);

alter table public.tenants enable row level security;

-- RLS restricts which ROWS are visible; a GRANT is what makes the table reachable
-- at all via the Data API. Grant the operator role table access (rows are then
-- scoped by the policies below). anon is intentionally NOT granted — guests never
-- touch tenants. No insert/delete grant: rows are trigger-provisioned only.
grant select, update on public.tenants to authenticated;
-- service_role is the trusted server-side/admin role (bypasses RLS); give it full
-- table access for backend operations. Hosted Supabase grants this by default;
-- stated explicitly so local and any fresh database match.
grant all on public.tenants to service_role;

-- An operator may read only their own tenant row. The predicate checks
-- auth.uid() = user_id DIRECTLY (not via current_tenant_id(), which selects from
-- this same table and would recurse). (select auth.uid()) is wrapped so the
-- planner evaluates it once per statement.
create policy "tenants_select_own"
  on public.tenants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- An operator may update only their own row, and may not reassign it to another
-- user (WITH CHECK guards the post-update state).
create policy "tenants_update_own"
  on public.tenants
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No INSERT/DELETE policy by design: rows are provisioned only by the signup
-- trigger below, and removed only via the auth.users ON DELETE CASCADE.

-- ---------------------------------------------------------------------------
-- current_tenant_id(): resolve the calling operator to their tenant id.
-- Exists for F0.2 child tables (properties, room_types, bookings, ...) to scope
-- their RLS by tenant_id. SECURITY INVOKER, so reading public.tenants is itself
-- subject to tenants_select_own above and can only ever return the caller's row.
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.tenants where user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user(): provision the tenants row atomically on signup (B6), so an
-- auth user never exists without a tenant. SECURITY DEFINER to bypass RLS for
-- the insert; hardened with an empty search_path and schema-qualified names.
-- NOTE: if this function raises, the signup itself fails — keep it minimal.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenants (user_id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

-- handle_new_user is a trigger function, not an API endpoint. Postgres grants
-- EXECUTE to PUBLIC by default, which would expose a SECURITY DEFINER function at
-- /rest/v1/rpc/. Revoke so the API roles can't call it directly; the trigger
-- still fires (trigger execution does not require EXECUTE on the function).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
