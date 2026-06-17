import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/env";

import type { Database } from "./database.types";

// Browser (Client Component) Supabase client. Uses the publishable key, which is
// safe to ship to the browser; RLS is what protects the data.
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
