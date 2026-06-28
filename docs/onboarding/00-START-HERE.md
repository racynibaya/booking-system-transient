# Tuloy — Start Here

> A from-scratch onboarding for the founder. Read this file first; everything else hangs off it.
> Last written: 2026-06-27. These docs describe **verified ground truth** (git + code), not the
> aspirational state in `context/`.

---

## What Tuloy is, in one breath

Tuloy is a booking platform for the ~250 small accommodation operators in **San Juan, La Union**
(surf-town transients, homestays, small hotels). Today that whole town books over Facebook DMs and
GCash screenshots — no real availability, frequent double-bookings, lost inquiries. Tuloy gives each
operator a **shareable booking page with enforced, real availability** (its core promise: _no
double-booking_) and is becoming a **single marketplace** where tourists discover and book any San
Juan stay in one checkout.

The business is mid-pivot on _how it makes money_. That pivot is the single most important thing to
understand, so it's the rest of this page.

---

## The one mental model you must hold: **intent ≠ shipped**

There are two pictures of Tuloy, and they are different. Confusing them is how you (and any AI) lose
the thread.

|                 | **Shipped (what's live in prod on `main`)**              | **Intent (what the docs describe)**                    |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Product framing | Direct-booking tool for operators                        | Localized **OTA** / marketplace                        |
| Money model     | Subscription (dormant) — effectively **no live revenue** | **Commission** (~11% per booking)                      |
| Money rail      | None active                                              | Centralized aggregator (collect → disburse)            |
| Status          | Running, 2 live operators                                | **Built on a branch, unmerged, blocked on compliance** |

**Your `context/DESIGN.md` reads as if the commission OTA is "live (pilot)." It is not.** Commission
lives on the branch `feat/payout-disbursement`, which is **not merged and not deployed**. Prod is
still the direct-booking tool with subscription billing sitting dormant. When you read the code and it
looks like "commission is the platform," that's because your **working tree is the branch**, not `main`.

---

## The three money models (all three exist in the codebase, on purpose)

You changed how Tuloy makes money **three times**, and deliberately kept the old code
_disabled-not-deleted_ as a reversibility hedge. This is why the codebase feels crowded.

| #   | Model                                | What it was                                                                                                                      | State now                                                                                     |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **Subscription SaaS**                | Operators pay a flat monthly fee, room-gated tiers (Solo ₱990 / Pro ₱2,500 / Business). "Never a commission" was the _identity_. | ❌ Retired. **Live-wired but env-dormant on `main`.** Deleted on the branch.                  |
| 2   | **Operator-as-merchant ("Model A")** | Each operator connects _their own_ PayMongo account; Tuloy never touches money.                                                  | ❌ Superseded. Dormant on `main`. Deleted on the branch.                                      |
| 3   | **Commission OTA (current intent)**  | Tuloy collects guest payment centrally, takes ~11%, disburses the operator's share.                                              | ✅ The intended model. **Built on the branch, unmerged, blocked on a legal/compliance gate.** |

**Why the pivot happened:** a near-signed operator churned because they couldn't pay a subscription
_before seeing value_ — but _would_ pay a commission per booking. Non-techy operators also can't
self-serve a payment gateway. Commission removes both frictions: an operator joins by handing over
just a GCash number.

---

## The single thing blocking go-live (and it's not code)

The commission model needs Tuloy to **collect guest money centrally and remit each operator's share**.
Your lawyer's bright line (2026-06-27): _any_ custody of operator funds — even money sitting briefly
in a PayMongo wallet balance — makes Tuloy a **BSP-licensed money-services business**. The built
aggregator rail pools funds before disbursing = custody = **can't legally ship as-is**.

> ⚠️ Your own canonical doc (`context/docs/centralized-aggregator.md`) frames the gate as "just get
> PayMongo to enable Money Movement." That **understates it.** The real blocker is the custody
> question, not a feature toggle. See `08-money-and-compliance.md`.

**The open fork:**

- **Invoice the commission** — no custody, ships _now_ on PayMongo (operator gets paid directly, Tuloy
  bills the commission after). Simpler, legal today.
- **Auto-deduct the commission** — needs a custody-clean rail (Xendit xenPlatform `for-user-id` + split
  rules is the lead; their custody answer is pending). Smoother UX, but blocked.

This is the most important business decision currently open. It's covered in `10-roadmap-whats-next.md`.

---

## Reading order

1. **`00-START-HERE.md`** ← you are here (the mental model)
2. `01-product.md` — business, users, journeys, revenue, vision
3. `02-architecture.md` — the module map and the invariants that make the product trustworthy
4. `03-features.md` — every feature: what, who, status, files
5. `04-flows.md` — how a booking / payout / refund actually moves through the code
6. `05-database.md` — every table in business terms + the money state machines
7. `06-api.md` — routes, server actions, webhooks, crons
8. `07-pivots-and-dead-code.md` — what's live vs dormant vs dead, and what's safe to delete (and when)
9. `08-money-and-compliance.md` — the commission math + the custody gate + the open fork
10. `09-known-issues-and-tech-debt.md` — ranked
11. `10-roadmap-whats-next.md` — the forward call

---

## Current real state (verified against git, 2026-06-27)

- `main` HEAD = `58ac06b` — latest real work is **subscription enforcement** (dormant).
- The 3 commission commits are **branch-only, unmerged**: `8878a86` (payout rail), `b48703d`
  (commission cutover), `0fe7883` (refund tool + earnings + landing refresh).
- Every money rail in prod is held OFF by **unset env vars** (`PAYMONGO_PLATFORM_SECRET_KEY`,
  `PAYMONGO_PAYOUT_SOURCE_*`, `CRON_SECRET`, `SITE_URL`). That's the safety: no keys, no money moves.
- Stack: modified **Next.js 16** · **Supabase** (Postgres + Auth/RLS + Storage) · Tailwind + bespoke
  UI tokens · Vercel · **PayMongo** (guest deposits; the operator-payout gateway is the unresolved part).

---

## Self-check (answer these before moving on)

1. If a tourist books on Tuloy **in production today**, how does Tuloy make money on it?
   _(Answer: it doesn't — commission is unmerged/dormant, and the live subscription rail is off too.)_
2. Why does the codebase contain three different money models at once?
3. What single dependency blocks the commission model from shipping, and why is it a _legal_ problem
   rather than a code problem?

## Flagged inconsistencies / your decisions

- 🔴 `DESIGN.md` says "Status: live (pilot)" for the commission OTA — overstates reality. Worth a
  "shipped vs intended" banner. (Documented, not yet changed — your call.)
- 🔴 `centralized-aggregator.md` frames the go-live gate as "enable Money Movement," understating the
  custody/BSP problem. (See `08`.)
- 🟡 `CLAUDE.md` points to a root `PROGRESS.md` that **doesn't exist**; the real file is
  `context/PROGRESS.md`. Stale pointer.
