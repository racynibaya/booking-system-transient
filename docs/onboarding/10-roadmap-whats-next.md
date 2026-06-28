# 10 — What To Build Next (the forward call)

> A recommendation, not a survey. Grounded in the verified state: the engineering is sound, the
> commission rail is built, and the only thing between you and revenue is a **business/legal decision**,
> not more code.

---

## The honest situation

- **Infra, economics, and engineering are not your problem.** The booking core is correct, margins are
  ~94%, and the commission rail is built and sandbox-verified.
- **Your real risk is unvalidated paying demand** — will tourists book on Tuloy instead of Messenger, and
  will operators accept ~11%? No amount of code answers this.
- **The one thing blocking revenue is the custody fork** (`08`), and it has a path that ships _now_.

So "what to build next" is mostly "what to _decide_ next, then ship the smallest thing that earns."

---

## Recommended sequence

### 1. Decide the money fork — **invoice commission first** (this week)

Pick **invoice-the-commission** as the go-live path: operator gets paid directly, Tuloy bills the cut.
It's legal _today_ (no custody, DTI done), needs no Xendit answer, and lets you start the pilot. Keep
Xendit xenPlatform in flight as the _upgrade_ to auto-deduct if/when their custody answer clears — but
don't let it block earning. **This is a one-way-door call → it's yours to make, not mine.**

> If you choose auto-deduct instead, you're blocked on Xendit and the parked aggregator rail still can't
> ship. That's the slower, riskier door.

### 2. Close the two money-correctness blockers (days)

- Set **`PAYMONGO_MDR`** to the real worst-case enabled rate (or restrict checkout to domestic/e-wallet).
- If any disbursement runs, **wire the payout cron schedule** (Vercel cron) — it does nothing unscheduled.

### 3. Run the 2–3 operator commission pilot (the actual experiment)

The pivot is explicitly gated on this. Measure the two riskiest assumptions directly:

- **Tourist conversion:** completed Tuloy bookings vs the operator's usual DM flow.
- **Operator acceptance:** do they keep listing at ~11% and tolerate payout timing?
  Make on-platform booking _easier_ than going around it (the leakage mitigation) — that's the product work
  the pilot justifies, if any.

### 4. Only after the pilot holds: merge the branch + delete the dormant models

`feat/payout-disbursement` already does the deletions. Merge it _after_ the pilot proves commission, grep
for `tenants.plan` readers first (`07`), then the subscription + Model A code retires cleanly. Not before.

### 5. Deferred until San Juan is proven

La Union / Baguio / Siargao expansion (D9 holds — depth over breadth), clawback automation, holiday-aware
`clear_eta`, marketplace keyword search, room-level amenities. None of these earns you the first
commission peso.

---

## What NOT to build right now

- ❌ More booking features — the core already works; polish doesn't validate demand.
- ❌ The auto-deduct rail / Xendit migration _before_ deciding the fork — it may never be needed.
- ❌ A cleanup PR deleting dormant code on `main` — the branch does it; you'd just create merge conflict.
- ❌ Anything outside San Juan.

---

## The decisions only you can make (one-way doors)

1. **Invoice vs auto-deduct commission** (`08`). Recommendation: invoice now, auto-deduct later if Xendit
   clears.
2. **When the pilot "passes"** — define the bar now (e.g. N completed on-platform bookings, operators
   renewing intent) so you don't move the goalposts.
3. **When to retire the dormant hedge** — tie it to the pilot bar above.
4. **Early-adopter terms** — confirm the messaging is the _current_ "2.5% commission," not the retired
   "50% lifetime subscription discount."

---

## One-paragraph north star

The product is built and correct. Stop building and start _charging_: choose the invoice path so the
custody gate stops blocking you, set the MDR honestly, and put the commission rail in front of 2–3 real
operators and their real Facebook demand. The pilot — not more engineering — tells you whether Tuloy is a
business. Everything else (Xendit auto-deduct, expansion, dormant-code cleanup) waits behind that answer.

---

## Self-check

1. What's the single decision that unblocks revenue, and which option ships without the custody problem?
2. Why is "run the pilot" higher priority than "merge the branch and clean up"?
3. Name two things you should explicitly _not_ build right now, and why.

## Flagged inconsistencies / your decisions

- 🔴 Items 1–4 under "decisions only you can make" are open one-way doors. The roadmap above assumes the
  **invoice-first** answer; if you choose differently, steps 2–4 reorder around the Xendit dependency.
- 🟢 Nothing here requires new architecture — it's decisions + small config + a pilot. That's the good news.
