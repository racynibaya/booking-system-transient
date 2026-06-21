# Demo-readiness plan — pilot operator, this week

**The bar:** the operator's own real listing is live on prod, and we can run a real booking from a
phone — hold → deposit → confirm → both emails land — without a stumble. Reliability beats surface
area. Three things flawless beats ten things shaky.

**One thing to confirm first:** is the pilot a small transient or a hotel? Per strategy, PayMongo
gateway is Business/hotel tier only; small transients run on GCash + proof. That decides which
payment path we rehearse. The rest of this plan assumes GCash + proof unless it's a hotel.

---

## A. Ship what's built to prod (it's currently local/uncommitted)

These all need your explicit go — they touch prod.

- Commit Phase 2 off `feat/gateway-confirm-engine` and deploy. Migrations via MCP `apply_migration`,
  not `supabase db push` (prod history is out of sync — db push would re-run).
- Turn on real email send: `RESEND_API_KEY` + prod `EMAIL_FROM`. Confirmation emails are part of the
  wow; right now real send is gated.
- Fix the 2 failing `public-booking` tests (the seed-tenant-not-approved one-liner). Green tests
  before we touch prod.

## B. Get the operator actually live

- Load their **real** property: rooms, photos, real rates, real GCash details. Not "San Juan
  Transient #1." Their own place on screen is what closes it.
- **Set their tenant `verification_status = 'approved'`.** Hidden blocker: `get_public_listing`
  returns nothing for an unapproved tenant, so their booking page would be blank without this.
- Confirm `deposit_percent` and payment-method settings are filled in for their tenant.
- Set your own account `is_admin = true` on prod (one-time) so you can drive the admin/confirm side.

## C. Prove the path end-to-end on prod (the rehearsal, not the demo)

- Real signup/login click-through on cloud (auth email click-through is currently unverified).
- Drive one real booking **from a phone**: pick dates → hold → GCash deposit + proof upload →
  operator sees it → Confirm → guest + operator emails both arrive.
- Check the public booking page renders cleanly on **mobile** — guests and operators are phone-first,
  and the booking-page link is the single biggest wow.

## D. Polish the surfaces they'll actually see (only after A–C work)

- The public booking page, the bookings board, the calendar. Tighten what the operator looks at.
  No new features — visual clarity only.

## E. Dress rehearsal (day before)

- Run the full flow end-to-end **twice**, on the actual demo device and network.
- Map each click to the pain it kills: double-booking ("sino unang dumating"), GCash-screenshot
  chasing, lost inquiries. The demo should make each one visibly disappear.
- Have a fallback: a pre-recorded clip or screenshots of the happy path, in case live wifi dies.

---

## Where it's most likely to break (watch these)

- **The verification gate** (B) — blank booking page if missed.
- **Mobile rendering** of the booking page — desktop-fine ≠ phone-fine.
- **Email deliverability** — first real send can land in spam; test to a real inbox early.
- **Prod data reset** — prod was reset to near-empty recently; don't let that happen again pre-demo.
- **Wrong payment path** — demoing PayMongo to a small transient, or GCash-only to a hotel.

## Out of scope this week (resist building these)

BIR receipts, multi-staff logins, reporting, billing automation. None are needed to win the pilot,
and the strategy says validate first. Don't pour hotel concrete before the operator says yes.
