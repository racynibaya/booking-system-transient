"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenant } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

export type VerificationDocKind = "gov_id" | "business_permit" | "property_proof";
export type ActionResult = { ok: true } | { ok: false; error: string };

// Record (upsert) a doc the operator just uploaded to storage. RLS + unique(tenant_id, kind) scope
// it to their own tenant — one current file per kind, re-upload replaces.
export async function recordVerificationDoc(
  kind: VerificationDocKind,
  storagePath: string,
): Promise<ActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("verification_documents")
    .upsert(
      { tenant_id: tenant.id, kind, storage_path: storagePath },
      { onConflict: "tenant_id,kind" },
    );
  if (error) return { ok: false, error: "Couldn't save — please try again." };

  // If they were sent back for changes, re-uploading puts them back in the review queue (pending).
  // No-op otherwise; the operator can't change their own status any other way (column lockdown).
  await supabase.rpc("resubmit_verification");

  revalidatePath("/verification");
  return { ok: true };
}
