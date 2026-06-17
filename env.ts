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
    // --- Resend (server) --- transactional email (F1.5). Optional: with no key,
    // the email layer logs payloads instead of sending (dev/CI safe default).
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
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
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
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

/**
 * Hard environment guard: dev MUST talk to a local database, prod MUST talk to a
 * remote one. Throws at build/startup on cross-wiring so a misconfigured env can
 * never silently point the app at the wrong Supabase project. Never fires on a
 * correct config (next dev → local, prod build → remote).
 */
if (!process.env.SKIP_ENV_VALIDATION && env.NEXT_PUBLIC_SUPABASE_URL) {
  const isLocalDb = /\/\/(127\.0\.0\.1|localhost)/.test(env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.NODE_ENV === "production" && isLocalDb) {
    throw new Error(
      "Env guard: NODE_ENV=production but NEXT_PUBLIC_SUPABASE_URL points at a LOCAL database. " +
        "Refusing to run prod against a local DB.",
    );
  }
  if (process.env.NODE_ENV === "development" && !isLocalDb) {
    throw new Error(
      "Env guard: NODE_ENV=development but NEXT_PUBLIC_SUPABASE_URL points at a REMOTE database. " +
        "Refusing to run dev against a remote DB.",
    );
  }
}
