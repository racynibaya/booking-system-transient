-- Live operator bookings board.
--
-- The /bookings board is server-rendered and only updates on a fresh request, so an operator
-- watching the screen doesn't see a new guest booking until they reload. Publish the bookings
-- table to Realtime so the client can subscribe to postgres_changes and refresh in place.
--
-- RLS is unchanged: Realtime evaluates the existing `bookings_select_own` policy
-- (tenant_id = current_tenant_id()) per subscriber, so an operator only ever receives their own
-- tenant's events. No new policy needed.

-- Add to the publication idempotently — prod migration history has drifted, so this must be safe
-- to re-run.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

-- REPLICA IDENTITY FULL so the old row is present on UPDATE/DELETE and RLS can be evaluated
-- against it. bookings is low-volume; the extra WAL per update is negligible.
alter table public.bookings replica identity full;
