# 07 — Pivots & Dead-Code Map

> The most important file for "what can I safely delete?" Answer up front: **almost nothing, yet** —
> the dormant code is a deliberate hedge, and the branch already does the deletions. Pre-deleting on
> `main` just creates merge pain. Read this before you touch any "unused-looking" code.

---

## The branch model (this is the spine)

```
main (58ac06b)  ─────────────────────────────────────────────►  PROD
  • subscription billing + enforcement   🟡 dormant (env off)
  • Model A operator-as-merchant gateway 🟡 dormant
  • manual GCash + proof booking         🟢 live
  • NO commission, NO payout ledger

feat/payout-disbursement (0fe7883, UNMERGED)  ──── ✗ not deployed
  • 8878a86  payout/aggregator rail (ledger, disbursement state machine, cron, transfers webhook)
  • b48703d  commission cutover: DELETE subscription + DELETE Model A + flatten listings
  • 0fe7883  admin refund/clawback + operator earnings + landing refresh
```

So the branch is simultaneously **adding** commission and **deleting** the two old models. Until it
merges, prod keeps all three.

---

## Classification

### 🟢 LIVE (on `main`, in prod) — keep

Booking core (`create_booking_hold`), manual GCash + proof pay, operator dashboard/bookings/properties/
calendar/settings, manual walk-in entry, verification + admin approval, marketplace listing + discovery
(with tier-boost logic that's inert because all operators are free tier), email notifications.

### 🟡 DORMANT-INTENTIONAL (on `main`, flagged off) — keep _for now_, this is the hedge

| What                                                                                           | Held off by                                                                    | Why keep                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| Subscription billing + enforcement + cron + UI                                                 | `PAYMONGO_PLATFORM_SECRET_KEY` unset + `billing_config.enforcement_mode='off'` | Fallback if the commission pilot fails |
| Model A "connect your own PayMongo" (gateway store, connect/disconnect UI, per-tenant webhook) | `SITE_URL` unset + no Business-tier operator onboarded                         | Fallback / hedge                       |
| Deposit-reminder cron                                                                          | no schedule + tier gate                                                        | Cheap to keep                          |

### 🟣 BRANCH (built, sandbox-verified, not deployed) — keep, don't touch the gates

Centralized checkout, `payout_ledger` + disbursement state machine + payout cron + transfers webhook,
admin refund/clawback, operator earnings, per-owner rate editor, the flattened `list_public_listings`.

### ⚫ DEAD on the branch (branch deletes these) — **do NOT pre-delete from `main`**

The branch's `b48703d` removes ~30 files + several DB objects. Representative set (not exhaustive):

- **Subscription:** `lib/plans.ts`, `components/settings/plan-section.tsx`, `subscribe-buttons.tsx`,
  `app/(app)/settings/subscription-actions.ts`, `app/api/cron/subscription-billing/route.ts`,
  `app/api/webhooks/paymongo/subscription/route.ts`, `lib/paymongo/subscription-*.ts`,
  `components/admin/billing-panel.tsx`, plus all subscription tests/fixtures.
- **Model A:** `app/(app)/settings/gateway-actions.ts`, `components/settings/gateway-section.tsx`,
  `app/api/webhooks/paymongo/[token]/route.ts` (+ test), `lib/supabase/gateway-dal.ts`.
- **Deprecated admin "feeds v1":** `components/admin/activity-feed.tsx`, `recent-bookings-table.tsx`.
- **DB objects dropped** (branch migrations `…160700`–`…161300`): `billing_config`,
  `tenant_subscription_entitlement` view, `subscription_payments`, `tenant_plan` enum, `tenants.plan` /
  `subscription_status` / `paid_until` / `trial_ends_at` columns, `tenant_gateway_connections`.

**Why these are safe to delete _eventually_ but not now:**

1. The commission model is self-contained (no runtime dependency on subscription/Model-A code).
2. All three models are gated by **env**, not by code presence — deleting them changes nothing in prod
   except removing dead weight.
3. Everything is recoverable from git history.
   → So: the deletions are correct, but the right moment is **branch merge after the pilot validates** —
   not a separate cleanup PR on `main` that would conflict with the branch.

---

## Shared code that is NOT dead (reused across models — handle with care)

| Thing                                         | Why it's shared                                                                                         | Trap                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `confirm_booking_gateway` RPC                 | Used by Model A _and_ commission; `gateway_charge_amount` NULL → Model A path, NOT NULL → accrue ledger | Don't delete it with Model A; just keep the accrual branch                      |
| `app/api/webhooks/paymongo/route.ts`          | Flat platform webhook serves commission settlement                                                      | —                                                                               |
| `lib/paymongo/client.ts`                      | Shared API client (checkout, transfers, refunds)                                                        | No model-specific logic — safe                                                  |
| `get_public_listing` `accepts_online_payment` | Flips from "has gateway connection" (Model A) → "has payout account" (commission) on the branch         | Different predicate per branch                                                  |
| `tenants.plan` reads                          | Booking room-cap nudge + some admin reads use it                                                        | **Branch drops the column** → grep `.plan` / `subscription_status` before merge |

---

## Stale docs (verified)

| Doc                                      | Verdict                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context/DESIGN.md`                      | Mostly realigned to D10 (commission), but the header says "Status: live (pilot)" which **overstates** shipped state. Flag, don't trust as live state.           |
| `context/docs/centralized-aggregator.md` | Canonical commission build doc, accurate on the code — but frames the go-live gate as "enable Money Movement," **understating the custody/BSP problem** (`08`). |
| `context/subscription-billing.md`        | Correct + explicitly marked dormant. **Keep** — it's the hedge's documentation.                                                                                 |
| `context/PROGRESS.md`                    | Self-aware ("lags reality"); fine as history.                                                                                                                   |
| `PROGRESS.md` (repo root)                | **Does not exist** — `CLAUDE.md` points to it; stale pointer.                                                                                                   |

> Per project rule: this onboarding set only _flags_ doc drift; it does not rewrite `context/` docs.
> Reconciling them is a separate change for you to approve.

---

## Self-check

1. Why is it a mistake to open a "delete the subscription code" PR against `main` right now?
2. Which single RPC is shared between Model A and commission, and what column decides which path runs?
3. What in the database will break `main` code on merge if you don't grep for it first?

## Flagged inconsistencies / your decisions

- 🔴 **Decision pending: when do the dormant models get deleted?** The honest answer is "when the
  commission pilot proves out." Until then the hedge is worth its weight. Put a tripwire on it (e.g.
  "after N successful commission bookings, merge + delete").
- 🟡 The Model A settings UI is still reachable in prod (Business-tier gate). Consider hiding it now so no
  operator hits a dead-end — a small, safe `main` change distinct from the big cutover.
