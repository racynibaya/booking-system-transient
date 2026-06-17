"use server";

import { revalidatePath } from "next/cache";

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
  const { error } = await supabase
    .from("tenants")
    .update({ gcash_name: gcash_name || null, gcash_number: gcash_number || null })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

// The QR upload itself happens browser-side (storage RLS scopes the path to the
// operator's tenant); this only persists the resulting path on the tenant row.
export async function setGcashQr(path: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ gcash_qr_path: path || null })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
