import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/env";

import type { Database } from "./database.types";

// Server (Server Component / Server Action / Route Handler) Supabase client,
// wired to Next's async cookies() store so sessions ride in httpOnly cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll was called from a Server Component, where cookies are
            // read-only. Safe to ignore: proxy.ts refreshes the session cookie
            // on every request, so the write isn't lost.
          }
        },
      },
    },
  );
}

// Session-less server client for the PUBLIC booking path (architecture P2): it
// carries no operator cookies, so it always acts as the `anon` role — never the
// operator client. Used by app/[slug] to call get_public_listing / create_booking_hold.
export function createAnonClient() {
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// Service-role client — BYPASSES RLS. SERVER-ONLY (uses the secret key); never import
// into client code. Used by the public deposit flow (F1.4) for the few trusted reads/writes
// anon can't do without an operator session: read a tenant's GCash details after a hold,
// and upload the proof screenshot to the private payment-proofs bucket.
export function createServiceClient() {
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
