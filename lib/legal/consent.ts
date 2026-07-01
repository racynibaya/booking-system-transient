import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { TERMS_VERSION } from "./version";

// The consent audit layer's DB writer. Deliberately PURE — no `server-only`, no `next/headers`
// import (the F2.3 "server-only breaks vitest" lesson, same as lib/xendit/status.ts) — so it stays
// integration-testable with a real client. The request-context capture (IP/user-agent) lives in
// consent-request.ts, which the callers compose with this.

export type ConsentContext = "operator_signup" | "operator_agreement" | "operator_listing";

export type ConsentMeta = { ip: string | null; userAgent: string | null };

// The single writer of the immutable consent record. Takes an explicit client so the authenticated
// seams use the RLS client (insert-own) and the signup seam (no session yet) can pass a service-role
// client — same helper, one place that owns the row's shape. tenant_consents has no update/delete
// grant, so a written row is permanent.
export async function recordConsent(
  supabase: SupabaseClient<Database>,
  params: {
    tenantId: string;
    context: ConsentContext;
    meta: ConsentMeta;
    termsVersion?: string;
  },
): Promise<void> {
  const { tenantId, context, meta, termsVersion = TERMS_VERSION } = params;
  const { error } = await supabase.from("tenant_consents").insert({
    tenant_id: tenantId,
    context,
    terms_version: termsVersion,
    ip: meta.ip,
    user_agent: meta.userAgent,
  });
  if (error) throw error;
}
