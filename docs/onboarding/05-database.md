# 05 — Database (business meaning, not just columns)

> Postgres on Supabase. Multi-tenant, shared DB, `tenant_id` everywhere, RLS on `current_tenant_id()`.
> ⚠️ Migration history has drifted from prod — to check what's _actually_ on prod, query
> `pg_proc` / `information_schema` via MCP `execute_sql`, **not** `list_migrations`. Migration filenames
> below are for code-reading, not a guarantee of prod state.

---

## Tables, grouped by era

### Booking core (live everywhere)

| Table                      | What it means (business)                                                | Key columns                                                                                                                                       | Notes                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tenants**                | An operator account (1:1 with an auth user). The isolation root.        | `id`, `user_id`, `is_admin`, `verification_status`                                                                                                | `is_admin` / `verification_status` are **service-role-only** (operators can't self-approve/escalate). The composite FK target for child tables.                      |
| **properties**             | A place an operator runs; parent of bookable inventory.                 | `id`, `tenant_id`, `slug` (globally unique), `deposit_percent`, `min_stay_nights`, `amenities` (JSONB), `photos` (JSONB)                          | `slug` is a **public contract** (booking URLs pin it) — treat as one-way.                                                                                            |
| **room_types**             | A sellable unit _category_ ("Deluxe Twin"). Inventory count lives here. | `id`, `tenant_id`, `property_id`, `quantity`, `base_price`                                                                                        | `quantity` = number of identical interchangeable units.                                                                                                              |
| **bookings**               | The reservation + money lifecycle — the money record.                   | `id`, `tenant_id`, `room_type_id`, `status`, `check_in`/`check_out`, `total_amount`, `deposit_amount`, `hold_expires_at`, `gateway_charge_amount` | Half-open `[check_in, check_out)`. `gateway_charge_amount` = the grossed-up centralized charge (NULL for manual/Model A). **INSERT only via `create_booking_hold`.** |
| **availability_blocks**    | Operator marks dates unavailable (maintenance/personal use).            | `id`, `tenant_id`, `room_type_id`, `start_date`, `end_date`                                                                                       | Half-open; counts as occupied in the availability predicate.                                                                                                         |
| **payments**               | Immutable money record — one per booking per kind.                      | `id`, `tenant_id`, `booking_id`, `amount`, `kind` (deposit/balance), `provider`, `provider_ref`, `proof_url`, `raw_payload`                       | Records **confirmed money only**. Unique index = **one deposit per booking** (P4). Insert-only (no update/delete).                                                   |
| **tenant_payment_methods** | Operator's guest-facing payout accounts (GCash/Maya/bank + QR).         | `id`, `tenant_id`, `type`, `account_name`, `account_number`, `qr_path`, `sort_order`                                                              | What the guest pays into on the **manual** path. A change trips the re-verify flag.                                                                                  |

### Verification (live)

Verification state lives on `tenants.verification_status` (`pending` / `approved` / `suspended` /
`changes_requested`) plus uploaded docs in the private `verification-docs` Storage bucket. Gates public
visibility.

### Commission / payout (🟣 branch only — NOT on `main`)

| Table                      | What it means                                                                     | Key columns                                                                                                                                                            | Notes                                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tenant_payout_accounts** | Where Tuloy **sends** the operator's share, + that operator's pricing.            | `id`, `tenant_id` (unique), `method` (gcash/bank), `account_number`, `payout_name`, `commission_rate` (def 5%), `service_fee_rate` (def 6%), `status` (active/failed)  | Holds **no secrets** (unlike Model A). `commission_rate`/`service_fee_rate` are **column-level read-only to operators** — admin-set early-adopter discounts (→ 2.5%) live here. `payout_name` must match the recipient's ID. |
| **payout_ledger**          | The money-OUT accrual + state machine; one row per confirmed centralized booking. | `id`, `tenant_id`, `booking_id` (unique), `status`, `owner_payout`, `operator_commission`, `guest_service_fee`, `paymongo_fee`, `clear_eta`, `payout_id`, `payout_ref` | Unique on `booking_id` = **one accrual per booking** (P4). Written atomically inside `confirm_booking_gateway`.                                                                                                              |

### Subscription (🟡 dormant on `main`, ⚫ dropped on branch)

| Table / object                                                          | What it was                                                                                              | State                                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **subscription_payments**                                               | Ledger of operator→Tuloy subscription payments.                                                          | On `main`; dropped on branch (`20260626161000`).                                                                                     |
| **billing_config** (single row)                                         | Enforcement switch: `enforcement_mode` (off/dry_run/enforce), `require_activation`, `grace_period_days`. | On `main`, seeded `off` (dormant). Dropped on branch (`20260626160900`).                                                             |
| **tenant_subscription_entitlement** (view)                              | "Can this operator accept bookings?" (lapse + grace).                                                    | On `main`; dropped on branch.                                                                                                        |
| `tenants.plan` / `subscription_status` / `paid_until` / `trial_ends_at` | Room-gated tier + billing state columns.                                                                 | On `main`; **columns dropped on branch** (`20260626161000`). ⚠️ Code that reads `tenants.plan` must tolerate its absence post-merge. |

### Model A — operator-as-merchant (🟡 dormant on `main`, ⚫ dropped on branch)

| Table                          | What it was                                                  | State                                                                                        |
| ------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **tenant_gateway_connections** | Per-tenant PayMongo `sk_`/`whsk_` secrets (Vault-encrypted). | On `main`; dropped on branch (`20260626161200`). The whole "connect your own gateway" model. |

---

## Key functions (RPCs) and the invariant each protects

| Function                                                               | Security | What it does / protects                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`current_tenant_id()`**                                              | INVOKER  | Resolves auth user → `tenant_id`. The single source of RLS scoping (P2).                                                                                                                                                                                                                      |
| **`create_booking_hold(...)`**                                         | DEFINER  | The **only** booking writer. Advisory lock + overlap count vs `quantity` + block check, stamps total/deposit — atomic. **No double-booking (P1).** Granted to anon (public booking) + authenticated (manual entry).                                                                           |
| **`confirm_booking_gateway(booking, provider, ref, amount, payload)`** | DEFINER  | Webhook-only. **Amount guard:** settled == `coalesce(gateway_charge_amount, deposit_amount)` else refuse. Flips `→ confirmed`, inserts the deposit payment, and (if centralized) writes the `payout_ledger` accrual using the per-owner rates — all atomic. Idempotent via status guard (P4). |
| **`confirm_booking(booking)`**                                         | INVOKER  | Operator's manual confirm (RLS-scoped). `awaiting_confirmation → confirmed`; returns null on re-call so emails fire once.                                                                                                                                                                     |
| **`claim_due_payouts()`**                                              | DEFINER  | Per tenant, atomically `clearing → payable` (ETA passed) under one fresh `payout_id`; skips inactive payout accounts. **Claim-once → double-pay impossible (P6).**                                                                                                                            |
| **`mark_payout_paid(id, ref)` / `mark_payout_failed(id, reason)`**     | DEFINER  | Settle the claimed batch; only touch `payable` rows for that `payout_id`.                                                                                                                                                                                                                     |
| **`reconcile_disbursement(id, ok, reason)`**                           | DEFINER  | Async transfer-status callback; on failure flips `paid → failed`, flags the payout account, alerts admin.                                                                                                                                                                                     |
| **`claim_refund` / `finish_refund` / `abort_refund`**                  | DEFINER  | Refund state machine: `refunding → refunded` (clean) or `→ clawed_back` (operator already paid). Guest refunded at most once.                                                                                                                                                                 |
| **`get_public_listing(slug)` / `list_public_listings()`**              | DEFINER  | Anonymous read paths; return public-safe fields only, gated on `verification_status='approved'`. `list_public_listings` shuffles stably per-day so no operator is pinned.                                                                                                                     |
| **`set_tenant_verification` / `is_current_user_admin`**                | DEFINER  | Admin-only verification control, self-guarded on admin check.                                                                                                                                                                                                                                 |

---

## Payout ledger state machine (🟣)

```
                 confirm_booking_gateway
                          │
                          ▼
                       CLEARING            (funds not yet available; clear_eta = now + 3 banking days)
                          │  [now ≥ clear_eta]
                          ▼
   claim_due_payouts ─► PAYABLE  (+ payout_id)
                          │  [PayMongo batch transfer]
              ┌───────────┴───────────┐
   mark_payout_paid              mark_payout_failed
              ▼                         ▼
            PAID                      FAILED  ──► (retry / operator re-accrue)
              │
   admin refund ─► claim_refund / finish_refund
              ├─► REFUNDED      (operator was NOT paid — clean)
              └─► CLAWED_BACK   (operator already paid — recover from next payout, manual v1)
```

---

## RLS & tenant isolation (the rules that keep operators apart)

- Uniform predicate `tenant_id = current_tenant_id()` on every operator table.
- **Column-level grants** protect money/trust fields: operators can't write `commission_rate` /
  `service_fee_rate` (payout accounts) or `is_admin` / `verification_status` (tenants).
- **Service-role** (webhooks, crons, admin actions) bypasses RLS; every such function is `SECURITY
DEFINER` + hardened (empty `search_path`, schema-qualified names).

---

## Self-check

1. Which table is on the **branch only** and would not exist if you queried prod today —
   `payout_ledger` or `payments`?
2. What stops an operator from setting their own commission to 0%?
3. Where is the no-double-booking rule actually enforced — in the app, or in the database?

## Flagged inconsistencies / your decisions

- 🔴 **Migration list ≠ prod reality.** The SG project's `schema_migrations` is incomplete from drift —
  always confirm objects via `execute_sql` against `pg_proc`/`information_schema`, never `list_migrations`.
- 🟡 The branch **drops `tenants.plan`** (and sibling columns). Any `main` code path still reading them
  will break on merge — grep for `.plan`/`subscription_status` before merging (`07` lists the call sites).
- 🟡 `clear_eta = now + 3 banking days` is a heuristic that **does not model PH holidays** — a payout
  could be claimed a day or two before funds truly clear. Low risk at pilot scale; note it.
