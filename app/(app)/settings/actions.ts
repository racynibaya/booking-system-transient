"use server";

import { revalidatePath } from "next/cache";

import { notifyAdminsPayoutChanged } from "@/lib/email/gcash-alert";
import {
  GCASH_INSTAPAY_BIC,
  listReceivingInstitutions,
  type ReceivingInstitution,
} from "@/lib/paymongo/client";
import { getCurrentTenant, getPayoutAccount, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";
import {
  payoutAccountInput,
  type PayoutAccountInput,
  paymentMethodInput,
  type PaymentMethodInput,
} from "@/lib/validation";

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

// Create or update the operator's PAYOUT destination (centralized aggregator — where Tuloy disburses
// their share). One row per tenant (unique tenant_id); rates are admin-managed and never sent here.
// Same re-verify-on-change alert as payout methods (the DB trigger stamps gcash_changed_at).
export async function upsertPayoutAccount(input: PayoutAccountInput): Promise<ActionResult> {
  const parsed = payoutAccountInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No operator account found." };
  const supabase = await createClient();
  const { method, payout_name, account_number, bank_name, payout_bic } = parsed.data;

  const fields = {
    method,
    payout_name,
    account_number,
    bank_name: method === "bank" ? bank_name || null : null,
    // GCash always rides its one fixed InstaPay code; banks carry the institution the operator picked.
    payout_bic: method === "bank" ? payout_bic || null : GCASH_INSTAPAY_BIC,
  };

  const existing = await getPayoutAccount();
  const { error } = existing
    ? await supabase
        .from("tenant_payout_accounts")
        // Re-saving valid details re-activates a destination a failed transfer had flagged.
        .update({ ...fields, status: "active", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase.from("tenant_payout_accounts").insert({ ...fields, tenant_id: tenant.id });
  if (error) return { ok: false, error: error.message };

  await alertIfApproved();
  revalidatePath("/settings");
  return { ok: true };
}

export type PayoutInstitutionsResult =
  | { ok: true; institutions: ReceivingInstitution[] }
  | { ok: false; error: string };

// The banks/e-wallets a payout can be addressed to (name + BIC), for the operator's bank picker.
// Reads the platform key directly (the list is the same for every operator); returns a clear error
// while Money Movement is still dormant so the UI can fall back gracefully.
export async function listPayoutInstitutions(): Promise<PayoutInstitutionsResult> {
  const sk = env.PAYMONGO_PLATFORM_SECRET_KEY;
  if (!sk) return { ok: false, error: "Bank list is not available yet." };
  try {
    const institutions = await listReceivingInstitutions(sk);
    return { ok: true, institutions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load banks." };
  }
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
