# 01 — The Product (business, users, journeys, revenue)

> Read `00-START-HERE.md` first. This file explains _what_ Tuloy is and _why_, with no code.

---

## The problem Tuloy solves

San Juan, La Union is the #1 overnight destination in the province (~211k visitors/yr) with **250+
small accommodation operators**. The entire booking experience runs off-platform:

- **Tourists** can't reliably discover places, see real availability, or book and pay in one flow.
  They DM a dozen Facebook pages asking "is X date free?" and wait. There's no single place to compare
  and book San Juan stays.
- **Operators** manage bookings in notebooks and chat threads. They double-book, lose inquiries, chase
  GCash screenshots, and eat no-shows. Some pay ~₱300/day _just for someone to answer inquiries_.

The big OTAs (Agoda, Booking.com) technically cover San Juan but charge **15–25% commission** and treat
the town as a rounding error — generic, not local, expensive.

---

## The vision

**Tuloy is the one place to discover and book San Juan accommodations** — a focused, _local_ OTA that
is dramatically cheaper for operators than the global OTAs and far more trustworthy and organized than
the Facebook-group status quo. We win by being **local and centralized**: one search, one checkout,
verified operators, real enforced availability, and a take rate (~11% all-in) that undercuts Agoda.

**Why it can work where a generic marketplace can't:** Tuloy rides in on operators' _existing_ Facebook
funnels. Operators already drive demand to their own pages; Tuloy converts that demand into clean, paid,
double-booking-proof reservations and aggregates supply into one searchable place.

**Scope guardrail: San Juan only.** Depth in one town beats breadth. Baguio / Siargao / other La Union
towns are explicitly _later_, only after the San Juan model is proven. (This is the one strategic
decision — "D9" — that survived every pivot unchanged.)

---

## The business model, and its three eras

You must hold all three in your head because the codebase contains all three (see `07-pivots-and-dead-code.md`).

| Era                                     | Model                                                                                                                                     | Who paid                                               | Status                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| **1. Commission-free SaaS**             | Flat **subscription**, room-gated (Solo ₱990 / Pro ₱2,500 / Business). "Never a commission" was the _identity_ — the wedge against Agoda. | Operator pays Tuloy monthly                            | ❌ Retired, kept dormant as a hedge                            |
| **2. Operator-as-merchant ("Model A")** | Each operator connects their own PayMongo; Tuloy never touches money (avoids PH marketplace-of-record compliance).                        | Guest → operator's own gateway                         | ❌ Superseded, dormant                                         |
| **3. Commission OTA (current intent)**  | Tuloy collects guest payment centrally, takes **~11%**, disburses the operator's share to their GCash/bank.                               | Guest pays Tuloy; Tuloy pays operator minus commission | ✅ Intended model — **built, unmerged, blocked on compliance** |

**The pivot reason** (worth internalizing): a near-signed operator churned because they couldn't pay a
subscription _before seeing value_ — but _would_ pay by commission. Non-techy operators also can't
self-serve an `sk_`-key gateway. Commission removes both: join with just a GCash number.

---

## Target users

1. **Operators (owners)** — the small San Juan accommodation businesses. _SaaS-era: the paying customer.
   OTA-era: the supply side._
2. **Tourists (guests)** — surf/beach visitors. _SaaS-era: incidental. OTA-era: the headline user the
   marketplace is built for._
3. **Admin (you)** — operator verification, payout-rate management, refunds.

> The pivot **flipped who the product is for.** SaaS-era the operator was the customer; OTA-era the
> tourist is the product's user and the operator is supporting infrastructure that keeps supply healthy.

---

## The three journeys

### Tourist (guest)

discover/search San Juan → open a property's booking page → pick dates → **checkout** (pays a _deposit +
service fee_ to Tuloy; the balance is settled at check-in) → an atomic hold prevents double-booking →
payment clears → guest + operator both notified, slot locked.

Guests can also pay **manually** (send GCash to the operator's QR, upload a screenshot as proof) — this
is the path live in prod today; online card/checkout is the commission-era path.

### Operator (owner)

set up property/rooms → manage **one availability calendar** (the single source of truth) → receive
bookings on a dashboard (statuses, deposits, cancellations, manual walk-in entry) → **get-paid
onboarding** = just a GCash/bank number (no PayMongo account, no KYC on their side) → get disbursed
their share (~T+2). Plus **verification** (upload gov ID / permit / property proof) — the anti-scam
trust signal that makes the marketplace better than faceless FB pages.

### Admin (you)

verify operators (approve / request-changes / suspend) → manage **per-owner** commission/service-fee
rates (operators _cannot_ edit their own — column-level grants block it) → issue refunds, with
**clawback** if the operator was already paid out.

---

## Revenue model

**Intended (commission):** ~11% of stay value `S` = **5% operator commission** (deducted from the
operator's payout) + **6% guest service fee** (added to the guest's charge). Both are sized on the full
stay `S` but collected through the **deposit** transaction (no full-payment-online required). PayMongo's
processing fee is **passed through to the guest** (grossed up), so it's _not_ a Tuloy margin. Single
source of truth in code: `lib/pricing.ts → computeBookingSplit`. The early-adopter promise = a reduced
**2.5%** commission, set **per-owner** on their payout account row.

**Actually earning today:** effectively nothing live — subscription is dormant, commission isn't shipped.
You are pre-revenue on the new model, running toward a 2–3 operator pilot.

See `08-money-and-compliance.md` for the exact math.

---

## MVP scope / what's actually shipped

**Live in prod (on `main`):** public listings + marketplace browse, per-operator booking pages, the
atomic no-double-book engine, manual-pay (GCash QR + proof upload), operator dashboard/calendar/bookings,
manual walk-in booking entry, operator verification, email notifications, OG share previews. Plus the
**dormant** subscription billing + enforcement + Model A gateway. **2 live operators.**

**Built but parked on the branch (`feat/payout-disbursement`, not deployed):** centralized online
checkout, payout ledger + disbursement state machine + daily payout cron, admin refund/clawback, operator
earnings view, landing-page refresh. Verified against the PayMongo sandbox; dormant via unset env keys.

---

## Self-check

1. Who was the paying customer in the SaaS era, and who is the product _for_ in the OTA era?
2. What does an operator have to provide to get paid in the commission model — and why is that
   deliberately so minimal?
3. Where does Tuloy's ~11% come from (which two pieces), and which one does the guest see vs. the
   operator absorb?

## Flagged inconsistencies / your decisions

- 🟡 **Deposit %**: `DESIGN.md` examples use both 30% and 50% in different places. In code it's a
  per-property `deposit_percent`, not a fixed number — don't anchor on either figure.
- 🟡 **Early-adopter promise** changed form across pivots: was "50% lifetime subscription discount,"
  now "2.5% commission rate per owner." Make sure your FB marketing messaging matches the _current_ one.
- 🟢 **Demand acquisition is now your burden** (OTA reality). The riskiest unvalidated assumption is
  whether tourists will book on Tuloy instead of Messenger. The pilot tests exactly this.
