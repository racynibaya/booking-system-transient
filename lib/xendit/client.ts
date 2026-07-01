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
  method: "GET" | "POST" | "PATCH",
  path: string,
  opts?: {
    body?: unknown;
    forUserId?: string;
    withSplitRule?: string;
    idempotencyKey?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = { Authorization: basicAuth(secretKey) };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts?.forUserId) headers["for-user-id"] = opts.forUserId;
  if (opts?.withSplitRule) headers["with-split-rule"] = opts.withSplitRule;
  if (opts?.idempotencyKey) headers["Idempotency-key"] = opts.idempotencyKey;

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

// Multipart file upload — separate from xenditFetch because `POST /files` is multipart/form-data, not
// JSON (don't set Content-Type; fetch fills the multipart boundary). Used for KYC document upload.
async function xenditUpload(
  secretKey: string,
  file: Blob,
  filename: string,
  purpose: string,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file, filename);
  const res = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: { Authorization: basicAuth(secretKey) },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xendit POST /files ${res.status}: ${text}`);
  }
  return (await res.json()) as { id: string };
}

// POST /files — upload a KYC document (PNG/JPG/PDF < 10MB), returns the file_id to reference in
// submitAccountVerification.kyc_documents.
export async function uploadKycFile(
  secretKey: string,
  file: Blob,
  filename: string,
): Promise<{ fileId: string }> {
  const json = await xenditUpload(secretKey, file, filename, "KYC_DOCUMENT");
  return { fileId: json.id };
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

// --- Account verification (MANAGED KYC) --------------------------------------------------------
//
// MANAGED path (2026-07-01, from xendit-managed-answers.md, built to Xendit's documented account_verification
// schema). Two-step: uploadKycFile → file_id, then POST /account_verification (`for-user-id`). The
// sub-account MUST already be REGISTERED (operator accepted the email invite) or this 404s with
// XEN_PLATFORM_SUB_ACCOUNT_NOT_LIVE. Supports BOTH a host with only a government ID (INDIVIDUAL) and a
// DTI-registered host (SOLE_PROPRIETORSHIP — adds business_registration_documents).
//
// ⚠️ LIVE-MODE ONLY (sandbox → XEN_PLATFORM_SUB_ACCOUNT_NOT_LIVE) and Xendit publishes no PH INDIVIDUAL
// sample — the exact minimal required field subset is unconfirmed. Built to the documented template;
// EXPECT to adjust on the first real operator (Racyn's decision). Returns the pending status; LIVE is
// driven async by the account/verification webhook → tenant_xendit_accounts.kyc_status.
const PH = "PH";
const LODGING_INDUSTRY = "LODGING_HOTELS_MOTELS_AND_RESORTS";

export type XenditEntityType = "INDIVIDUAL" | "SOLE_PROPRIETORSHIP";

// PH government-ID codes accepted for the operator's identification.
export type PhIdType =
  | "PH_PHILSYS_PHYSICAL"
  | "PH_PHILSYS_DIGITAL"
  | "PH_UMID"
  | "PH_DRIVERS_LICENSE"
  | "PH_SSS_OR_GSIS"
  | "PH_PRC_LICENSE"
  | "PH_POSTAL_ID"
  | "PH_VOTER_ID"
  | "PH_ACR_OR_IMMIGRANT_COR"
  | "PASSPORT";

// PH business-registration doc codes — SOLE_PROPRIETORSHIP only.
export type PhBusinessRegType = "PH_DTI_REGISTRATION" | "PH_BIR_2303";

export type XenditFileRef = { fileName: string; fileId: string }; // from uploadKycFile
type XenditAddress = { streetLine1: string; city: string; province: string; postalCode: string };

export type AccountVerificationInput = {
  secretKey: string;
  forUserId: string; // the MANAGED operator sub-account (must be REGISTERED)
  entityType: XenditEntityType;
  businessLegalName: string;
  businessDescription: string;
  businessAddress: XenditAddress;
  person: {
    firstName: string;
    lastName: string;
    dateOfBirth: string; // YYYY-MM-DD
    email: string;
    mobileNumber: string; // local, without country code
    address: XenditAddress;
    selfie: XenditFileRef;
    idType: PhIdType;
    idNumber: string;
    idFront: XenditFileRef;
    idBack: XenditFileRef;
  };
  businessRegistrationDocuments?: { type: PhBusinessRegType; file: XenditFileRef }[]; // sole prop
};

const addr = (a: XenditAddress) => ({
  street_line_1: a.streetLine1,
  city: a.city,
  province: a.province,
  state: a.province, // PH requires both province and state
  postal_code: a.postalCode,
  country_code: PH,
});

const fileObj = (f: XenditFileRef) => ({ file_name: f.fileName, file_id: f.fileId });

export async function submitAccountVerification(
  input: AccountVerificationInput,
): Promise<{ status: string }> {
  const p = input.person;
  const identification = [
    {
      type: p.idType,
      number: p.idNumber,
      document_front: fileObj(p.idFront),
      document_back: fileObj(p.idBack),
    },
  ];

  const kyc_details: Record<string, unknown> = {
    business_legal_name: input.businessLegalName,
    business_description: input.businessDescription,
    business_address: addr(input.businessAddress),
    business_intents: ["PAYMENTS"],
    business_source_of_funds: ["REVENUE"],
    authorized_person_first_name: p.firstName,
    authorized_person_last_name: p.lastName,
    authorized_person_nationality: PH,
    authorized_person_date_of_birth: p.dateOfBirth,
    authorized_person_email_address: p.email,
    authorized_person_mobile_country_code: "+63",
    authorized_person_mobile_number_only: p.mobileNumber,
    authorized_person_address: addr(p.address),
    authorized_person_selfie_document: fileObj(p.selfie),
    authorized_person_identification: identification,
    stakeholders: [
      {
        roles: ["BUSINESS_OWNER"],
        first_name: p.firstName,
        last_name: p.lastName,
        nationality: PH,
        date_of_birth: p.dateOfBirth,
        is_authorized_person: true,
        address: addr(p.address),
        identification,
      },
    ],
  };

  if (input.businessRegistrationDocuments?.length) {
    kyc_details.business_registration_documents = input.businessRegistrationDocuments.map((d) => ({
      type: d.type,
      country: PH,
      document: fileObj(d.file),
    }));
  }

  const json = await xenditFetch<{ status?: string }>(
    input.secretKey,
    "POST",
    "/account_verification",
    {
      forUserId: input.forUserId,
      body: {
        country_of_incorporation: PH,
        business_entity_type: input.entityType,
        business_industry_code: LODGING_INDUSTRY,
        kyc_details,
      },
    },
  );
  return { status: json.status ?? "PENDING_VERIFICATION" };
}

// --- Split rules -------------------------------------------------------------------------------

// A route splits EITHER a flat peso amount OR a percent of the settled charge to a destination. Tuloy
// uses a single FLAT route = the booking's commission (0.025·stay) to the Master, because the commission
// is sized on the full stay but the charge is only the deposit, so percent-of-charge would be wrong.
export type SplitRoute = {
  flatAmount?: number; // plain pesos (PHP is not centavos); set EITHER this OR percentAmount
  percentAmount?: number; // 0–100
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

// POST /split_rules — define how a charge's amount is routed when it settles. For Tuloy: one flat route
// = the commission to the Master account id, attached (via the `with-split-rule` header) to the Payment
// Session created on the operator's sub-account, so the operator's share settles to their sub-account
// and only the commission lands in Master. Returns the split-rule id to attach to the charge.
export async function createSplitRule(input: CreateSplitRuleInput): Promise<SplitRule> {
  const json = await xenditFetch<{ id: string }>(input.secretKey, "POST", "/split_rules", {
    body: {
      name: input.name,
      description: input.description,
      routes: input.routes.map((r) => ({
        ...(r.flatAmount !== undefined ? { flat_amount: r.flatAmount } : {}),
        ...(r.percentAmount !== undefined ? { percent_amount: r.percentAmount } : {}),
        currency: r.currency ?? "PHP",
        destination_account_id: r.destinationAccountId,
        reference_id: r.referenceId,
      })),
    },
  });
  return { id: json.id };
}

// --- Payment Session (guest checkout) ----------------------------------------------------------

export type PaymentSessionInput = {
  secretKey: string;
  forUserId: string; // operator sub-account the charge is created ON
  splitRuleId: string; // routes the commission to Master (with-split-rule header)
  referenceId: string; // our booking reference (idempotency on Xendit's side)
  amount: number; // plain pesos (PHP), the grossed-up guest total
  description?: string;
  customer?: { email?: string; givenNames?: string; surname?: string; mobileNumber?: string };
  successReturnUrl: string;
  cancelReturnUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentSession = { id: string; sessionUrl: string; status: string };

// POST /sessions (session_type PAY, mode PAYMENT_LINK) on the operator's sub-account (`for-user-id`)
// with the split rule attached (`with-split-rule`). Returns a hosted-checkout `session_url` the guest
// pays at (picks GCash/card); the outcome arrives async via the Session webhook → confirm (Slice 2c).
export async function createPaymentSession(input: PaymentSessionInput): Promise<PaymentSession> {
  const json = await xenditFetch<{ id: string; session_url: string; status: string }>(
    input.secretKey,
    "POST",
    "/sessions",
    {
      forUserId: input.forUserId,
      withSplitRule: input.splitRuleId,
      body: {
        reference_id: input.referenceId,
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        amount: input.amount,
        currency: "PHP",
        country: "PH",
        capture_method: "AUTOMATIC",
        description: input.description,
        customer: input.customer
          ? {
              type: "INDIVIDUAL",
              email: input.customer.email,
              mobile_number: input.customer.mobileNumber,
              individual_detail: {
                given_names: input.customer.givenNames,
                surname: input.customer.surname,
              },
            }
          : undefined,
        success_return_url: input.successReturnUrl,
        cancel_return_url: input.cancelReturnUrl,
        metadata: input.metadata,
      },
    },
  );
  return { id: json.id, sessionUrl: json.session_url, status: json.status };
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

// --- Payouts (operator-initiated withdrawal — Slice 4 / custody mitigation) ---------------------
//
// OWNED operators have no Xendit dashboard, so they can't self-withdraw there. Counsel's custody
// mitigation: the operator triggers their OWN withdrawal inside Tuloy, which fires this on their behalf
// (`for-user-id` = their sub-account, funds drawn from THEIR balance, sent to THEIR bank). The operator
// controls the disbursement; Tuloy only facilitates it on instruction. ⚠️ Needs the Payouts permission
// on the Xendit key; LIVE-only in practice.

export type PayoutInput = {
  secretKey: string;
  forUserId: string; // operator OWNED sub-account the funds are drawn FROM
  referenceId: string; // our reference; also the Idempotency-key
  channelCode: string; // PH bank/e-wallet channel (e.g. PH_GCASH); from getPayoutChannels
  accountNumber: string;
  accountHolderName: string; // must match the bank/e-wallet account name exactly
  amount: number; // plain pesos (PHP)
  description?: string;
};

export type PayoutResult = { id: string; status: string; failureCode: string | null };

// POST /v1/payouts — status returns ACCEPTED; the final outcome arrives via the payout webhook
// (payout.succeeded / payout.failed). INSUFFICIENT_BALANCE is the empty-sub-account signal.
export async function createPayout(input: PayoutInput): Promise<PayoutResult> {
  const json = await xenditFetch<{ id: string; status: string; failure_code?: string | null }>(
    input.secretKey,
    "POST",
    "/v1/payouts",
    {
      forUserId: input.forUserId,
      idempotencyKey: input.referenceId,
      body: {
        reference_id: input.referenceId,
        channel_code: input.channelCode,
        channel_properties: {
          account_number: input.accountNumber,
          account_holder_name: input.accountHolderName,
        },
        amount: input.amount,
        currency: "PHP",
        description: input.description,
      },
    },
  );
  return { id: json.id, status: json.status, failureCode: json.failure_code ?? null };
}

export type PayoutChannel = {
  channelCode: string;
  channelName: string;
  category: string; // BANK | EWALLET | OTC
  min: number;
  max: number;
};

// GET /payouts_channels?currency=PHP — the PH banks/e-wallets an operator can withdraw to (for the
// destination picker during onboarding).
export async function getPayoutChannels(
  secretKey: string,
  category?: "BANK" | "EWALLET" | "OTC",
): Promise<PayoutChannel[]> {
  const q = `?currency=PHP${category ? `&channel_category=${category}` : ""}`;
  const json = await xenditFetch<
    Array<{
      channel_code: string;
      channel_name: string;
      channel_category: string;
      amount_limits?: { minimum?: number; maximum?: number };
    }>
  >(secretKey, "GET", `/payouts_channels${q}`);
  return json.map((c) => ({
    channelCode: c.channel_code,
    channelName: c.channel_name,
    category: c.channel_category,
    min: c.amount_limits?.minimum ?? 0,
    max: c.amount_limits?.maximum ?? 0,
  }));
}
