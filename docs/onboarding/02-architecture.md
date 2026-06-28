# 02 — Architecture (the module map + the invariants)

> The structural decisions mostly **predate the pivot and survive it**: a relational, transactional
> booking core is correct whether the buyer is an operator (SaaS) or a tourist (OTA). Don't rip out good
> architecture because the business model changed.

---

## The module map

```
Tuloy
│
├── Authentication        Supabase Auth (email + password). Roles: operator / admin.
│                         current_tenant_id() resolves a logged-in user → their tenant row.
│
├── Listings              Properties + room types + photos + availability blocks.
│                         Operator-managed; the listings ARE the marketplace inventory.
│
├── Availability          THE integrity guarantee. One calendar per property; the single source
│   (engine)              of truth for what's bookable. Enforced by create_booking_hold (atomic).
│
├── Booking               Reservation lifecycle: pending → held → awaiting_confirmation →
│                         confirmed → completed (or cancelled / expired / no_show).
│                         One writer (create_booking_hold) for guests AND operator manual entry.
│
├── Payments              Guest deposit + balance. Manual (GCash QR + proof) path is LIVE in prod.
│   (+ aggregator)        Centralized online checkout + payout ledger + disbursement = BRANCH only.
│
├── Marketplace           Public discovery grid (/) + per-property booking pages (/[slug]).
│                         Daily fair-shuffle so no operator is permanently pinned.
│
├── Verification          Operator uploads gov ID / permit / property proof; admin approves.
│                         Only approved operators appear publicly. The anti-scam trust layer.
│
├── Notifications         Resend email: guest acknowledge/confirm/cancel/reminder, operator booking,
│                         admin payout-failure alerts. (Dry-run with no API key.)
│
├── Dashboard             Operator home (money cards, occupancy, needs-action) + bookings table +
│                         settings (payment methods, payout account) + earnings (branch).
│
├── Admin                 Operator approval queue + financial dashboard + refund tool (branch).
│
└── Infrastructure        Next.js 16 (modified build) on Vercel · Supabase Postgres + RLS + Storage ·
                          PayMongo · env-gated money rails.
```

---

## Components & responsibilities (who owns which writes)

| Component                    | Owns                                                                     | Key files                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Marketplace web (public)** | Tourist discovery + per-property booking pages + checkout                | `app/page.tsx`, `app/[slug]/`, `components/marketplace/`, `components/public/`  |
| **Operator dashboard**       | Listings, calendar, bookings, settings, earnings                         | `app/(app)/`, `components/{dashboard,bookings,properties,settings,earnings}/`   |
| **Admin**                    | Verification, financial overview, refunds                                | `app/(admin)/`, `components/admin/`, `lib/supabase/admin-dal.ts`                |
| **Availability engine**      | The no-double-book invariant; the one booking writer                     | `create_booking_hold` RPC, `lib/availability.ts`                                |
| **Payments / aggregator**    | Deposit intents, idempotent webhook confirm, payout ledger, disbursement | `lib/paymongo/`, `app/api/webhooks/`, `app/api/cron/payouts/`, `lib/pricing.ts` |
| **Notifications**            | Transactional email                                                      | `lib/email/`                                                                    |
| **Postgres (Supabase)**      | System of record                                                         | `supabase/migrations/`                                                          |

**Write ownership is clean:** the Availability engine is the only writer of booking holds; Payments owns
payment/ledger writes. No shared-write data → no race surprises.

---

## The invariants (the things that must never break)

These are what make Tuloy _trustworthy_ — they're the product, not nice-to-haves. Tests and care
concentrate here (availability + payments); the rest is intentionally not gold-plated.

### P1 — No double-booking

The whole product promises this. Enforced by **`create_booking_hold`** (a single atomic RPC,
`SECURITY DEFINER`): it serializes on the room with an advisory lock, counts overlapping _live_ holds
(`held` / `awaiting_confirmation` / `confirmed`) against `room_type.quantity`, rejects on overlap with
`availability_blocks`, and stamps total/deposit — all in one transaction. **Never check-then-write.**
Worst case (two guests, last unit): only one hold succeeds; the other gets "just taken."

### P2 — Tenant isolation

RLS on every table: `tenant_id = current_tenant_id()`. Operators never see another operator's data.
Service-role (admin/webhook/cron paths) bypasses RLS deliberately and is `SECURITY DEFINER` + hardened.

### P3 — Money columns are admin-only

`tenant_payout_accounts.commission_rate` / `service_fee_rate` are **column-level read-only** to
operators — they can't discount themselves. `tenants.is_admin` / `verification_status` are
service-role-only — an operator can't self-approve or self-escalate.

### P4 — Idempotency at every money/webhook seam

Webhook handlers are keyed on state, so a replay is a no-op:

- `confirm_booking_gateway` only confirms a `held` booking; a second call on a `confirmed` row returns
  null → emails fire once, accrual written once.
- `payments` has a unique index = **one deposit per booking**.
- `payout_ledger` has a unique index = **one accrual per booking**.

### P5 — Server-authoritative validation at the trust boundary

Guest input (public booking) and operator input (manual booking) are validated in both the action _and_
the RPC (min stay, availability, capacity). `lib/pricing.ts` mirrors the SQL math so the UI shows the
guest the same figures the RPC will record — guarded by a TS↔SQL parity test.

### P6 — Payout: double-pay is impossible by construction

`claim_due_payouts` atomically moves a tenant's cleared rows `clearing → payable` under one fresh
`payout_id`; a concurrent run claims 0 rows. `mark_payout_paid` only updates `payable` rows for that
`payout_id`. The `payout_id` is the PayMongo `reference_number` → the same batch can't pay twice.

---

## Key flow (the critical path), at altitude

```
Guest picks property + dates
        │
        ▼
create_booking_hold  ──►  atomic hold (locks the slot, stamps total/deposit)   [P1]
        │
        ▼
guest pays  ──►  (manual: GCash + proof upload)  OR  (online: PayMongo checkout)
        │
        ▼
confirm  ──►  booking = confirmed; payout accrual written atomically (online path)  [P4]
        │
        ▼
notify guest + operator        ──►  later: daily payout cron disburses operator share  [P6]
```

No charge without a held slot; hold expiry frees abandoned carts. "Payment ok but slot gone" is
impossible because we hold _before_ charging.

---

## Non-functionals (right-sized — this is not web-scale)

- **Scale:** hundreds of operators, low-thousands of bookings/mo. One Postgres + a normal web app is
  plenty. Don't build for scale you don't have.
- **Correctness > everything** for availability, payment state, payout state.
- **Security:** offload card handling to the gateway (minimal PCI scope); RLS for isolation; validate all
  public input.
- **Tech constraint:** this is a **modified Next.js 16 build** — APIs/conventions differ from standard.
  Read `node_modules/next/dist/docs/` before writing Next code; don't assume framework APIs from memory.

---

## Self-check

1. Which single function is the _only_ writer of booking holds, and why does that matter for P1?
2. What makes a replayed PayMongo webhook safe (no duplicate emails, no double accrual)?
3. Why can't a payout be paid twice, even if the cron runs concurrently?

## Flagged inconsistencies / your decisions

- 🟢 The architecture is sound and survives the pivot — nothing here needs ripping out.
- 🟡 The payout/aggregator half of "Payments" only exists on the branch. On `main`, "Payments" = the
  manual GCash-proof path only. Keep that distinction when reasoning about prod.
