"use server";

import { revalidatePath } from "next/cache";

import { notifyAdminsPayoutChanged } from "@/lib/email/gcash-alert";
import { getCurrentTenant, getXenditAccount, requireUser } from "@/lib/supabase/dal";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createPayout,
  createSubAccount,
  getBalance,
  getPayoutChannels,
  type KycDocType,
  submitAccountVerification,
  uploadKycFile,
} from "@/lib/xendit/client";
import { parseAccountStatus } from "@/lib/xendit/status";
import { env } from "@/env";
import { paymentMethodInput, type PaymentMethodInput, xenditKycInput } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

// A live (approved) operator changing any payout method starts the 3-day re-verify window (the DB
// trigger stamps tenants.gcash_changed_at); email admins so they can re-check the account vs the ID.
async function alertIfApproved() {
  const [user, tenant] = await Promise.all([requireUser(), getCurrentTenant()]);
  if (tenant?.verification_status === "approved") {
    await notifyAdminsPayoutChanged({
      operatorName: tenant.name,
      operatorEmail: user.email ?? null,
    });
  }
}

// Create or update one payout method (operator-as-merchant: display + proof). RLS scopes inserts
// (with-check tenant_id) and updates (own rows) to the caller's tenant.
export async function upsertPaymentMethod(input: PaymentMethodInput): Promise<ActionResult> {
  const parsed = paymentMethodInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No operator account found." };
  const supabase = await createClient();
  const { id, type, account_name, account_number, bank_name } = parsed.data;

  const row = {
    type,
    account_name: account_name || null,
    account_number: account_number || null,
    bank_name: type === "bank" ? bank_name || null : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("tenant_payment_methods").update(row).eq("id", id)
    : await supabase.from("tenant_payment_methods").insert({ ...row, tenant_id: tenant.id });
  if (error) return { ok: false, error: error.message };

  await alertIfApproved();
  revalidatePath("/settings");
  return { ok: true };
}

// Persist a method's QR image path (the upload itself is browser-side; storage RLS scopes the path
// to the operator's tenant folder).
export async function setPaymentMethodQr(id: string, path: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_payment_methods")
    .update({ qr_path: path || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await alertIfApproved();
  revalidatePath("/settings");
  return { ok: true };
}

export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tenant_payment_methods").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await alertIfApproved();
  revalidatePath("/settings");
  return { ok: true };
}

// Start the operator's Xendit onboarding: create their OWNED sub-account (white-label — they never
// touch Xendit) and persist the binding. KYC is then submitted via submitXenditKyc (account_verification).
// Create-once. Dormant until XENDIT_SECRET_KEY is set; the webhook (lib/xendit/webhook-handler.ts)
// advances kyc_status → 'LIVE'.
export async function startXenditOnboarding(): Promise<ActionResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Online payments aren't available yet." };

  const [user, tenant] = await Promise.all([requireUser(), getCurrentTenant()]);
  if (!tenant) return { ok: false, error: "No operator account found." };

  // Create-once: a sub-account already exists → never make a second (a duplicate mis-splits every
  // future charge). Idempotent success.
  if (await getXenditAccount()) {
    revalidatePath("/settings");
    return { ok: true };
  }

  let sub;
  try {
    sub = await createSubAccount({
      secretKey: sk,
      email: user.email ?? `${tenant.id}@tuloysanjuan.com`,
      // OWNED = white-label: the operator never touches Xendit; we submit KYC via account_verification
      // and disburse via the Payouts API (operator-initiated). See memory xendit-owned-custody-legal.
      type: "OWNED",
      businessName: tenant.name ?? "Tuloy operator",
    });
  } catch {
    return { ok: false, error: "Couldn't reach Xendit — please try again." };
  }

  // Persist via service-role: the table is select-only for operators (sub_account_id / kyc_status /
  // commission_rate are money-trust). kyc_status mirrors what Xendit returned at creation.
  const admin = createServiceClient();
  const { error } = await admin.from("tenant_xendit_accounts").insert({
    tenant_id: tenant.id,
    sub_account_id: sub.id,
    type: "OWNED",
    kyc_status: parseAccountStatus(sub.status) ?? "INVITED",
  });
  // A concurrent call won the race (unique tenant_id) — that's a harmless idempotent success.
  if (error && error.code !== "23505")
    return { ok: false, error: "Couldn't save — please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

// The 7 Sole-Prop KYC documents Xendit requires (from the account manager). The form sends each as a
// FormData file under `doc_<TYPE>`; codes are PROVISIONAL until the AM template is confirmed.
const KYC_DOC_TYPES = [
  "DTI_CERTIFICATE",
  "BIR_2303",
  "GOVERNMENT_ID",
  "PROOF_OF_BUSINESS",
  "BANK_ACCOUNT_PROOF",
  "SERVICE_AGREEMENT",
  "LIVENESS_SELFIE",
] as const satisfies readonly KycDocType[];

// Submit the operator's OWNED-account KYC via account_verification (the MANAGED→OWNED re-point). Takes
// FormData because it carries the 7 document files: we upload each to Xendit's file API (server-side,
// with the secret key) → file_id, then submit the verification. Also stores the operator's payout
// destination (where they self-withdraw). KYC submission is LIVE-mode-only, so this can't run on the
// sandbox key. The webhook (lib/xendit/webhook-handler.ts) carries kyc_status → LIVE async.
export async function submitXenditKyc(formData: FormData): Promise<ActionResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Online payments aren't available yet." };

  const str = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = xenditKycInput.safeParse({
    legal_name: str("legal_name"),
    trading_name: str("trading_name"),
    given_names: str("given_names"),
    surname: str("surname"),
    email: str("email"),
    phone_number: str("phone_number"),
    street_line1: str("street_line1"),
    city: str("city"),
    province_state: str("province_state"),
    postal_code: str("postal_code"),
    payout_channel_code: str("payout_channel_code"),
    payout_account_number: str("payout_account_number"),
    payout_account_name: str("payout_account_name"),
    tos_accepted: formData.get("tos_accepted") === "true",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const account = await getXenditAccount();
  if (!account) return { ok: false, error: "Set up online payments first." };
  // Already submitted — idempotent success; the webhook drives the rest.
  if (account.kyc_submitted_at) {
    revalidatePath("/settings");
    return { ok: true };
  }

  const d = parsed.data;
  let kycStatus: ReturnType<typeof parseAccountStatus> = null;
  try {
    // Upload each KYC document → file_id, then submit account_verification.
    const documents: { type: KycDocType; fileId: string }[] = [];
    for (const type of KYC_DOC_TYPES) {
      const file = formData.get(`doc_${type}`);
      if (!(file instanceof File) || file.size === 0) {
        return { ok: false, error: "Please upload all required documents." };
      }
      const { fileId } = await uploadKycFile(sk, file, file.name);
      documents.push({ type, fileId });
    }
    const res = await submitAccountVerification({
      secretKey: sk,
      forUserId: account.sub_account_id,
      legalName: d.legal_name,
      tradingName: d.trading_name,
      pic: {
        givenNames: d.given_names,
        surname: d.surname,
        email: d.email,
        phoneNumber: d.phone_number || undefined,
      },
      address: {
        city: d.city,
        provinceState: d.province_state,
        streetLine1: d.street_line1,
        postalCode: d.postal_code,
      },
      documents,
    });
    kycStatus = parseAccountStatus(res.status);
  } catch {
    return { ok: false, error: "Couldn't submit to Xendit — please check your details and retry." };
  }

  // Mark KYC submitted + store the operator's payout destination. The webhook remains the authoritative
  // writer of kyc_status → LIVE; we set the returned (still-pending) status optimistically.
  const admin = createServiceClient();
  const fields: {
    kyc_submitted_at: string;
    payout_channel_code: string;
    payout_account_number: string;
    payout_account_name: string;
    updated_at: string;
    kyc_status?: NonNullable<typeof kycStatus>;
  } = {
    kyc_submitted_at: new Date().toISOString(),
    payout_channel_code: d.payout_channel_code,
    payout_account_number: d.payout_account_number,
    payout_account_name: d.payout_account_name,
    updated_at: new Date().toISOString(),
  };
  if (kycStatus) fields.kyc_status = kycStatus;

  const { error } = await admin.from("tenant_xendit_accounts").update(fields).eq("id", account.id);
  if (error) return { ok: false, error: "Couldn't save — please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

// --- Disbursement (Slice 4): operator-initiated withdrawal = the custody mitigation -------------
// OWNED operators have no Xendit dashboard, so we surface their balance + a withdraw action IN TULOY.
// The operator triggers the payout on their own command (counsel's "facilitating disbursement at the
// operator's instruction"), drawn from THEIR sub-account to THEIR bank. Dormant until XENDIT_SECRET_KEY;
// LIVE-only in practice (needs the Payouts/Balance permissions on the key).

export type PayoutChannelsResult =
  | { ok: true; channels: { code: string; name: string; category: string }[] }
  | { ok: false; error: string };

// The PH banks/e-wallets an operator can be paid out to (for the onboarding destination picker).
export async function listPayoutChannels(): Promise<PayoutChannelsResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Not available yet." };
  try {
    const channels = await getPayoutChannels(sk);
    return {
      ok: true,
      channels: channels.map((c) => ({
        code: c.channelCode,
        name: c.channelName,
        category: c.category,
      })),
    };
  } catch {
    return { ok: false, error: "Couldn't load payout options." };
  }
}

export type EarningsResult = { ok: true; balance: number } | { ok: false; error: string };

// The operator's withdrawable balance in their sub-account.
export async function getXenditEarnings(): Promise<EarningsResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Not available yet." };
  const account = await getXenditAccount();
  if (!account) return { ok: false, error: "No online-payment account found." };
  try {
    const { balance } = await getBalance(sk, account.sub_account_id);
    return { ok: true, balance };
  } catch {
    return { ok: false, error: "Couldn't read your balance right now." };
  }
}

// Operator-initiated withdrawal of their full sub-account balance to their stored bank/e-wallet.
export async function withdrawXenditBalance(): Promise<ActionResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Not available yet." };
  const account = await getXenditAccount();
  if (!account) return { ok: false, error: "No online-payment account found." };
  if (account.kyc_status !== "LIVE") return { ok: false, error: "Your account isn't active yet." };
  if (
    !account.payout_channel_code ||
    !account.payout_account_number ||
    !account.payout_account_name
  ) {
    return { ok: false, error: "Add your bank details first." };
  }

  let balance: number;
  try {
    ({ balance } = await getBalance(sk, account.sub_account_id));
  } catch {
    return { ok: false, error: "Couldn't read your balance right now." };
  }
  if (balance <= 0) return { ok: false, error: "You have no balance to withdraw yet." };

  try {
    await createPayout({
      secretKey: sk,
      forUserId: account.sub_account_id,
      referenceId: `wd-${account.id}-${Date.now()}`,
      channelCode: account.payout_channel_code,
      accountNumber: account.payout_account_number,
      accountHolderName: account.payout_account_name,
      amount: balance,
    });
  } catch {
    return { ok: false, error: "Withdrawal couldn't start — please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}
