import { createServerClient } from "@supabase/ssr";
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
