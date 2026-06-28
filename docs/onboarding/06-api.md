# 06 — API surface (routes, server actions, webhooks, crons)

> Tuloy is a Next.js app: most "API" is **Server Actions** (called from React, run on the server) plus a
> few **route handlers** (webhooks/crons/auth). 🟢 = live on `main`, 🟣 = branch-only.

---

## Page routes

| Path                                                           | Audience | Purpose                                           |
| -------------------------------------------------------------- | -------- | ------------------------------------------------- |
| `/`                                                            | Public   | Marketplace grid (`app/page.tsx`)                 |
| `/[slug]`                                                      | Public   | Per-property booking page (`app/[slug]/page.tsx`) |
| `/[slug]/pay/return`                                           | Public   | Post-payment proof upload / return handler        |
| `/about`, `/login`, `/reset-password`                          | Public   | Static / auth                                     |
| `/auth/confirm`                                                | Public   | Magic-link / OTP / recovery handler (`route.ts`)  |
| `/dashboard`                                                   | Operator | Home: money cards, occupancy, needs-action        |
| `/bookings`, `/bookings/new`                                   | Operator | Bookings table; manual entry                      |
| `/properties`, `/properties/[id]`, `/properties/[id]/calendar` | Operator | Listings + calendar                               |
| `/settings`                                                    | Operator | Payment methods + payout account                  |
| `/earnings` 🟣                                                 | Operator | Payout waterfall + ledger                         |
| `/verification`                                                | Operator | Doc upload                                        |
| `/admin`                                                       | Admin    | Financial dashboard + operator queue              |
| `/admin/operators`                                             | Admin    | Approval queue                                    |
| `/admin/refunds` 🟣                                            | Admin    | Refund tool                                       |

All operator routes are under `app/(app)/` (auth layout); admin under `app/(admin)/` (guarded by
`requireAdmin()`).

---

## Server actions (the real "API")

### Public booking — `app/[slug]/actions.ts`

| Action                          | Auth | Does                                                                                                               | Edge cases                                                      |
| ------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **`createPublicBooking`** 🟢    | anon | Validates min-stay; calls `create_booking_hold`; returns hold + payment methods; best-effort acknowledge email     | Min-stay reject; slot taken → hold fails (P1)                   |
| **`createPlatformCheckout`** 🟣 | anon | Creates PayMongo Checkout (deposit + convenience fee); idempotently claims the URL; stamps `gateway_charge_amount` | Duplicate call reuses URL; needs `PAYMONGO_PLATFORM_SECRET_KEY` |
| **`submitProof`** 🟢            | anon | Validates + uploads GCash screenshot to private bucket; `submit_proof` RPC                                         | File >5MB / wrong type; hold expired                            |

### Operator bookings — `app/(app)/bookings/actions.ts`

| Action                       | Does                                                         | Idempotency                                   |
| ---------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| **`confirmBooking`** 🟢      | `confirm_booking` RPC; guest + operator emails               | Re-confirm → null → no duplicate email        |
| **`cancelBooking`** 🟢       | `→ cancelled`; frees inventory; guest email                  | Re-cancel updates 0 rows → no re-send         |
| **`createManualBooking`** 🟢 | `create_booking_hold` (5-min hold); optional instant confirm | Re-call recomputes balance, no-ops if settled |

### Dashboard / properties / settings

- `app/(app)/dashboard/actions.ts`: **`markBalanceCollected`** 🟢 (insert `balance` payment; idempotent).
- `app/(app)/properties/actions.ts`: property/room CRUD, cover/space photos, availability blocks
  (`createBlock`/`deleteBlock`).
- `app/(app)/settings/actions.ts`: **`upsertPaymentMethod`** 🟢, **`upsertPayoutAccount`** 🟣
  (changing payout method trips the 3-day re-verify grace).

### Verification — `app/(app)/verification/actions.ts`

- **`recordVerificationDoc(kind, path)`** 🟢 — upsert doc metadata after browser upload; re-upload from
  `changes_requested` calls `resubmit_verification`.

### Admin — `app/(admin)/admin/actions.ts`

- **`setVerification`**, **`requestChanges`**, **`getOperatorDocs`** (signed URLs), **`getOperatorListing`** 🟢.
- **`adminLookupBookingForRefund`**, **`refundBooking`** 🟣 (claim→PayMongo refund→finish; clawback if paid).
- Per-owner **rate editor** actions 🟣.

### Auth — `app/auth/actions.ts`

- **`passwordAuth(mode, …)`** 🟢 (signin/signup; signup provisions a tenant via `handle_new_user`
  trigger; redirect by role). **`requestPasswordReset`**, **`updatePassword`**, **`signOut`**.

---

## Route handlers — webhooks

| Endpoint                                       | Auth                                                   | Does                                                                                     | Idempotency / failure                                                               |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **`POST /api/webhooks/paymongo`** 🟣           | HMAC-SHA256 over raw body vs `PAYMONGO_WEBHOOK_SECRET` | Checkout paid → `confirm_booking_gateway` (amount-guarded) → confirm + accrue            | RPC status-guard → replay is no-op; 401 if no secret; 5xx → PayMongo retries        |
| **`POST /api/webhooks/paymongo/transfers`** 🟣 | platform secret                                        | Batch transfer settled/failed → re-fetch authoritative status → `reconcile_disbursement` | Callback body is only a wake-up; idempotent on `payout_id`; alerts admin on failure |

> On `main`, prod also still contains the **subscription webhook** (`.../paymongo/subscription`) and the
> **Model A per-tenant webhook** (`.../paymongo/[token]`) — both 🟡 dormant, both deleted on the branch.

---

## Route handlers — crons

| Endpoint                                                | Auth / gate                                                       | Does                                                                            | State when unset                             |
| ------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| **`GET /api/cron/payouts`** 🟣                          | `Bearer CRON_SECRET` + `PAYMONGO_PAYOUT_SOURCE_{NUMBER,NAME,BIC}` | `claim_due_payouts` → one batch transfer per tenant → `mark_payout_paid/failed` | **Returns 503** if any key missing (dormant) |
| **`GET /api/cron/booking-reminders`** 🟡                | `CRON_SECRET`                                                     | `due_deposit_reminders` → reminder email per held booking nearing expiry        | No schedule wired; tier-gated                |
| **`GET /api/cron/subscription-billing`** 🟡 (⚫ branch) | `CRON_SECRET`                                                     | Flag past-due, downgrade non-payers                                             | Dormant; deleted on branch                   |

**No cron schedules are wired in prod** — the payout cron has no Vercel cron entry yet (a go-live TODO).

---

## The env gates that keep money OFF in prod

All **unset in prod**, which is the safety:

| Var                                      | Gates                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYMONGO_PLATFORM_SECRET_KEY`           | Centralized checkout + (old) subscription checkout                                                                                      |
| `PAYMONGO_WEBHOOK_SECRET`                | Checkout webhook (returns 401 unset)                                                                                                    |
| `PAYMONGO_PAYOUT_SOURCE_NUMBER/NAME/BIC` | Payout cron (503 unset)                                                                                                                 |
| `CRON_SECRET`                            | All cron routes (refuse unset)                                                                                                          |
| `SITE_URL`                               | Webhook registration (Model A) — note: a wrong value here once silently broke booking confirmation in prod; canonical = the apex domain |

---

## Self-check

1. Most of Tuloy's "API" isn't REST routes — what is it, and where does it run?
2. What two things must be true (env-wise) for the payout cron to do anything other than return 503?
3. How does the checkout webhook avoid confirming a booking twice if PayMongo retries?

## Flagged inconsistencies / your decisions

- 🟡 Prod still exposes **three** PayMongo webhook routes (platform, subscription, per-tenant token); two
  are dormant dead-ends. The branch consolidates to one. Harmless but confusing.
- 🟡 **No cron schedule exists** for payouts even on the branch — wiring the Vercel cron is part of
  go-live, not done. Don't assume "daily cron" runs until you add the schedule.
