-- S5 — Guest reviews / operator reputation. After a stay ends, the guest is invited (by email) to
-- leave a 1–5 star review with an optional comment; the review shows on the public listing and the
-- operator can post one public reply (no edit, no hide — decided one-way door). Same tokenized,
-- no-login idiom as inquiries (M2): the guest submits/reads through the service-role path with the
-- token as the credential; operators read their own rows via RLS and reply through a scoped RPC.

-- One review per booking. The row is created as an *invite* (submitted_at null, token minted) when a
-- stay completes; the guest fills rating/comment on submit. Aggregates + the public list only ever
-- count `submitted_at is not null`, so un-answered invites never show or skew the score.
create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  property_id         uuid not null references public.properties(id) on delete cascade,
  booking_id          uuid not null unique references public.bookings(id) on delete cascade,
  guest_name          text not null,
  guest_email         text not null,
  token               text not null unique default replace(gen_random_uuid()::text, '-', ''),
  rating              smallint check (rating between 1 and 5),
  comment             text,
  operator_reply      text,
  operator_replied_at timestamptz,
  invited_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  created_at          timestamptz not null default now()
);
-- Public listing read: submitted reviews for a property, newest first.
create index reviews_property_submitted_idx
  on public.reviews (property_id, submitted_at desc) where submitted_at is not null;
-- Operator dashboard read: all of a tenant's reviews (incl. pending invites), newest activity first.
create index reviews_tenant_idx on public.reviews (tenant_id, invited_at desc);

alter table public.reviews enable row level security;

-- Operators read their own reviews (RLS). They never UPDATE the table directly — replies go through
-- reply_to_review() so they can only touch the reply columns, never a guest's rating/comment. Guests
-- never touch the table directly; the invite form + public list use the service-role / definer paths.
create policy "reviews_select_own" on public.reviews for select
  to authenticated using (tenant_id = (select public.current_tenant_id()));

grant select on public.reviews to authenticated;
grant all on public.reviews to service_role;

-- Public aggregate + list for a listing (anon). SECURITY DEFINER so it reads past RLS without a
-- table grant to anon; only ever exposes submitted reviews and non-PII fields (name, rating, text,
-- reply). Returns a single json blob the listing page can render directly.
create or replace function public.get_public_reviews(p_slug text)
returns json language sql stable security definer set search_path = '' as $$
  with matched as (
    select r.*
    from public.reviews r
    join public.properties p on p.id = r.property_id
    where p.slug = p_slug and r.submitted_at is not null
  )
  select json_build_object(
    'avg_rating', (select round(avg(rating)::numeric, 1) from matched),
    'review_count', (select count(*) from matched),
    'reviews', coalesce((
      select json_agg(json_build_object(
        'id', id,
        'guest_name', guest_name,
        'rating', rating,
        'comment', comment,
        'operator_reply', operator_reply,
        'operator_replied_at', operator_replied_at,
        'submitted_at', submitted_at
      ) order by submitted_at desc)
      from matched
    ), '[]'::json)
  );
$$;
grant execute on function public.get_public_reviews(text) to anon, authenticated;

-- Lazy invite minting (no cron). Called by the operator's Reviews page on load: creates invite rows
-- for the tenant's finished stays that don't have one yet, and RETURNS only the newly created rows so
-- the caller can email each guest their review link exactly once. `on conflict (booking_id) do
-- nothing` makes it safe against concurrent/double renders — a booking already invited returns
-- nothing, so no duplicate emails.
create or replace function public.mint_review_invites()
returns table (id uuid, token text, guest_email text, guest_name text, property_name text)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := (select public.current_tenant_id());
begin
  return query
  insert into public.reviews (tenant_id, property_id, booking_id, guest_name, guest_email)
  select b.tenant_id, b.property_id, b.id, b.guest_name, b.guest_email
  from public.bookings b
  where b.tenant_id = v_tenant
    and b.status in ('confirmed', 'completed')
    and b.check_out < current_date
    and b.guest_email is not null
    and not exists (select 1 from public.reviews r where r.booking_id = b.id)
  on conflict (booking_id) do nothing
  returning
    reviews.id,
    reviews.token,
    reviews.guest_email,
    reviews.guest_name,
    (select p.name from public.properties p where p.id = reviews.property_id);
end;
$$;
grant execute on function public.mint_review_invites() to authenticated;

-- Operator posts / edits / clears their single public reply to a review they own. Column-scoped by
-- design (only touches operator_reply) so RLS UPDATE need not be granted; tenant-scoped so an
-- operator can never reply on someone else's review. Blank reply clears it.
create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reply text := nullif(btrim(p_reply), '');
begin
  update public.reviews
    set operator_reply = v_reply,
        operator_replied_at = case when v_reply is null then null else now() end
    where id = p_review_id
      and tenant_id = (select public.current_tenant_id())
      and submitted_at is not null;
end;
$$;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
