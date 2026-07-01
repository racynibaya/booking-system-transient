# Tuloy — Build Checklist (2026-07-01)

Past + future builds at a glance. **Money/prod states marked ✓verified were confirmed from source
this session; everything else is from memory/docs and may lag — verify from ground truth before
acting on anything money- or prod-related** (git `main`, prod schema via `execute_sql`, `vercel env ls`).

---

## ✅ Shipped & live in prod
- [x] **M0–M2 core** — public listings + discovery; operator booking ops; **atomic no-double-booking** (`create_booking_hold`); calendar; deposits
- [x] **Guest deposit + GCash proof** flow
- [x] **Operator verification** — ID upload, admin review, request-changes, GCash re-verify
- [x] **Admin + role separation** (operator vs admin)
- [x] **Payment methods** (operator display/proof)
- [x] **Space + room photos, amenities**
- [x] **PWA polish** (192px icons, appleWebApp metadata)
- [x] **Commission cutover** — subscription → **2.5% commission = revenue**; pilot 0% founding-operator
- [x] **Operator OS** — inbox/inquiries, reviews + replies, insights, guest CRM, earnings, nav (merged to `main` 2026-07-01, `161ee13`)
- [x] **Xendit rail Slices 0–5 DEPLOYED DORMANT** — `XENDIT_*` unset, fail-closed. ✓verified prod: 3 seed tenants, **0 confirmed bookings**, public online-pay gate returns false (0 `kyc_status='LIVE'` sub-accounts)

## 🧊 Built but dormant / retired (hedge — do not revive)
- [~] **Subscription billing** (PayMongo one-tap + card recurring) — built, dormant, disabled-not-deleted
- [~] **Subscription enforcement** (entitlement + `create_booking_hold` guard) — built, dormant
- [~] **Centralized-aggregator payout rail** (PayMongo custody) — code stripped (`de3fc67`); only inert DB objects remain; **illegal (custody) — do NOT revive**

## ✅ Shipped to prod 2026-07-01 (this session)
- [x] **Xendit confirm-rail integration test** — custody-clean split, no `payout_ledger` accrual, idempotency, AMOUNT_MISMATCH (now on `main`)
- [x] **Slice A — legal/consent layer:**
  - [x] `tenant_consents` table + RLS (immutable, `payments`-style) + `recordConsent` + tests (5/5) — applied LOCAL
  - [x] **Terms (Part A + B)** + **Privacy** pages (editorial, on-brand) + footer links; content in `context/legal-content.md` (F3 commission clause corrected)
  - [x] **Consent captured at:** operator signup · operator first listing · Xendit KYC · **guest booking** (`bookings.terms_version`)
  - [x] Guest-booking `terms_version` migration — applied LOCAL, verified (11/11 integration tests, typecheck clean)
  - [x] **DEPLOYED TO PROD** 2026-07-01 — PR #120, `main a0948d8`; 2 migrations applied via MCP; `/terms` + `/privacy` live (HTTP 200)
  - [x] **Lawyer sign-off** — DEFERRED to scale (budget); shipping the lawyer-derived pilot terms as-is (Racyn's call 2026-07-01)
  - [ ] Real **DPO email** (placeholder `privacy@tuloysanjuan.com`) — swap when a mailbox exists

## 💸 Money rail — SHIPPED TODAY (dormant) + remaining
Plan: `~/.claude/plans/reactive-cooking-meteor.md` · Xendit answers: `xendit-managed-answers.md`
**Decisions (2026-07-01):** MANAGED sub-accounts · both operator types (INDIVIDUAL + SOLE_PROPRIETORSHIP, branched) · **QR Ph only** (1.4% + 12% VAT, ₱15 floor) · refund = **operator absorbs the 2.5%** · build-to-template, adjust on first live operator.
- [x] **Gate G2** — RESOLVED: one-time operator invite+register accepted (MANAGED); individuals eligible
- [x] **Slice B** — MANAGED operator sign-up (both entity types, new `account_verification` payload, invite→REGISTERED gate, new onboarding form) — **SHIPPED DORMANT** 2026-07-01 (PR #123, `main e56f1f2`); typecheck + 155 unit tests green
- [x] **Slice C** — QR Ph fee math (real rate + 12% VAT + ₱15 floor, shared `xenditFee` helper) — **SHIPPED DORMANT** 2026-07-01 (same PR)
- [ ] **Slice D** — guest online-payment button cutover — needs 1 operator LIVE first
  - ✅ **Rail sandbox-verified 2026-07-01** (`scripts/xendit-rail-demo.mjs` w/ test key): sub-account + 2.5% split + real guest checkout link, amount correct (₱2,031.86)
  - ⚠️ **Build note 1:** split-rule name/description must be **letters/numbers/spaces only** (`^[a-zA-Z0-9 ]+$`) — `createSplitRule` caller must sanitize (caught a live 400)
  - ⚠️ **Build note 2:** **QR-Ph-only** is NOT a per-session field (tried `allowed_payment_channels` + `payment_methods`, both ignored) — restrict by **activating only QR Ph on the operator sub-account**, or confirm the exact field with Xendit
- [~] **Slice E** — refunds: "operator absorbs" = current full-refund-from-sub-account behaviour is correct; commission clawback is **MANUAL** (Xendit never auto-reverses). Remaining: partial refunds (gated on Xendit's window answer)
- [ ] **Slice F** — drop inert aggregator DB objects — **SKIPPED** (payout_ledger still wired into the live `confirm_booking_gateway`; not worth touching for inert cleanup)
- [ ] **Ops** — set `XENDIT_*` on prod · register webhooks · key perms (Payouts=Write / Balance=Read) · XenPlatform activation (self-serve) · 1 real operator LIVE + 1 real booking

## 📄 External / paperwork (not code)
- [ ] **BIR 2303** (Tuloy) — hard blocker before rail go-live
- [ ] **Mayor's / business permit** — hard blocker
- [ ] **NPC registration** — deferred (revisit at 20+ operators or 100+ guests/month)
- [ ] **Operator agreement + guest ToS/DPA** finalized with lawyer
- [~] **Xendit answers** — MOST now answered (`xendit-managed-answers.md`): KYC payload, QR Ph rate, payout fees, webhooks, test-mode limit, VAT. STILL get-in-writing: **chargeback liability**, **Master entity (sole prop vs corp)**, settlement timing, payout minimums, partial-refund window, KYC review time

## 🎯 The real gate (not code)
- [ ] **Validate paying demand** — 1 paying operator + 1 confirmed booking. This is the actual open risk, not the engineering.
