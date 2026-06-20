"use server";

import { revalidatePath } from "next/cache";

import { notifyAdminsPayoutChanged } from "@/lib/email/gcash-alert";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodInput, type PaymentMethodInput } from "@/lib/validation";

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
