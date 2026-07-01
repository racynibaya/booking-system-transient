-- Rate limiting (M2 of the 2026-07 security diagnostic) — Postgres-backed fixed-window limiter.
-- No external vendor: a tiny counter table + one atomic upsert RPC, called server-side via the
-- service-role client from the sensitive Server Actions (auth, public booking, inquiry, review).

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

-- Locked: RLS on, no policy, no grant → only service_role (which bypasses RLS) ever touches it.
-- The counters key on IP/email, never tenant data, but we keep the RLS discipline uniform.
alter table public.rate_limits enable row level security;

-- Atomic hit: increment the window's counter (resetting if the window has rolled over) and return
-- whether the caller is still within p_limit. Single upsert = race-free under concurrency.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
                  when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else rl.count + 1
                end,
        window_start = case
                  when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
                  else rl.window_start
                end
  returning rl.count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
