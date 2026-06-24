-- Pro/Business deposit-reminder follow-up (tier rebalance).
--
-- A pre-expiry nudge: for a 'held' booking nearing the end of its hold with no payment proof yet,
-- email the guest one reminder so the tool chases instead of the operator. This NEVER touches the
-- money-critical hold/overlap logic (P1) — it only reads held rows and stamps a dedupe flag.
--
-- Dormant during the pilot: every operator is Solo, so the gate (plan in ('pro','business')) matches
-- nobody until an operator upgrades. No cron schedule is wired yet (see app/api/cron/booking-reminders).

-- Dedupe flag: null = the guest has not been reminded for this hold. Set once when the reminder is
-- claimed below, so a re-run / overlapping sweep can never send a second reminder.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

comment on column public.bookings.reminder_sent_at is
  'When the Pro/Business pre-expiry deposit reminder was sent for this hold (null = not yet). Dedupe flag for due_deposit_reminders().';

-- due_deposit_reminders — CLAIM-then-return. Atomically stamps reminder_sent_at = now() on every
-- eligible held booking and returns the rows the cron needs to build the email. Because the claim and
-- the read are one statement, two concurrent sweeps can never both grab the same row, so no
-- double-send. The stamp lands even if the email later fails — we trade a rare missed reminder for
-- never spamming a guest (email is best-effort everywhere in this codebase).
--
-- Eligibility: still held (no proof yet → status flips off 'held' on submit_proof), live but inside
-- the last 10 minutes of the hold, has a guest email, not already reminded, and the owning tenant is
-- on a paid automation tier. security definer + empty search_path; service_role-only (the cron uses
-- the service client). RLS is bypassed by the definer, so the tier gate lives in the WHERE clause.
create or replace function public.due_deposit_reminders()
returns table (
  id             uuid,
  guest_name     text,
  guest_email    text,
  check_in       date,
  check_out      date,
  num_guests     integer,
  deposit_amount numeric,
  total_amount   numeric
)
language sql
security definer
set search_path = ''
as $$
  update public.bookings b
  set reminder_sent_at = now()
  from public.tenants t
  where t.id = b.tenant_id
    and b.status = 'held'
    and b.reminder_sent_at is null
    and b.guest_email is not null
    and b.hold_expires_at is not null
    and b.hold_expires_at > now()
    and b.hold_expires_at <= now() + interval '10 minutes'
    and t.plan in ('pro', 'business')
  returning
    b.id, b.guest_name, b.guest_email, b.check_in, b.check_out,
    b.num_guests, b.deposit_amount, b.total_amount;
$$;

revoke all on function public.due_deposit_reminders() from public, anon, authenticated;
grant execute on function public.due_deposit_reminders() to service_role;
