# Security

Tuloy handles real money for multiple tenants. Security is enforced primarily at the **database**
(Postgres RLS + atomic `SECURITY DEFINER` RPCs), so a slip in app code is contained — but that only
holds if every change keeps the invariants below. This checklist is the bar for any PR that touches
data access, money, auth, or public input.

## Non-negotiables

- **No double-booking.** Availability is decided by the atomic `create_booking_hold` RPC (advisory
  lock + overlap check + insert in one transaction). Never check-then-write availability in app code.
- **Tenant isolation via RLS.** Every tenant/guest/money table has RLS on with a
  `tenant_id = (select current_tenant_id())` (or `auth.uid`) policy. Reads/writes go through the
  RLS-scoped session client; `tenant_id` is derived from the session, never from client input.
- **Record money, never hold it.** No custody. Money moves through the licensed processor; we only
  record it. Idempotency at every money/webhook seam.
- **Secrets are server-only.** Service-role and gateway secret keys live in the `server` env schema,
  never `NEXT_PUBLIC_*`, never imported into a `"use client"` module. `.env*` stays gitignored.

## PR checklist (data / money / auth / public input)

- [ ] **New table?** `alter table … enable row level security` + a tenant/owner policy. No
      `using (true)`, no grant to `anon`.
- [ ] **New `SECURITY DEFINER` function?** It must self-guard — `is_current_user_admin()`,
      `current_tenant_id()`, or an `auth.uid()` check — or be `revoke`d from `anon`/`authenticated`
      and granted to `service_role` only. Never expose an unguarded definer RPC.
- [ ] **New `GRANT`?** Scope it. Never `grant update on public.tenants` (or any privileged table)
      whole-table to `authenticated` — use column grants. (A `tenants` trigger blocks `is_admin` /
      `verification_status` self-updates as a backstop, but don't rely on it.)
- [ ] **New client input (Server Action / route)?** Validate at the boundary with a zod schema
      (`lib/validation.ts`). Never trust a client-supplied id for authorization — derive it from the
      session or let RLS reject it.
- [ ] **New webhook?** Verify the provider signature/token (constant-time, fail-closed) **before**
      parsing the body, and make the handler idempotent (a replay must no-op).
- [ ] **Rendering guest/operator free-text into HTML or email?** Escape it (`escapeHtml`). No
      `dangerouslySetInnerHTML` on user content.
- [ ] **New redirect from user input?** Constrain to a same-origin relative path.

## Automated gates (CI)

- **Dependency CVEs** — `npm audit --audit-level=high` fails the build on high/critical.
- **Secret scanning** — gitleaks scans the tree for committed keys/tokens (allowlist in
  `.gitleaks.toml`).
- Recommended follow-up: a semgrep SAST pass (React/Next/Supabase rulesets) once tuned.

## Reporting

Found a vulnerability? Email the maintainer directly — do not open a public issue.
