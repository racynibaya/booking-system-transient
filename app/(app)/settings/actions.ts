"use server";

import { revalidatePath } from "next/cache";

import { notifyAdminsGcashChanged } from "@/lib/email/gcash-alert";
import { requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { gcashInput, type GcashInput } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Persist the operator's GCash payout name/number on their tenant row. RLS
// (tenants_update_own) scopes the update to the caller's own row.
export async function updateGcash(input: GcashInput): Promise<ActionResult> {
  const parsed = gcashInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();
  const { gcash_name, gcash_number } = parsed.data;

  const { data: before } = await supabase
    .from("tenants")
    .select("gcash_name, gcash_number, verification_status, name")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("tenants")
    .update({ gcash_name: gcash_name || null, gcash_number: gcash_number || null })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  // A live operator changing their payout starts the 3-day re-verify window — alert admins.
  if (
    before?.verification_status === "approved" &&
    (before.gcash_name !== (gcash_name || null) || before.gcash_number !== (gcash_number || null))
  ) {
    await notifyAdminsGcashChanged({
      operatorName: before.name,
      operatorEmail: user.email ?? null,
    });
  }

  revalidatePath("/settings");
  return { ok: true };
}

// The QR upload itself happens browser-side (storage RLS scopes the path to the
// operator's tenant); this only persists the resulting path on the tenant row.
export async function setGcashQr(path: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("tenants")
    .select("gcash_qr_path, verification_status, name")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("tenants")
    .update({ gcash_qr_path: path || null })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  if (before?.verification_status === "approved" && before.gcash_qr_path !== (path || null)) {
    await notifyAdminsGcashChanged({
      operatorName: before.name,
      operatorEmail: user.email ?? null,
    });
  }

  revalidatePath("/settings");
  return { ok: true };
}
