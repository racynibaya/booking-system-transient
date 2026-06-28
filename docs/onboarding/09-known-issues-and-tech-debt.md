# 09 — Known Issues & Technical Debt (ranked)

> Ranked by severity for a real-money business. 🔴 = blocks safe go-live / money correctness ·
> 🟠 = real risk, fix before scale · 🟡 = cleanliness / confusion · 🟢 = minor.
> Per project rules these are **documented, not actioned** — none of this was changed.

---

## 🔴 Blockers / money-correctness

| Issue                                       | Why it matters                                                                                                                                | Where                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Custody/compliance gate unresolved**      | The commission rail can't legally ship until the invoice-vs-auto-deduct fork is decided and (for auto-deduct) a custody-clean rail confirmed. | `08-money-and-compliance.md`    |
| **`PAYMONGO_MDR = 0.035` is a placeholder** | Guest picks method after the amount is fixed; if the real worst-case rate is higher, Tuloy under-covers and eats the loss on every booking.   | `lib/pricing.ts:81`             |
| **No payout cron schedule wired**           | The disbursement cron exists but nothing triggers it (no Vercel cron entry). "Daily payout" won't happen until scheduled.                     | `app/api/cron/payouts/route.ts` |

## 🟠 Risk before scale

| Issue                                                            | Why it matters                                                                                                                                                 | Where                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Clawback recovery is manual (v1)**                             | Refund after an operator was paid → you must net it from their next payout by hand. Error-prone as volume grows.                                               | `finish_refund` (`…160600`), refund flow `04` |
| **`clear_eta` ignores PH holidays**                              | `now + 3 banking days` is a heuristic; a payout can be claimed before funds truly clear over a long holiday.                                                   | `payout_ledger` (`…160300`)                   |
| **Three live PayMongo webhook routes in prod**                   | platform + subscription + per-tenant token; two are dormant dead-ends. Larger attack/confusion surface; the branch consolidates to one.                        | `app/api/webhooks/paymongo/*`                 |
| **`main` reads `tenants.plan`; branch drops the column**         | Merging the branch breaks any un-migrated `.plan` / `subscription_status` reader. Grep before merge.                                                           | `07` shared-code table                        |
| **Two dormant fallback models = cognitive + maintenance weight** | Subscription + Model A are kept as a hedge (correct), but every reader of the code must reason about three money models. Has a real "when do we delete?" cost. | `07`                                          |

## 🟡 Cleanliness / confusion

| Issue                                                                                                                    | Where                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **`DESIGN.md` header says "live (pilot)"** — overstates shipped state (commission is unmerged).                          | `context/DESIGN.md`                       |
| **`centralized-aggregator.md` understates the compliance gate** ("enable Money Movement" vs the custody bright line).    | `context/docs/centralized-aggregator.md`  |
| **`CLAUDE.md` points to a root `PROGRESS.md` that doesn't exist** (real one is `context/PROGRESS.md`).                   | `CLAUDE.md`                               |
| **Model A "connect your own PayMongo" UI reachable in prod** (Business-tier gate) — a dead-end for the commission model. | `components/settings/gateway-section.tsx` |
| **Migration history drift** — `list_migrations` is unreliable for prod state; must query `pg_proc`/`information_schema`. | `supabase/migrations/`, `05`              |

## 🟢 Minor

| Issue                                                                                               | Where                             |
| --------------------------------------------------------------------------------------------------- | --------------------------------- |
| Favorites are localStorage-only (per-browser, not synced) — fine for now.                           | `components/favorites/`           |
| Deposit-reminder cron has no schedule and is tier-gated (all operators are solo) — effectively off. | `app/api/cron/booking-reminders/` |
| No keyword search on the marketplace yet (browse + favorites only).                                 | `app/page.tsx`                    |

---

## What is genuinely _good_ (so you don't "fix" it)

- The no-double-booking core is correct and test-backed (`create_booking_hold` + parity tests). Don't
  touch the check-then-write boundary.
- Money idempotency is real: one deposit/booking, one accrual/booking, atomic payout claim. The
  invariants in `02` hold.
- The dormant-not-deleted hedge is a _deliberate_ decision, not debt to pay down blindly — it has a cost,
  but it's bought reversibility while the pivot is unproven.

---

## Self-check

1. Which two 🔴 items are _money-correctness_ issues that must be closed before charging real pesos?
2. Why is "two dormant models" listed as debt even though keeping them is the right call?
3. What database-drift gotcha makes `list_migrations` untrustworthy for prod state?

## Flagged inconsistencies / your decisions

- 🔴 Decide the order of go-live blockers: compliance fork → MDR → cron schedule. None is optional for
  real money.
- 🟡 The doc-drift items (`DESIGN.md`, `centralized-aggregator.md`, `CLAUDE.md` PROGRESS pointer) are
  quick, safe fixes whenever you want — but they touch `context/`, so they're out of scope for this
  onboarding set by design.
