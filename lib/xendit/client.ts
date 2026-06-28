import "server-only";

// Thin Xendit REST client for the xenPlatform commission rail. Plain REST + Basic auth (the secret
// key as the username, empty password — same scheme as PayMongo). No SDK dependency. The pure token
// helper (verifyCallbackToken) lives in ./signature so it stays unit-testable; this module is the
// network seam only and never reads env itself — the caller passes the secret key (architecture P6/P7,
// mirroring lib/paymongo/client.ts).
//
// xenPlatform model: the platform Master account holds the API key; a transaction is created ON an
// operator's sub-account by passing that sub-account's id in the `for-user-id` header. PHP amounts are
// PLAIN PESOS (decimals allowed), NOT centavos — never scale by 100 (the key difference from PayMongo).
//
// SCOPE (Slice 0): the confidently-specified primitives only — sub-account creation, split-rule
// creation, refunds, balance. Two pieces are DEFERRED to the slices where an open decision fixes their
// exact shape, to avoid speculative rework:
//   • operator KYC submission (MANAGED vs OWNED onboarding flow)            → Slice 1
//   • the guest charge primitive (Invoice vs Payment Request + split attach) → Slice 2

const API_BASE = "https://api.xendit.co";

function basicAuth(secretKey: string): string {
  // Basic auth: secret key as the username, empty password.
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

// Shared request seam: Basic auth, optional `for-user-id` (act on a sub-account), JSON in/out, throw
// on non-2xx with the upstream body so callers can classify + surface a user-facing error.
async function xenditFetch<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  opts?: { body?: unknown; forUserId?: string },
): Promise<T> {
  const headers: Record<string, string> = { Authorization: basicAuth(secretKey) };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts?.forUserId) headers["for-user-id"] = opts.forUserId;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xendit ${method} ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// --- Sub-accounts (xenPlatform) ----------------------------------------------------------------

export type SubAccountType = "MANAGED" | "OWNED";

export type CreateSubAccountInput = {
  secretKey: string;
  email: string;
  type: SubAccountType;
  businessName: string;
};

// status lifecycle: INVITED → REGISTERED → AWAITING_DOCS → PENDING_VERIFICATION → LIVE | SUSPENDED.
export type SubAccount = { id: string; status: string; type: SubAccountType };

// POST /v2/accounts — create an operator sub-account under the Master. The returned `id` is what
// every later transaction passes in the `for-user-id` header (and is the split-rule destination math's
// counterpart — the operator side of the split).
export async function createSubAccount(input: CreateSubAccountInput): Promise<SubAccount> {
  const json = await xenditFetch<{ id: string; status: string; type: SubAccountType }>(
    input.secretKey,
    "POST",
    "/v2/accounts",
    {
      body: {
        email: input.email,
        type: input.type,
        public_profile: { business_name: input.businessName },
      },
    },
  );
  return { id: json.id, status: json.status, type: json.type };
}

// --- Split rules -------------------------------------------------------------------------------

export type SplitRoute = {
  percentAmount: number; // 0–100, routed to destinationAccountId
  destinationAccountId: string;
  referenceId: string; // unique within the rule
  currency?: string; // default PHP
};

export type CreateSplitRuleInput = {
  secretKey: string;
  name: string;
  description?: string;
  routes: SplitRoute[];
};

export type SplitRule = { id: string };

// POST /split_rules — define how a charge's amount is routed when it settles. For Tuloy: one route,
// percent 2.5 to the Master account id, applied to charges created on an operator sub-account (so the
// operator's share settles to their sub-account and only the commission lands in Master). Returns the
// split-rule id to attach to the charge in Slice 2.
export async function createSplitRule(input: CreateSplitRuleInput): Promise<SplitRule> {
  const json = await xenditFetch<{ id: string }>(input.secretKey, "POST", "/split_rules", {
    body: {
      name: input.name,
      description: input.description,
      routes: input.routes.map((r) => ({
        percent_amount: r.percentAmount,
        currency: r.currency ?? "PHP",
        destination_account_id: r.destinationAccountId,
        reference_id: r.referenceId,
      })),
    },
  });
  return { id: json.id };
}

// --- Refunds -----------------------------------------------------------------------------------

export type RefundReason =
  | "REQUESTED_BY_CUSTOMER"
  | "DUPLICATE"
  | "FRAUDULENT"
  | "CANCELLATION"
  | "OTHERS";

export type CreateRefundInput = {
  secretKey: string;
  forUserId: string; // the operator sub-account the refund is drawn FROM
  paymentRequestId: string;
  amount: number; // PHP, plain pesos
  reason: RefundReason;
  referenceId?: string; // our reference for dedup/traceability
  currency?: string; // default PHP
};

export type RefundResult = { id: string; status: string; failureCode: string | null };

// POST /refunds (on the sub-account via `for-user-id`) — the refund is drawn from the OPERATOR'S
// balance, which is exactly counsel's rule (Tuloy never fronts refund money). A returned status
// FAILED with failure_code INSUFFICIENT_BALANCE is the already-withdrawn signal (Q5) the refund rail
// reacts to in Slice 3.
export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  const json = await xenditFetch<{ id: string; status: string; failure_code: string | null }>(
    input.secretKey,
    "POST",
    "/refunds",
    {
      forUserId: input.forUserId,
      body: {
        payment_request_id: input.paymentRequestId,
        amount: input.amount,
        currency: input.currency ?? "PHP",
        reason: input.reason,
        reference_id: input.referenceId,
      },
    },
  );
  return { id: json.id, status: json.status, failureCode: json.failure_code };
}

// --- Balance -----------------------------------------------------------------------------------

export type Balance = { balance: number };

// GET /balance (`for-user-id`) — the operator sub-account's available balance (plain pesos). Powers
// the operator earnings view (Slice 4) and can pre-check available funds before a refund attempt.
export async function getBalance(secretKey: string, forUserId: string): Promise<Balance> {
  const json = await xenditFetch<{ balance: number }>(secretKey, "GET", "/balance", { forUserId });
  return { balance: json.balance };
}
