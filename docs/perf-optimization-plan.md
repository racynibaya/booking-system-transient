# Performance Optimization — Execution Brief

**Status:** open · **Owner branch:** `ai-agent-perf` (create off `main`) · **Last updated:** 2026-07-01

This is a self-contained brief so anyone (or any agent) can pick up a task without prior context.
Read **§1 Safety** and **§2 Verified findings** before touching code. Claim a task by putting your
name/branch in its **Status** cell (`claimed by …` → `in progress` → `done + PR #`). Independent tasks
can run in parallel; watch the **Depends on** and **File-collision** notes so two people don't fight over
`components/public/booking-card.tsx`.

---

## 0. Goal & the one thing to understand first

Make the **guest-facing property page edge-cacheable** (fast globally, less DB load) and **trim client JS
on the acquisition pages** — WITHOUT weakening the no-double-booking guarantee.

The perceived "lag" is **location, not a defect**: compute is Vercel `sin1` (Singapore) and the DB is
Singapore — optimal for the Philippine audience (~40–60ms). It feels slow only when testing from far away
(e.g. Canada, ~200–250ms to SG). **Do NOT move infra off Singapore.** Measured on prod:
edge/cached TTFB ~117ms vs a Singapore-function dynamic route ~330–490ms — that delta is the round trip,
and it disappears for users near Singapore. The win here is making public pages _cacheable_ so they serve
from the edge for everyone.

Why the app is "mostly dynamic" despite being Next.js: the App Router only prerenders a route that touches
no request-time data. Authenticated pages call `createClient()` (`lib/supabase/server.ts:11` → `await
cookies()`) → dynamic **by necessity**. Only the marketplace home (`app/page.tsx`) caches
(`revalidate=3600`). The public property page _could_ cache but opts into dynamic. That's the target.

---

## 1. Safety constraints (NON-NEGOTIABLE)

- **`create_booking_hold`** (`app/[slug]/actions.ts`) is the atomic, always-live booking gate. It must
  never be cached, and must stay the single source of truth for availability at write time.
- **Never cache availability or money/payout data.** A stale cached _calendar_ can only cause a _failed
  hold_ (already handled in-UI: "this slot may have just been booked by someone else",
  `components/public/booking-card.tsx:222`) — never a double-booking. Keep it that way.
- **Never cache per-user / authenticated pages** (operator app, admin) — they read cookies and live money.
- **Don't move infra off Singapore.** Don't gold-plate the dashboards.
- **A DB migration must be applied to prod migration-first** (via MCP `apply_migration`, project
  `bkzyunojbtymfnfbecli`), before the code that uses it merges to `main`. Verify the target with
  `get_project_url` first (MCP has bound to the wrong project before).

---

## 2. Verified findings (the code map — don't re-derive)

- `app/[slug]/page.tsx` — public property page.
  - `getListing` (line ~56) calls `get_public_listing` + `get_public_reviews` and is **NOT memoized** →
    `generateMetadata` (line ~123) and the page body (line ~165) each run it = **double queries per view**.
  - **`get_public_listing`** (migration `supabase/migrations/20260617110459_public_booking.sql`)
    **embeds volatile availability** per room: `held`/`confirmed` booking dates + `availability_blocks`.
    `BookingCard` (`react-day-picker`) greys out booked days from this. Holds expire on a **timer**
    (`hold_expires_at`) with **no write event** → on-demand revalidation can't keep an ISR cache fresh.
    This is why you can't just ISR the whole page.
  - Dynamic blockers on the page: `searchParams.src` (attribution, line ~172) and the admin-preview
    `createClient()` branch (lines ~73–79).
- `app/page.tsx` (marketplace home) — already ISR `revalidate=3600`, anon `list_public_listings`. Fine.
- Client deps that matter: **`motion` (^12.40)** drives `components/motion.tsx` (`Reveal`/`Stagger`,
  decorative) on the public home + listing pages; **`react-day-picker` (^10)** is the booking calendar.
  No other heavy libs on the public surface. `LocationMap` is a plain `<iframe>` (fine).
- **Fork constraint:** in dev, pages are ALWAYS rendered on-demand and never cached
  (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`). So caching behavior
  must be verified from a **`next build` / Vercel preview**, not `npm run dev`.
- Local `next build` is blocked by an env guard when `NEXT_PUBLIC_SUPABASE_URL` is local — rely on the
  **Vercel preview deployment** (per-PR) to verify caching (`x-vercel-cache`, TTFB, build route table).

---

## 3. Tasks

| ID     | Task                                                                                                                                                                                                                                                                                        | Key files                                                                                                                            | Risk                 | Depends on | Status   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ---------- | -------- |
| **A1** | Memoize `getListing` with React `cache()` (kills metadata+page double-fetch)                                                                                                                                                                                                                | `app/[slug]/page.tsx`                                                                                                                | none                 | —          | open     |
| **A2** | New anon RPC `get_listing_availability(p_slug)` (per-room held/confirmed dates + blocks) + a static-only listing RPC; keep `get_public_listing` intact until BookingCard migrates (additive)                                                                                                | new `supabase/migrations/*.sql`                                                                                                      | med (money-path RPC) | —          | open     |
| **A3** | `BookingCard` + `MobileBookingBar` fetch availability **client-side on mount** via a server action wrapping A2; read `src` attribution client-side (`window.location`) instead of page `searchParams`                                                                                       | `components/public/booking-card.tsx`, `mobile-booking-bar.tsx`, `app/[slug]/actions.ts`, `app/[slug]/page.tsx`                       | med                  | A2         | open     |
| **A4** | Gate admin-preview branch behind explicit param/route (no cookies on the public path); cache the now-static page (`revalidate` or `unstable_cache` tag `listing:${slug}`); add `revalidateTag('listing:'+slug)` at **static-change seams only** (property/room/photo edits, admin approval) | `app/[slug]/page.tsx`, `app/(app)/properties/**/actions.ts`, `app/(app)/settings/actions.ts`, admin `set_tenant_verification` caller | med                  | A1, A3     | open     |
| **B1** | Measure First-Load JS per route from `next build` output; record baseline in this doc                                                                                                                                                                                                       | — (measurement)                                                                                                                      | none                 | —          | open     |
| **B2** | Lazy-load / CSS-replace the `motion` `Reveal`/`Stagger` on public pages (decorative)                                                                                                                                                                                                        | `components/motion.tsx`, `app/[slug]/page.tsx`, `app/page.tsx`                                                                       | low                  | B1         | open     |
| **B3** | `next/dynamic` the `react-day-picker` calendar so it loads on date-picker open, not first paint                                                                                                                                                                                             | `components/public/booking-card.tsx`                                                                                                 | low                  | B1         | open     |
| **C**  | (Optional, after A) Evaluate PPR / `cacheComponents` (`next.config.ts`). Read `ppr-platform-guide.md` first. App-wide blast radius — do not start without sign-off                                                                                                                          | `next.config.ts`                                                                                                                     | high                 | A done     | deferred |
| **D**  | (Last) Dashboard micro-opts: fold multi-RPC reads, add Suspense streaming for perceived load. Already parallelized — low ceiling                                                                                                                                                            | `app/(app)/**`                                                                                                                       | low                  | —          | deferred |

**File-collision watch:** A3 and B3 both edit `components/public/booking-card.tsx` — coordinate/serialize
those two. A1/A4 both edit `app/[slug]/page.tsx`.

**Recommended order:** A1 (trivial win) → B1 (baseline) → A2 → A3 → A4 → B2/B3 → measure → decide C/D.

---

## 4. Verification (per task + the release gate)

- **A1:** grep confirms one `getListing` def wrapped in `cache()`; `tsc` clean.
- **A2:** run the new RPC via MCP/`psql` returns the expected per-room dates+blocks; `get_public_listing`
  still returns the same shape (additive).
- **A3/A4 (caching):** Vercel **preview** build route table shows `/[slug]` as cached (not ●); hit the
  preview URL twice → `x-vercel-cache: HIT`; TTFB drops toward edge (~sub-150ms). Authed routes still ●.
- **CORRECTNESS RELEASE GATE (must pass before A ships):** run the booking e2e (`e2e/`, Playwright) —
  prove a stale-cached page still cannot double-book (a taken date → `create_booking_hold` rejects, the
  "just booked" UI path fires), and that `BookingCard` availability is **live** (hold a date in one
  session → it shows greyed on a fresh listing load, no revalidation wait).
- **B:** First-Load JS of `/` and `/[slug]` drops vs the B1 baseline; Lighthouse mobile on `/[slug]`
  improves; no visual/interaction regression (screenshot compare).
- Always: `npm run test` (unit) + `tsc --noEmit` green before PR.

---

## 5. Ship flow & environment

- Branch → PR into `development` → CI (`verify`) green → merge → merge `development` → `main` (Vercel
  auto-deploys `main`). No AI attribution in commits/PRs.
- Slice A has a **DB migration**: apply to prod via MCP `apply_migration` **before** merging to `main`
  (migration-first), same as prior deploys. Verify `get_project_url` = `bkzyunojbtymfnfbecli` first.
- Local dev: `npm run dev` + local Supabase (seed admin `seed-op-1@example.com` / `password123`). Worktrees
  don't get `.env*` or `node_modules` — copy `.env.development`/`.env.local` from the main checkout and
  `npm install`. Remember: **dev never caches** — verify caching from the Vercel preview, not localhost.

---

## 6. Baselines (fill in as measured)

- `/[slug]` prod dynamic TTFB (from a far region): ~330–490ms · edge/cached target: <150ms.
- `/` First-Load JS: _TBD (B1)_ · `/[slug]` First-Load JS: _TBD (B1)_.
- Lighthouse mobile `/[slug]` before: _TBD_ · after: _TBD_.
