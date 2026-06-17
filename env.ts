import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe, validated environment variables. Imported in next.config.ts so a
 * missing/invalid var fails the BUILD, not a request in production.
 *
 * As we wire each integration, move its vars from the commented templates below
 * into the active `server` / `client` schemas AND into `runtimeEnv`.
 * Client vars MUST be prefixed NEXT_PUBLIC_.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // --- Supabase (server) --- new-format secret key (sb_secret_...)
    SUPABASE_SECRET_KEY: z.string().min(1),
    // --- PayMongo ---
    // PAYMONGO_SECRET_KEY: z.string().min(1),
    // PAYMONGO_WEBHOOK_SECRET: z.string().min(1),
  },
  client: {
    // --- Supabase (public) --- new-format publishable key (sb_publishable_...)
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    // PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
    // PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  // Treat empty strings as undefined so a blank var fails required checks.
  emptyStringAsUndefined: true,
  // Lets `next lint`/Docker builds skip validation when needed.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
