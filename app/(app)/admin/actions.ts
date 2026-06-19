"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenant } from "@/lib/supabase/dal";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type AdminResult = { ok: true } | { ok: false; error: string };

export type OperatorDoc = { kind: string; url: string };

// Load an operator's verification documents as short-lived signed URLs, for admin review. Gated on
// is_admin; uses the service-role client because the docs bucket is private + cross-tenant.
export async function getOperatorDocs(
  tenantId: string,
): Promise<{ ok: true; docs: OperatorDoc[] } | { ok: false; error: string }> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("verification_documents")
    .select("kind, storage_path")
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: "Couldn't load documents." };

  const docs: OperatorDoc[] = [];
  for (const d of data ?? []) {
    const { data: signed } = await admin.storage
      .from("verification-docs")
      .createSignedUrl(d.storage_path, 600); // 10 min
    if (signed?.signedUrl) docs.push({ kind: d.kind, url: signed.signedUrl });
  }

  // Surface the GCash QR from Settings (public bucket) so the admin can match the name on it
  // against the gov ID — it's the same account they get paid to, no separate upload needed.
  const { data: tenant } = await admin
    .from("tenants")
    .select("gcash_qr_path")
    .eq("id", tenantId)
    .single();
  if (tenant?.gcash_qr_path) {
    const url = admin.storage.from("property-images").getPublicUrl(tenant.gcash_qr_path)
      .data.publicUrl;
    docs.push({ kind: "gcash_qr", url });
  }

  // Put the gov ID and GCash QR next to each other — that's the name-match check.
  const ORDER: Record<string, number> = {
    gov_id: 0,
    gcash_qr: 1,
    business_permit: 2,
    property_proof: 3,
  };
  docs.sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));

  return { ok: true, docs };
}

// Approve / suspend / re-queue an operator. The set_tenant_verification RPC also self-checks
// is_admin (defense in depth), but we gate here too so a non-admin never reaches it.
export async function setVerification(
  tenantId: string,
  status: "pending" | "approved" | "suspended",
): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_verification", {
    p_tenant_id: tenantId,
    p_status: status,
  });
  if (error) return { ok: false, error: "Couldn't update — please try again." };

  revalidatePath("/admin/operators");
  return { ok: true };
}

// Bounce an operator back with a reason instead of rejecting them (e.g. a blurry ID). They move to
// changes_requested (still dark), see the note, and re-upload — then it returns to pending.
export async function requestChanges(tenantId: string, note: string): Promise<AdminResult> {
  const me = await getCurrentTenant();
  if (!me?.is_admin) return { ok: false, error: "Not authorized." };

  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Add a short reason so they know what to fix." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_verification", {
    p_tenant_id: tenantId,
    p_status: "changes_requested",
    p_note: trimmed,
  });
  if (error) return { ok: false, error: "Couldn't send — please try again." };

  revalidatePath("/admin/operators");
  return { ok: true };
}
