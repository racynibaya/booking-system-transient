import "server-only";

import { headers } from "next/headers";

import type { ConsentMeta } from "./consent";

// Request-context adapter for the consent audit fields the clickwrap requires (IP + user-agent,
// context/legal-content.md §4). Kept apart from consent.ts so the DB writer stays vitest-testable
// (consent.ts must not transitively import next/headers). Server actions compose:
//   await recordConsent(supabase, { tenantId, context, meta: await requestConsentMeta() })
export async function requestConsentMeta(): Promise<ConsentMeta> {
  const h = await headers();
  // Vercel puts the client IP first in x-forwarded-for.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, userAgent: h.get("user-agent") ?? null };
}
