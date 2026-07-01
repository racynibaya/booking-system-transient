import "server-only";

import { headers } from "next/headers";

import { createServiceClient } from "@/lib/supabase/server";

// Postgres-backed fixed-window rate limiter (M2 of the security diagnostic). Called from the
// sensitive Server Actions to blunt brute-force / credential-stuffing / email-bomb / spam abuse.
// FAIL-OPEN by design: a DB blip must never lock real operators/guests out of auth or booking.

// Best-effort client IP from the proxy chain (Vercel populates x-forwarded-for). Falls back to a
// constant so the limiter still applies a shared bucket when the header is absent.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// Returns true if the action is ALLOWED, false if the caller is over the limit for this window.
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail-open
    return data === true;
  } catch {
    return true; // fail-open
  }
}
