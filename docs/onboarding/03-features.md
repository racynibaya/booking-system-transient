# 03 — Feature Inventory

> Status legend: **🟢 Live** (deployed on `main`) · **🟣 Branch** (built on `feat/payout-disbursement`,
> not deployed) · **🟡 Dormant** (code present, held off by env/DB flag — intentional hedge) ·
> **⚫ Dead** (superseded; deleted on branch — see `07`).
>
> "Live" means it's on `main` and reachable. Several commission features are 🟣 — fully built and
> sandbox-verified, but they aren't in prod until the branch merges + the compliance gate clears.

---

## Tourist-facing

| Feature                                   | Purpose / business value                                                                                               | Status               | Key files                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| **Marketplace grid** (`/`)                | One place to discover San Juan stays; daily fair-shuffle so no operator is pinned. The OTA's front door.               | 🟢 Live              | `app/page.tsx`, `components/marketplace/*`, `list_public_listings` RPC                |
| **Per-property booking page** (`/[slug]`) | Shareable page that converts an operator's FB/Messenger traffic into a real booking; also the marketplace's inventory. | 🟢 Live              | `app/[slug]/page.tsx`, `components/public/*`, `get_public_listing` RPC                |
| **Deposit booking + hold**                | Date/guest selection, min-stay check, atomic hold. The core no-double-book promise.                                    | 🟢 Live              | `app/[slug]/actions.ts` (`createPublicBooking`), `components/public/booking-card.tsx` |
| **Manual pay (GCash QR + proof)**         | Guest pays the operator's GCash, uploads a screenshot; the path live in prod.                                          | 🟢 Live              | `app/[slug]/actions.ts` (`submitProof`), `app/[slug]/pay/return/`                     |
| **Online checkout (centralized)**         | Guest pays Tuloy's platform PayMongo account (deposit + service fee, fee grossed up). The commission rail.             | 🟣 Branch            | `app/[slug]/actions.ts` (`createPlatformCheckout`), `lib/pricing.ts`                  |
| **Favorites / wishlist**                  | Client-side per-browser saved listings. Low-stakes polish.                                                             | 🟢 Live              | `components/favorites/*` (localStorage)                                               |
| **Auto-acknowledge email**                | Guest gets an instant "request received" so they're never left silent.                                                 | 🟢 Live (tier-gated) | `lib/email/`, `createPublicBooking`                                                   |

## Operator-facing

| Feature                            | Purpose / business value                                                                                        | Status                            | Key files                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| **Dashboard**                      | Greeting, onboarding checklist, money cards (collected/coming/owed), occupancy, needs-action. The daily driver. | 🟢 Live                           | `app/(app)/dashboard/`, `components/dashboard/*`                                   |
| **Bookings management**            | Filterable table; confirm/cancel; live updates; smart views (Today/Upcoming/Awaiting).                          | 🟢 Live                           | `app/(app)/bookings/`, `components/bookings/*`                                     |
| **Manual booking entry**           | Record walk-in/phone/Messenger bookings — same hold RPC, short hold. Keeps the calendar honest.                 | 🟢 Live                           | `app/(app)/bookings/new/`, `createManualBooking`                                   |
| **Property + room management**     | Create/edit property, cover + space photos, room types + photos, availability blocks.                           | 🟢 Live                           | `app/(app)/properties/`, `components/properties/*`                                 |
| **Availability calendar**          | Block off maintenance/closure dates. Feeds the single source of truth.                                          | 🟢 Live                           | `app/(app)/properties/[id]/calendar/`, `components/properties/calendar.tsx`        |
| **Payment methods (guest-facing)** | Operator's GCash/bank + QR for manual guest payment.                                                            | 🟢 Live                           | `app/(app)/settings/`, `components/settings/payment-methods-section.tsx`           |
| **Payout account (get-paid)**      | Where Tuloy disburses the operator's share (GCash/bank + name + BIC). Low-friction onboarding.                  | 🟣 Branch                         | `components/settings/payout-account-section.tsx`, `upsertPayoutAccount`            |
| **Verification**                   | Upload gov ID / permit / property proof. Trust layer that beats faceless FB pages.                              | 🟢 Live                           | `app/(app)/verification/`, `components/verification/*`                             |
| **Earnings dashboard**             | Clearing → Payable → Paid waterfall + ledger rows. Operator's view of money owed.                               | 🟣 Branch                         | `app/(app)/earnings/`, `components/earnings/payouts-table.tsx`                     |
| **PayMongo connect (Model A)**     | Operator connects their _own_ PayMongo `sk_` key. Superseded by centralized.                                    | 🟡 Dormant (⚫ deleted on branch) | `app/(app)/settings/gateway-actions.ts`, `components/settings/gateway-section.tsx` |
| **Subscription / plan UI**         | Tier display + GCash/card subscribe buttons. Superseded by commission.                                          | 🟡 Dormant (⚫ deleted on branch) | `components/settings/plan-section.tsx`, `subscribe-buttons.tsx`                    |

## Admin-facing

| Feature                         | Purpose / business value                                                                             | Status                            | Key files                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| **Operator approval queue**     | Review docs + listing preview; approve / request-changes / suspend. Gate against scams.              | 🟢 Live                           | `app/(admin)/admin/operators/`, `components/admin/operator-row.tsx` |
| **Financial dashboard**         | KPIs (deposits, pipeline, avg booking), booking funnel, supply, operator queue.                      | 🟢 Live                           | `app/(admin)/admin/`, `lib/supabase/admin-dal.ts`                   |
| **Refund tool**                 | Look up a booking, preview captured amount + ledger status, issue full/partial refund with clawback. | 🟣 Branch                         | `app/(admin)/admin/refunds/`, `components/admin/refunds-panel.tsx`  |
| **Per-owner rate editor**       | Set commission/service-fee per operator (early-adopter 2.5%).                                        | 🟣 Branch                         | `app/(admin)/admin/actions.ts`, `components/admin/rate-editor.tsx`  |
| **Subscription billing health** | Paying / due-soon / past-due panel.                                                                  | 🟡 Dormant (⚫ deleted on branch) | `components/admin/billing-panel.tsx`, `adminBillingHealth()`        |

## Background / system

| Feature                       | Purpose                                                                       | Status                                   | Key files                                      |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| **Checkout webhook**          | PayMongo deposit confirmation → `confirm_booking_gateway` → confirm + accrue. | 🟣 Branch (env-gated)                    | `app/api/webhooks/paymongo/route.ts`           |
| **Transfer-status webhook**   | Batch transfer settled/failed → reconcile ledger.                             | 🟣 Branch                                | `app/api/webhooks/paymongo/transfers/route.ts` |
| **Daily payout cron**         | Claim cleared payouts, submit one batch transfer per operator.                | 🟣 Branch (env-gated, returns 503 unset) | `app/api/cron/payouts/route.ts`                |
| **Deposit-reminder cron**     | Nudge guests with a held booking nearing expiry.                              | 🟡 Dormant (no schedule, tier-gated)     | `app/api/cron/booking-reminders/route.ts`      |
| **Subscription billing cron** | Flag past-due, downgrade non-payers.                                          | 🟡 Dormant (⚫ deleted on branch)        | `app/api/cron/subscription-billing/route.ts`   |

---

## How to read "keep / improve / remove"

- **🟢 Live** → keep; this is the working product.
- **🟣 Branch** → keep; this is the intended future, pending compliance + merge. Don't touch the gates.
- **🟡 Dormant** → keep _for now_ — it's the deliberate reversibility hedge. It becomes removable only
  after the commission pilot validates (see `07` and `09`).
- **⚫ Dead (on branch)** → the branch already deletes these. They're _not_ removable from `main` until
  the branch merges. Don't pre-delete.

---

## Self-check

1. Name three features that look "done" in the code but are **not in prod** today, and why.
2. Which features are the _deliberate hedge_ (dormant, keep) vs. genuinely obsolete?
3. If you demoed prod right now, could a guest pay _online_? (No — only manual GCash + proof; online
   checkout is 🟣 branch.)

## Flagged inconsistencies / your decisions

- 🟡 The Model A "connect your own PayMongo" UI is still reachable in prod settings (gated to Business
  tier). With commission as the plan, it's a confusing dead-end for any operator who finds it. Decide:
  hide it in prod now, or wait for the branch merge to remove it.
- 🟢 Earnings + refund tool are strong, sandbox-verified features sitting idle on the branch. They're
  ready the moment the compliance fork is resolved.
