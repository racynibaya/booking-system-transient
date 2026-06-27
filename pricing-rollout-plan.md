# Tuloy — Pricing Model Build & Rollout Plan (0% operators → milestone commission)

> Engineering plan. Business model is settled; this tells the engineer **what to build, in what order, and where to stop and decide.** Follow the repo's own rules: small slices, simplest thing that works, no holding money, idempotency at every money seam, verify ground truth before touching anything money/prod.

---

## 1. Business decisions (locked — do not re-derive)

- **Operators pay 0% commission now.** Free to join. This is the brand wedge ("no commission, verified, no scams") — do not weaken it in copy or UI.
- **Revenue from day one = guest-side fee.** A small booking/protection fee (start ₱100–150 or a small %), shown as part of a single all-in price. This is what keeps Tuloy alive while operators are free. We are NOT deferring all revenue.
- **Money flow = operator-as-merchant.** Room payment goes **directly to the operator's own PayMongo account**. Tuloy never holds or pays out room money. Tuloy collects **only its guest fee** into Tuloy's account. → No payout fee, no settlement risk, no float liability while small.
- **Commission = dormant, config-driven, default 0.** Built and tested at 0 so it's safe to flip later. Flip is **milestone-based** (liquidity proven) and applies to **all operators after a notice period**.
- **Survival math:** cash-positive at ~18–27 bookings/mo on guest fees alone vs ~₱2,700/mo fixed infra. Keep infra lean until traction.

## 2. Non-negotiable engineering principle

**Every price lever is config/data, never hardcoded.** No literal percentages or peso amounts in checkout/booking code paths. Levers that must be data:

- `guest_fee` (flat amount and/or percent)
- `operator_commission_rate` (default `0`)
- featured-placement price (future, leave nullable)

This is the whole point: the business can change pricing without re-engineering, and commission can be turned on with a config change + notice, not a deploy scramble.

---

## 3. Phase 0 — Verify ground truth FIRST (no building yet)

Per repo rule and the 2026-06-25 incident: **docs lag, money doesn't forgive.** Before writing anything, confirm what's actually live, not what `PROGRESS.md`/memory claims.

- [ ] Confirm whether the **operator-as-merchant** payment path exists and works on `main`/prod (CLAUDE.md says it's built + dormant — verify, don't assume). Query prod objects directly, not `list_migrations`.
- [ ] Check for any existing **guest-fee** field / checkout fee logic.
- [ ] Inventory existing **pricing config** (tiers table, billing tables — billing is reportedly built + dormant).
- [ ] Confirm **verification** flow is live (it is, per CLAUDE.md) — reuse it; operators must be verified before listing.

**Output of Phase 0:** a short note of what already exists vs what's net-new. Reuse dormant infra; do not rebuild.

---

## 4. Phase 1 — Ship "0% operator + guest fee" (this makes Tuloy alive)

Goal: operators onboard free, guests book on an all-in price, Tuloy earns the guest fee, no money held.

- [ ] **Config store:** add `guest_fee` and `operator_commission_rate` (default 0) to the existing pricing/tenant config. Single source of truth.
- [ ] **Checkout (operator-as-merchant):**
  - Room amount → operator's merchant account.
  - Guest fee → Tuloy's account.
  - Display **one all-in total** to the guest (room + fee). Decide copy: bake it in silently, or label it "Booking protection." (Business decision — default to baked-in, revisit.)
  - Idempotency key on the money seam; never check-then-write availability (use the atomic `create_booking_hold` RPC).
- [ ] **Operator onboarding:** free, no commission shown anywhere. Gate listing behind existing verification.
- [ ] **Stay lean:** keep Supabase on free tier until there's real guest data worth backing up; flip to Pro only then. Vercel Pro required (commercial).

**Exit criteria:** a guest can book a verified property end-to-end, operator gets room money directly, Tuloy gets its fee, nothing is held.

---

## 5. Phase 2 — Instrument the milestone + build commission DORMANT

Goal: be ready to monetize operators without having promised or charged anything yet.

- [ ] **Liquidity dashboard (admin):** show the metrics that define "milestone" — active operators, completed bookings/month, bookings vs breakeven, guest-fee revenue. This is how the founder decides to flip, on evidence.
- [ ] **Commission engine, exercised at 0:** compute per-booking commission from `operator_commission_rate`. Build the calculation + a commission ledger NOW and run it live at rate `0`, so the code that will one day carry money is already tested in production at zero risk.
- [ ] **Rate history with effective dates:** store commission rate changes as `(rate, effective_from)` rows. Never retroactively recompute past bookings. A booking's commission is fixed by the rate in effect at booking time.
- [ ] **Notice mechanism (first-class, because you chose "all operators after notice"):**
  - Ability to schedule a future commission rate with an `effective_from` date.
  - Operator notification (email via Resend + in-app) sent ≥ N days before `effective_from`. Make N a config (recommend generous — 60–90 days).
  - Operators can see the upcoming change and the value Tuloy has delivered them (their bookings count/revenue) in the same view — this is the churn defense.

**Do NOT build commission _collection_ yet (see Phase 3).** Build calc + ledger + notice only. YAGNI on the collection rail until the flip is near.

---

## 6. Phase 3 — Flip commission on (only when milestone is hit)

**Stop-and-decide point — this is the real architectural fork.** In operator-as-merchant, room money goes straight to the operator, so you **cannot deduct commission at the source** the way a normal OTA does. The engineer must pick a collection mechanism with the founder before building:

- **Option A — PayMongo Platforms split (recommended for clean collection):** at flip time, migrate operators to sub-accounts; each booking splits room→operator minus platform fee→Tuloy in one transaction. Clean, no holding, no invoice-chasing. Cost: **₱75/sub-account/month** + onboarding friction. Only justified once bookings are real (which is the milestone, so timing fits).
- **Option B — Monthly commission invoice to operators:** use the dormant billing infra to bill accrued commission monthly. No payment-rail change, but introduces collection/non-payment risk and operator friction.
- **Option C — Fund it from the guest side:** raise/redirect part of the guest fee instead of charging operators. Keeps operators truly 0% (worth discussing — may be better than breaking the promise at all).

Then:

- [ ] Founder sets new rate + `effective_from` + triggers notice (Phase 2 mechanism).
- [ ] All operators notified ≥ N days ahead, with their delivered-value shown.
- [ ] On/after `effective_from`, bookings accrue commission via the chosen rail.
- [ ] Reconciliation report: accrued vs collected.

---

## 7. Guardrails — "don't tank, stay alive while small"

- **Breakeven monitor** on the admin dashboard: bookings this month vs fixed cost line. One glance = "are we alive."
- **Operator-as-merchant stays the default** until/unless you flip commission — it's what removes payout fees and float risk while small.
- **All pricing changes are config and reversible.** No pricing logic in deploys.
- **Don't pre-build the commission collection rail.** Calc/ledger/notice in Phase 2; collection rail only at Phase 3 when the milestone is near.
- **Keep infra on lean tiers** until guest data/volume justifies Pro.

## 8. Risk note (business — for the founder, not the engineer to solve)

"All operators after notice" is the **highest-churn** transition you could have chosen. The engineering above de-risks it mechanically (long notice, value-proof in the notice view, rate locked at booking time), but you also need to:

- Keep the launch commission **modest** (well below Booking.com's 15–18%) so "0% → small %" still beats every alternative the operator has. Going from free to a painful rate overnight is what triggers the viral betrayal post.
- Over-communicate **what Tuloy delivered** before you ever ask for a cut. Show them the bookings.
- Seriously consider Option C (fund commission from the guest side) — it may let you keep the "0% to operators, forever" promise intact and avoid the churn entirely. Revisit at milestone.

## 9. KPIs to track

Active operators · completed bookings/month · bookings vs breakeven · guest-fee revenue · (post-flip) commission accrued vs collected · **operator churn around the flip** (the number that tells you if the transition worked).
