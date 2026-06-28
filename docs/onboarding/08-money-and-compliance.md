# 08 — Money & Compliance (the crux of the business right now)

> This is where intent meets the law. The commission math is **built and correct**; whether it can
> _legally ship_ is the open question. Read `00` then this.

---

## The commission math (exact, from `lib/pricing.ts`)

Single source of truth: **`computeBookingSplit(stayValue, deposit, rates)`**. Tuloy's take ≈ **11% of the
full stay value `S`** = 5% operator commission + 6% guest service fee. Both are sized on `S` but collected
through the **deposit `D`** transaction (no full payment online).

```
serviceFee         = round2(S × serviceFeeRate)        // 0.06·S  — guest-borne
operatorCommission = round2(S × commissionRate)        // 0.05·S  — withheld from payout
base               = round2(D + serviceFee)
guestTotal  G      = round2((base + PAYMONGO_FIXED) / (1 − PAYMONGO_MDR))   // fee passed through
ownerPayout        = round2(D − operatorCommission)     // disbursed from the deposit
tuloyRevenue       = round2(serviceFee + operatorCommission)   // ≈ 0.11·S
```

Constants (in `lib/pricing.ts`, **placeholders until go-live**):

```
PAYMONGO_MDR   = 0.035   // 3.5% — PayMongo standard DOMESTIC CARD rate
PAYMONGO_FIXED = 15      // ₱15  — domestic card fixed fee
```

**Who pays / gets what:**

- **Guest pays** `G` = deposit + 6% service fee + the grossed-up PayMongo fee. (The fee is passed through,
  so it's _not_ Tuloy margin.) Balance `S − D` is paid to the operator at check-in, directly.
- **Operator nets** `D − 0.05·S` online, **plus** `S − D` at check-in = **0.95·S** of the stay.
- **Tuloy keeps** `0.06·S + 0.05·S = 0.11·S`.

**Rates are per-owner** (`tenant_payout_accounts.commission_rate` / `service_fee_rate`), admin-managed.
The early-adopter promise = a reduced commission (5% → **2.5%**) on that row.

> ⚠️ **MDR is a real-money landmine.** The guest picks their payment method _after_ the amount is fixed,
> so `PAYMONGO_MDR` must be the **worst-case enabled method's real rate**, or you under-cover and eat the
> difference. Domestic card = 3.5% + ₱15 (current placeholder); international cards ~4.5%. **Confirm
> against the PayMongo dashboard and set this before charging a single real peso** — and consider
> restricting checkout to domestic/e-wallet to cap the exposure.

**Parity guarantee:** the same math runs in TS (guest preview) and in `confirm_booking_gateway` (ledger
accrual), both rounding to 2 decimals, guarded by a parity test. `guestTotal` is stamped on the booking as
`gateway_charge_amount`, which the webhook verifies the settled amount against (the amount-guard invariant).

---

## The compliance gate (why this isn't shipping)

To collect centrally and disburse, Tuloy must **hold and remit operator funds**. The structure built (the
parked aggregator rail) does this by pooling guest payments in **one platform PayMongo wallet**, then a
daily cron disburses each operator's share.

**Your counsel's bright line (2026-06-27):** _any_ custody of third-party (operator) funds — even money
resting briefly as a balance in a processor wallet — makes Tuloy a **BSP-licensed Operator of Payment
System / money-services business**. Funds must stay in the _licensed processor's_ custody at all times,
never Tuloy's, even momentarily.

→ The pooled-wallet-then-disburse design **is custody → it cannot legally ship as-is.**

> 🔴 **Doc correction:** `context/docs/centralized-aggregator.md` and `DESIGN.md` frame the gate as "get
> PayMongo to enable Money Movement (disbursements)." That's a _capability_ question. The _legal_
> question — can Tuloy ever hold the funds at all — is the harder, real blocker. The build doc
> **understates this.** Treat the custody question as the gate, not the feature toggle.

Other compliance facts on record:

- **DTI** registration: done.
- **Stripe:** out for PH.
- **PayMongo:** cannot do a custody-clean charge-time split — its "Seeds" settles to the platform wallet
  first (= custody).

---

## The open fork (the decision that unblocks everything)

|              | **Invoice the commission**                                                                                                   | **Auto-deduct the commission**                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| How          | Operator gets paid the full guest payment directly; Tuloy **bills** the commission afterward (e.g. monthly invoice / charge) | Tuloy collects centrally, **nets out** its cut, disburses the rest                                            |
| Custody      | **None** — Tuloy never holds operator funds                                                                                  | **Requires** holding funds → custody-clean rail needed                                                        |
| Ships when   | **Now**, on PayMongo, on existing DTI registration                                                                           | Blocked until a custody-clean rail is confirmed                                                               |
| Rail         | Keep PayMongo (guest deposit only)                                                                                           | **Xendit xenPlatform** (`for-user-id` + split rules) is the lead — custody answer **pending** with their team |
| UX           | Slightly worse (operator must pay an invoice; collection risk)                                                               | Smoother (cut taken automatically)                                                                            |
| Leakage risk | Higher (operator already has the money; why pay the invoice?)                                                                | Lower (cut taken before they see it)                                                                          |

This is **the** business-critical decision currently open. The pragmatic read (carried into `10`): the
invoice path lets you start earning commission and run the pilot _without_ the custody gate, while the
Xendit answer decides whether auto-deduct is ever viable. Don't let "the better UX" block "ships legally
now."

---

## What "money is recorded, never held" means in the live product

Today (prod, `main`) Tuloy genuinely never touches money: the guest pays the operator's GCash directly and
uploads a screenshot; Tuloy only _records_ the booking. That's compliant by construction. The commission
pivot is exactly the move that introduces the custody question — which is why the rail is parked.

---

## Self-check

1. If a guest's stay is `S` and they pay deposit `D`, write Tuloy's revenue and the operator's total take
   in terms of `S`.
2. Why must `PAYMONGO_MDR` be the _worst-case_ method's rate, not the average?
3. In one sentence: why can the parked aggregator rail not legally ship, and which alternative ships now?

## Flagged inconsistencies / your decisions

- 🔴 **THE decision:** invoice vs auto-deduct. Invoice ships now (no custody); auto-deduct needs Xendit's
  custody answer. Pick a path (or "invoice now, migrate later if Xendit clears").
- 🔴 **`PAYMONGO_MDR = 0.035` is a placeholder.** Set it to the real worst-case enabled rate before any
  real charge, or restrict checkout methods. This is a money-correctness blocker, not a nice-to-have.
- 🟡 The canonical build doc understates the compliance gate — reconcile `centralized-aggregator.md` /
  `DESIGN.md` to the custody framing when you next touch them.
