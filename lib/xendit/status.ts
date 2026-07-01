// Pure Xendit account-status logic for the KYC webhook — NO `server-only` import so it stays
// unit-testable (same rule as ./signature; the F2.3 server-only-breaks-vitest lesson). Framework-free
// domain logic (architecture P6). The network client (createSubAccount, …) lives in ./client.
//
// The DB column `tenant_xendit_accounts.kyc_status` mirrors Xendit's account lifecycle verbatim (the
// enum in 20260628120000_tenant_xendit_accounts.sql), so this module is NOT a lossy mapper — it does
// two pure jobs the webhook handler (Slice 1) needs:
//   1. parseAccountStatus — validate an inbound status string is one Xendit actually emits (an unknown
//      value is rejected loudly rather than written, so a vocabulary drift fails safe).
//   2. shouldApplyStatusTransition — the monotonic guard. Xendit webhooks duplicate and can arrive
//      OUT OF ORDER, so the webhook is the single writer but must not let a stale/replayed event
//      regress a row (e.g. a late AWAITING_DOCS clobbering LIVE).

export const XENDIT_ACCOUNT_STATUSES = [
  "INVITED",
  "REGISTERED",
  "AWAITING_DOCS",
  "PENDING_VERIFICATION",
  "LIVE",
  "SUSPENDED",
] as const;

export type XenditAccountStatus = (typeof XENDIT_ACCOUNT_STATUSES)[number];

// The onboarding ladder — strictly forward progress toward LIVE. SUSPENDED is deliberately NOT on the
// ladder; it's a takedown handled as a special case below.
const LADDER_RANK: Record<Exclude<XenditAccountStatus, "SUSPENDED">, number> = {
  INVITED: 0,
  REGISTERED: 1,
  AWAITING_DOCS: 2,
  PENDING_VERIFICATION: 3,
  LIVE: 4,
};

// Validate + narrow an inbound webhook status string. Returns null for anything Xendit doesn't emit
// (caller rejects → the row is never written with a bogus status).
export function parseAccountStatus(raw: string | null | undefined): XenditAccountStatus | null {
  if (!raw) return null;
  return (XENDIT_ACCOUNT_STATUSES as readonly string[]).includes(raw)
    ? (raw as XenditAccountStatus)
    : null;
}

// True iff a parsed inbound status should overwrite the stored one. Rules, in order:
//   • same value → false (duplicate webhook, no-op).
//   • incoming SUSPENDED → always apply (a takedown must win even out of order).
//   • currently SUSPENDED → only LIVE reinstates it; ignore any stale ladder event that arrives after
//     a suspension (we don't un-suspend just because a replayed PENDING_VERIFICATION shows up).
//   • both on the ladder → apply only on forward progress (rank strictly increases); a backward move
//     is a stale/replayed event and is ignored.
export function shouldApplyStatusTransition(
  current: XenditAccountStatus,
  incoming: XenditAccountStatus,
): boolean {
  if (incoming === current) return false;
  if (incoming === "SUSPENDED") return true;
  if (current === "SUSPENDED") return incoming === "LIVE";
  return LADDER_RANK[incoming] > LADDER_RANK[current];
}

// MANAGED sub-account webhooks are coarse, EVENT-named (not the 6-value object status), and put the
// sub-account id at DIFFERENT paths per event (verified against the Xendit docs, 2026-06-28):
//   • account.registered → data.user_id          → REGISTERED
//   • account.activated  → data.user_id          → LIVE (only when account_info.payments_enabled)
//   • account.suspended  → data.id               → SUSPENDED
// After the OWNED re-point, both account types' lifecycle events are handled:
//   • MANAGED: account.registered / account.activated (id at data.user_id).
//   • OWNED:   account.created / account.updated carry the sub-account id at data.id and a `status`
//     field (INVITED…LIVE) we map directly — this is how an OWNED account reaching LIVE is signaled.
//   • Both:    account.suspended (id at data.id) → SUSPENDED.
// Anything else (capabilities, account_holder.kyc.status — whose id is the holder, not the sub-account —
// malformed) → null = ignore. Pure so the webhook route/handler stays a thin seam.
export type AccountEvent = { subAccountId: string; status: XenditAccountStatus };

export function parseAccountEvent(body: unknown): AccountEvent | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = root.data;
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  switch (root.event) {
    case "account.registered":
      return typeof d.user_id === "string"
        ? { subAccountId: d.user_id, status: "REGISTERED" }
        : null;
    case "account.activated": {
      const info = d.account_info as Record<string, unknown> | undefined;
      // Only LIVE once live payments are actually enabled — an activated event without it is ignored.
      return typeof d.user_id === "string" && info?.payments_enabled === true
        ? { subAccountId: d.user_id, status: "LIVE" }
        : null;
    }
    case "account.created":
    case "account.updated": {
      // OWNED: the sub-account id is data.id; map data.status directly (LIVE when verified).
      const status = parseAccountStatus(typeof d.status === "string" ? d.status : null);
      return typeof d.id === "string" && status ? { subAccountId: d.id, status } : null;
    }
    case "account.suspended":
      return typeof d.id === "string" ? { subAccountId: d.id, status: "SUSPENDED" } : null;
    default:
      return null;
  }
}
