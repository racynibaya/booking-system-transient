# Architecture Review & Build Plan: Phase 2b (per-tenant PayMongo)

Status: proposed. Drafted 2026-06-20. Phase 2a shipped & dormant in prod.

## Forces (what I'm optimizing for)

- **Money-critical correctness.** A wrong confirm or a leaked tenant key is a breach, not a bug.
  Idempotency (P10) and "what we record equals what was paid" (inv. 3) are already load-bearing.
- **Tenant isolation as a DB guarantee (P2), not an app convention.** Each operator's PayMongo
  credentials are the most sensitive per-tenant data we'll ever hold. The trust boundary must be
  auditable in one place.
- **One confirm contract, two callers (P7).** 2a already routes both the manual and the gateway
  path through the same confirm semantics. 2b must not fork that.
- **Simplest thing that works.** Solo build, real hotels onboarding. No speculative generality;
  no custom crypto we have to babysit if a native primitive does the job.
- **Shippable in slices.** Each step releasable on its own; the gateway stays env-gated/dormant in
  prod until a real Business-tier hotel is validated (≈₱15–25k WTP gate — non-code).
- **NOT optimizing for:** multi-gateway abstraction (PayMongo only), holding funds (we record,
  never custody — D8), or high-volume reconcile (one deposit per booking).

## How the system is structured today (confirmed map)

Multitenant modular monolith: Next.js App Router + Supabase Postgres. Isolation is RLS on a
denormalized `tenant_id`, uniform predicate `tenant_id = current_tenant_id()`.

**Data ownership.** All writes to money/booking state go through `SECURITY DEFINER` RPCs — app
code never check-then-writes (P1). `bookings`/`payments` are writer-controlled:

- `create_booking_hold` — the only booking writer.
- `confirm_booking` (operator, INVOKER) and `confirm_booking_gateway` (webhook, DEFINER,
  service_role) — the two confirm callers, same contract.
- `payments` is append-only (no update/delete grant); one deposit per booking (unique index).

**The seams 2a pre-cut for 2b** (all documented in code):

- `lib/paymongo/client.ts` — `createCheckoutSession({ secretKey, ... })`. **Never reads env**; the
  caller passes the key. 2b passes the tenant's decrypted key here _unchanged_.
- `app/[slug]/actions.ts:138` `createGatewayCheckout` — the ONE branch that changes: replace
  `env.PAYMONGO_SECRET_KEY` with a per-tenant connection lookup (gated on plan). Hold + metadata
  contract + webhook stay identical.
- `app/api/webhooks/paymongo/route.ts` — flat endpoint today; 2b moves to
  `/api/webhooks/paymongo/[token]` so the tenant connection's own `whsk_` verifies the event. The
  confirm call, idempotency, and 200/4xx/5xx classification are unchanged.
- `confirm_booking_gateway` already accepts everything 2b needs; **no change to the RPC.**

**Two distinct secrets (do not conflate):**

- PayMongo `sk_`/`whsk_` — the _hotel's credentials_. Per-tenant, encrypted at rest, service-role
  only.
- `webhook_token` — _our_ random URL id that routes an inbound webhook to one tenant. Not a
  secret in the crypto sense; it's an opaque, unguessable path segment. Verification still rests on
  the `whsk_` HMAC.

## Findings

The 2a codebase is in **better shape than a mid-build usually is** — I'm not manufacturing smells.
Two real structural gaps, both by-design deferrals from 2a, plus the genuinely new decision:

1. **[VERIFIED] No secret-at-rest mechanism exists.** `grep` for vault/pgcrypto/encrypt across
   migrations + app = nothing. Storing `sk_`/`whsk_` is net-new and is the one expensive-to-reverse
   decision in 2b (you can't cheaply re-encrypt a column scheme once live keys are in it). See the
   decision below — this gates everything.

2. **[VERIFIED] No `plan` gate on `tenants`.** `tenants` has `subscription_status`
   (`trialing`/...) and `verification_status`, but no Business/Free tier. The checkout action and
   connect-UI must gate on tier. Cheapest correct move: add `tenants.plan` enum
   (`'free' | 'business'`, default `'free'`); the connect-UI and `createGatewayCheckout` both check
   it. Low effort, additive.

3. **[VERIFIED] Lost-webhook safety net is a stub, not a sweep.** `route.ts:52` and the RPC comments
   point to "reconcile sweep (2b)". Today a paid-but-unconfirmed booking stays `held` and is never
   deleted (holds expire lazily) — so it's _recoverable_ but nothing recovers it. The sweep is the
   reconcile reader; it's independent of the connection plumbing and can land last.

4. **[VERIFIED] Refund-needed alerts are TODOs at the exact right seam.** `route.ts:73-79`:
   SLOT*TAKEN / AMOUNT_MISMATCH already return 200 (guest paid, we can't honor). 2b wires the
   operator "refund needed" + guest "you'll be refunded" emails \_here*. Pure additive behavior at a
   marked seam — no structural change.

No cycles, no wrong-direction deps, no leaky abstractions. The confirm contract holds.

## The one decision that's yours: how to encrypt tenant credentials

Everything else is determined by the existing seams. This isn't — it's a security/risk tradeoff,
and it's expensive to reverse once live keys are stored. Options in the question below.

## Recommendations

### Quick wins (additive, low-risk, do alongside)

- `tenants.plan` enum migration (finding 2).
- Refund-needed email templates + wiring at `route.ts` (finding 4) — can ship with or after the
  token webhook.

### Structural moves (ranked by impact × 1/effort), each shippable

**M1 — Connection storage + encryption (the foundation).** New table
`tenant_gateway_connections` (one row per tenant: provider, encrypted `sk_`/`whsk_`,
`webhook_token`, `webhook_id` from PayMongo, status, timestamps). RLS: **no operator grant at
all** — operators never read their own raw keys back; all access is service-role through a new
`lib/supabase/gateway-dal.ts` (mirrors the `admin-dal.ts` trust-boundary-in-one-module pattern).

- _Tradeoff:_ a service-role DAL is more privileged code to audit, but it keeps every raw-key read
  in one greppable module — strictly better than scattering service-role reads.
- _Step zero:_ characterization test the encrypt/decrypt round-trip before any UI touches it.

**M2 — Operator connect-UI (settings) + connection server action.** Operator pastes their `sk_`;
the action (a) test-validates it with a cheap authenticated PayMongo call, (b) auto-registers a
webhook via `POST /v1/webhooks` pointed at `/api/webhooks/paymongo/{token}` (the response's
`secret_key` IS the `whsk_`), (c) stores both encrypted + the `webhook_token`. Gated on
`plan='business'`.

- _Tradeoff:_ auto-registration means we own a side effect on PayMongo's side (a webhook they can
  also see in their dashboard) — but it removes the single most error-prone manual step (the 2a
  spike proved copy-pasting `whsk_` by hand is where things break).
- _New need:_ a stable public base URL for the registered webhook (env `NEXT_PUBLIC_SITE_URL` or
  derive-at-registration from request origin). Decide at M2.

**M3 — Token-routed webhook.** Add `app/api/webhooks/paymongo/[token]/route.ts`: look up the
connection by token (service-role), verify with _that_ connection's `whsk_`, then the existing
confirm + classification logic verbatim. Keep the flat 2a route until no tenant uses it (Strangler
Fig) — or, since the flat route is dormant/env-only, retire it once the token route is proven.

- _Tradeoff:_ a per-request DB lookup before signature verify (vs. 2a's env constant). Negligible;
  it's one indexed read on `webhook_token`.

**M4 — Pay-now UI + `pay/return` page.** Wire `createGatewayCheckout` to the connection lookup
(replace the env branch), surface a "Pay online" button on the booking flow for business-tier
hosts, and the `successUrl` return page (`/{slug}/pay/return`) the action already points at.

**M5 — Reconcile sweep (cron).** A scheduled job lists recent `held` bookings with a gateway
connection, queries PayMongo for a paid checkout/intent matching the booking metadata, and calls
`confirm_booking_gateway` (idempotent — safe to re-run). Catches any webhook PayMongo never
delivered. Independent; lands last.

**M6 — Signature timestamp tolerance.** Small hardening on `verifyWebhookSignature` (reject events
whose signed timestamp is outside a tolerance window) — pure behavior addition, fold into M3.

## Suggested sequence

```
quick: tenants.plan enum  ─┐
M1 connection store + crypto ──> M2 connect-UI ──> M3 token webhook ──> M4 Pay-now + return
                                                         │
                              M6 (fold into M3) ─────────┘
M5 reconcile sweep ────────────────────────────────────────────> (independent, last)
finding 4 refund alerts ───────────────────────────> (with M3 or after)
```

Why this order: M1 is the foundation everything reads. M2 produces the first real stored
connection. M3 makes inbound webhooks per-tenant. M4 lights up the guest-facing flow end-to-end —
that's the first slice you can demo to a Business-tier hotel. M5/refund-alerts are the safety net,
valuable but not on the critical path to a working paid booking. Each arrow is a releasable commit;
you can stop after any of them.
