"use server";

import { revalidatePath } from "next/cache";

import { notifyAdminsPayoutChanged } from "@/lib/email/gcash-alert";
import { getCurrentTenant, getXenditAccount, requireUser } from "@/lib/supabase/dal";
import { recordConsent } from "@/lib/legal/consent";
import { requestConsentMeta } from "@/lib/legal/consent-request";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createPayout,
  createSubAccount,
  getBalance,
  getPayoutChannels,
  type PhBusinessRegType,
  submitAccountVerification,
  uploadKycFile,
  type XenditFileRef,
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

// Start the operator's Xendit onboarding: create their MANAGED sub-account and persist the binding.
// Xendit emails the operator an invite; once they accept it (sub-account → REGISTERED) we submit their
// KYC via submitXenditKyc (account_verification). Create-once. Dormant until XENDIT_SECRET_KEY is set;
// the webhook (lib/xendit/webhook-handler.ts) advances kyc_status → 'LIVE'.
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
      // MANAGED: Xendit emails the operator an invite; they accept it once, then Tuloy submits their KYC
      // on their behalf (account_verification) and they self-withdraw from their own dashboard.
      type: "MANAGED",
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
    type: "MANAGED",
    kyc_status: parseAccountStatus(sub.status) ?? "INVITED",
  });
  // A concurrent call won the race (unique tenant_id) — that's a harmless idempotent success.
  if (error && error.code !== "23505")
    return { ok: false, error: "Couldn't save — please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

// Submit the operator's MANAGED-account KYC via account_verification. Takes FormData because it carries
// the identity document files (selfie, ID front/back, + DTI & BIR for a sole proprietorship): each is
// uploaded to Xendit's file API server-side → a file reference, then the verification is submitted.
// Supports both a government-ID-only host (INDIVIDUAL) and a DTI-registered host (SOLE_PROPRIETORSHIP).
// Also stores the operator's payout destination. LIVE-mode-only (sandbox 404s), and built to Xendit's
// documented template — expect to adjust on the first real operator. The webhook carries kyc_status → LIVE.
export async function submitXenditKyc(formData: FormData): Promise<ActionResult> {
  const sk = env.XENDIT_SECRET_KEY;
  if (!sk) return { ok: false, error: "Online payments aren't available yet." };

  const str = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = xenditKycInput.safeParse({
    entity_type: str("entity_type"),
    legal_name: str("legal_name"),
    trading_name: str("trading_name"),
    business_description: str("business_description"),
    given_names: str("given_names"),
    surname: str("surname"),
    date_of_birth: str("date_of_birth"),
    email: str("email"),
    mobile_number: str("mobile_number"),
    street_line1: str("street_line1"),
    city: str("city"),
    province_state: str("province_state"),
    postal_code: str("postal_code"),
    id_type: str("id_type"),
    id_number: str("id_number"),
    payout_channel_code: str("payout_channel_code"),
    payout_account_number: str("payout_account_number"),
    payout_account_name: str("payout_account_name"),
    tos_accepted: formData.get("tos_accepted") === "true",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const account = await getXenditAccount();
  if (!account) return { ok: false, error: "Set up online payments first." };
  // The operator must accept the Xendit invite (sub-account REGISTERED) before we submit — otherwise
  // account_verification 404s with XEN_PLATFORM_SUB_ACCOUNT_NOT_LIVE.
  if (account.kyc_status === "INVITED") {
    return { ok: false, error: "Please accept the Xendit invite email first, then come back." };
  }
  // Already submitted — idempotent success; the webhook drives the rest.
  if (account.kyc_submitted_at) {
    revalidatePath("/settings");
    return { ok: true };
  }

  const d = parsed.data;
  let kycStatus: ReturnType<typeof parseAccountStatus> = null;
  try {
    // Upload each identity document → a file reference, then submit account_verification.
    const upload = async (field: string): Promise<XenditFileRef> => {
      const file = formData.get(field);
      if (!(file instanceof File) || file.size === 0) throw new Error(`missing:${field}`);
      const { fileId } = await uploadKycFile(sk, file, file.name);
      return { fileName: file.name, fileId };
    };
    const [selfie, idFront, idBack] = await Promise.all([
      upload("doc_selfie"),
      upload("doc_id_front"),
      upload("doc_id_back"),
    ]);
    let businessRegistrationDocuments:
      | { type: PhBusinessRegType; file: XenditFileRef }[]
      | undefined;
    if (d.entity_type === "SOLE_PROPRIETORSHIP") {
      businessRegistrationDocuments = [
        { type: "PH_DTI_REGISTRATION", file: await upload("doc_dti") },
        { type: "PH_BIR_2303", file: await upload("doc_bir") },
      ];
    }

    const addr = {
      streetLine1: d.street_line1,
      city: d.city,
      province: d.province_state,
      postalCode: d.postal_code,
    };
    const res = await submitAccountVerification({
      secretKey: sk,
      forUserId: account.sub_account_id,
      entityType: d.entity_type,
      businessLegalName: d.legal_name,
      businessDescription:
        d.business_description || "Short-stay transient accommodation, San Juan, La Union",
      businessAddress: addr,
      person: {
        firstName: d.given_names,
        lastName: d.surname,
        dateOfBirth: d.date_of_birth,
        email: d.email,
        mobileNumber: d.mobile_number,
        address: addr,
        selfie,
        idType: d.id_type,
        idNumber: d.id_number,
        idFront,
        idBack,
      },
      businessRegistrationDocuments,
    });
    kycStatus = parseAccountStatus(res.status);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("missing:")) {
      return { ok: false, error: "Please upload all required documents." };
    }
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

  // Persist the operator-agreement acceptance (the validated tos_accepted) as an immutable consent
  // audit record — the clickwrap evidence (context/legal-content.md §4). Best-effort: a consent-log
  // hiccup must not fail an otherwise-successful KYC submission.
  const tenant = await getCurrentTenant();
  if (tenant) {
    try {
      await recordConsent(await createClient(), {
        tenantId: tenant.id,
        context: "operator_agreement",
        meta: await requestConsentMeta(),
      });
    } catch (e) {
      console.error("[consent] failed to record operator_agreement", e);
    }
  }

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

// S3 — auto-reply config + saved reply templates. All RLS-scoped to the operator's own tenant (the
// column allowlist grant covers the two tenants columns; the template policies scope the rows).
export async function setAutoReply(enabled: boolean, text: string): Promise<ActionResult> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };
  const trimmed = text.trim();
  if (trimmed.length > 1000)
    return { ok: false, error: "That auto-reply is a bit long — trim it down." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ inquiry_auto_reply_enabled: enabled, inquiry_auto_reply: trimmed || null })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Couldn't save. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function upsertTemplate(input: {
  id?: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "Add a title and a message." };
  if (title.length > 80 || body.length > 2000)
    return { ok: false, error: "That's a bit long — trim it down." };

  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("inquiry_templates").update({ title, body }).eq("id", input.id)
    : await supabase.from("inquiry_templates").insert({ tenant_id: tenant.id, title, body });
  if (error) return { ok: false, error: "Couldn't save that reply. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/inbox", "layout");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("inquiry_templates").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove that reply. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/inbox", "layout");
  return { ok: true };
}
