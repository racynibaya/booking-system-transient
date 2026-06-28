# 04 — User Flows (code-path walkthroughs)

> Each flow names the page → action → RPC → side effects. 🟢 = live in prod, 🟣 = branch-only.
> Booking + manual pay are 🟢. Online checkout + payout + refund are 🟣.

---

## A. Tourist books a room — end to end

```
/[slug] page  ──►  createPublicBooking  ──►  create_booking_hold (RPC)
                                                   │  atomic hold, stamp total/deposit
                                                   ▼
                              guest sees hold + countdown + payment options
                                   │                              │
                       (manual) submitProof            (online) createPlatformCheckout 🟣
                                   │                              │
                            submit_proof (RPC)            PayMongo checkout → webhook
                                   │                              │
                                   ▼                              ▼
                       status → awaiting_confirmation    confirm_booking_gateway (RPC) 🟣
                                                          status → confirmed + payout accrual
```

1. **Discover → open page.** `/` (`list_public_listings`) → `/[slug]` (`get_public_listing`, anon, gated
   on `verification_status='approved'`). Loads property, rooms, availability (date ranges only, no PII).
2. **Fill booking card** (`components/public/booking-card.tsx`): room, dates, guests, name/email/phone.
   Front-end checks `isRangeBookable()` (`lib/availability.ts`); submits to **`createPublicBooking`**
   (`app/[slug]/actions.ts`).
3. **Server creates the hold:** `createPublicBooking` validates min-stay, calls **`create_booking_hold`**
   (anon, `SECURITY DEFINER`) → atomically creates a `held` booking, locks the dates, stamps
   total/deposit. Returns booking id, hold expiry, and the operator's payment methods. Hold = 30 min
   prod / 1 min dev.
4. **Guest pays — two paths:**
   - **🟢 Manual:** guest sends GCash to the displayed QR, returns to `/[slug]/pay/return`, uploads a
     screenshot → **`submitProof`** → validates file → uploads to the private `payment-proofs` bucket →
     **`submit_proof`** RPC → status `held → awaiting_confirmation` (if hold not expired).
   - **🟣 Online:** guest clicks Pay online → **`createPlatformCheckout`** creates a PayMongo Checkout
     Session (deposit + convenience fee), idempotently claims the checkout URL on the booking, stamps
     `gateway_charge_amount` (the grossed-up total the webhook will verify). Guest pays → PayMongo POSTs
     `app/api/webhooks/paymongo/route.ts` → **`confirm_booking_gateway`** verifies the settled amount ==
     `coalesce(gateway_charge_amount, deposit_amount)` → status `→ confirmed` **and writes the payout
     ledger accrual atomically.**
5. **Operator confirms** (manual path): operator sees `awaiting_confirmation` in `/bookings`, clicks
   Confirm → **`confirmBooking`** → **`confirm_booking`** RPC → `→ confirmed`, fires guest + operator
   emails (idempotent: a re-confirm returns null → no duplicate email).
6. **Notifications** fire to guest + operator.

**Failure modes:** two guests race the last unit → only one hold succeeds (P1). Abandoned cart → hold
expires, slot frees. Online: replayed webhook is a no-op (P4). Amount mismatch → `confirm_booking_gateway`
refuses.

---

## B. Operator manages a booking 🟢

1. Open `/bookings` → `getBookings()` (`lib/supabase/dal.ts`, SQL-driven filters: property, room, status,
   date range, guest name). Client adds smart views + counts.
2. **Confirm** → `confirmBooking` → `confirm_booking` RPC (RLS-scoped to the operator's tenant) →
   `awaiting_confirmation → confirmed`, emails fire once.
3. **Cancel** → `cancelBooking` (optional reason) → `→ cancelled`, inventory frees immediately (the
   occupancy predicate excludes `cancelled`), guest cancellation email. Idempotent: re-cancel updates 0
   rows → no re-send.
4. **Record cash balance** → after check-in, `markBalanceCollected` inserts a `balance` payment row for
   the remainder. Idempotent: re-call sees 0 owed → no-op.
5. **Manual booking** → `/bookings/new` → `createManualBooking` reuses `create_booking_hold` (5-min hold);
   can mark confirmed immediately → confirmation emails.

---

## C. Payout / disbursement 🟣 (branch, env-gated)

```
booking confirmed (online)  ──►  payout_ledger row: status=clearing, clear_eta = now + 3 banking days
        │
        ▼  (daily)  GET /api/cron/payouts   [requires CRON_SECRET + PAYMONGO_PAYOUT_SOURCE_* ; else 503]
        ▼
claim_due_payouts (RPC)  ──►  per tenant, clearing→payable under ONE fresh payout_id (atomic claim)
        │
        ▼
PayMongo batch transfer (InstaPay for GCash/≤₱50k, else PESONet), reference_number = payout_id
        │
        ▼
mark_payout_paid (status=paid, payout_ref) / mark_payout_failed (status=failed, reason)
        │
        ▼  (async) POST /api/webhooks/paymongo/transfers  ──►  reconcile_disbursement
                   re-fetches authoritative status; on failure flips paid→failed + flags account + alerts admin
```

**Why double-pay is impossible (P6):** the atomic claim under one `payout_id` (= the transfer's
`reference_number`) means a concurrent cron run claims 0 rows, and `mark_payout_paid` only touches
`payable` rows for that id. The transfer-status webhook body is only a wake-up — the handler re-fetches
the real status from PayMongo (authoritative).

---

## D. Admin refund (+ clawback) 🟣 (branch)

1. `/admin/refunds` → admin enters a booking id (or picks from recent online payouts) →
   **`adminLookupBookingForRefund`** → preview: guest, dates, captured amount, ledger status,
   refundability.
2. Admin issues refund (reason + amount, defaults to full) → **`refundBooking`**:
   - **`claim_refund`** RPC → locks the ledger row (refundable from `clearing` / `payable` / `paid`) →
     status `→ refunding`, returns `prior_status` (decides clawback) + the captured payment ref.
   - PayMongo `createRefund` against the captured payment.
   - **`finish_refund`** RPC:
     - operator **not** yet paid → `→ refunded` (clean, money never left).
     - operator **already** paid (`prior_status` was `paid`/`payable`) → `→ clawed_back` + alert admins;
       recover the operator's share from their **next** payout (**v1 = manual**).
   - On PayMongo error → **`abort_refund`** restores the prior status (re-refund or payout can proceed).

**Money rule enforced:** the guest is refunded at most once; the operator is never paid twice.

---

## E. Operator onboarding / verification 🟢

1. Sign up (email + password, `passwordAuth`). A trigger (`handle_new_user`) provisions a tenant row.
2. Set up property + rooms (`/properties`), payment methods (`/settings`), and — for the commission rail
   — a payout account (🟣).
3. Upload verification docs (`/verification` → `recordVerificationDoc`): gov ID, business permit,
   property proof → private `verification-docs` bucket.
4. Admin reviews in `/admin/operators` → `setVerification('approved')` (or `requestChanges`). **Only
   approved operators appear publicly** (`list_public_listings` / `get_public_listing` gate on it).
5. **Re-verify tripwire:** an approved operator who changes their payout method enters a 3-day grace
   window (listing stays live, then is hidden if not re-verified) — guards against account-takeover
   payout redirection.

---

## Self-check

1. In the manual-pay path, what flips a booking from `held` to `awaiting_confirmation`, and what flips it
   to `confirmed`?
2. In the online path, at what exact moment is the payout accrual written — and why there?
3. In a refund, what determines whether the result is `refunded` vs `clawed_back`?

## Flagged inconsistencies / your decisions

- 🟡 **Clawback recovery is manual (v1).** If you refund a guest after the operator was paid, _you_ must
  net it out of their next payout by hand. Fine at pilot volume; needs automation before scale.
- 🟡 The 🟢 live flow (manual GCash + proof + operator confirm) and the 🟣 online flow (auto-confirm via
  webhook) **coexist in the code**. In prod only the manual one runs. Be clear which you're testing.
