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
    // --- Admin alerts --- where operator-change notifications go (e.g. a GCash change).
    // Comma-separated for multiple. If unset, alerts fall back to is_admin operators.
    ADMIN_ALERT_EMAIL: z.string().min(1).optional(),
    // --- Cron secret (Phase A billing cron) --- shared secret the scheduler sends as
    // `Authorization: Bearer <CRON_SECRET>` to /api/cron/subscription-billing. Optional: when unset
    // the cron route refuses all calls (dormant), so the endpoint can't be triggered by anyone.
    CRON_SECRET: z.string().min(1).optional(),
    // NOTE: the subscription-enforcement switch moved OUT of env into the DB (public.billing_config,
    // enforcement_mode off|dry_run|enforce) so the SQL money rail is self-contained and the live
    // booking-engine guard can read it. There is no SUBSCRIPTION_ENFORCEMENT env var anymore.
    // --- Public base URL --- the stable origin used for webhook registration
    // (https://SITE_URL/api/webhooks/paymongo/{token}). Unlike the per-request checkout return URL,
    // a registered webhook URL is persisted at PayMongo, so it must NOT be derived from the request
    // origin (which could be a preview deploy or localhost). Optional so the app boots without the
    // gateway; the connect action errors gracefully when unset.
    SITE_URL: z.url().optional(),
    // --- Xendit (xenPlatform commission rail) --- the money rail replacing the aggregator. The
    // Master account's secret key signs every call (Basic auth); the callback token verifies incoming
    // webhooks (x-callback-token, a static token — NOT an HMAC); the Master account id is the
    // split-rule destination for Tuloy's 2.5% commission. All optional → the rail is dormant until set,
    // so the app boots on a non-Xendit env (dev/CI/current prod) exactly like the PayMongo vars above.
    XENDIT_SECRET_KEY: z.string().min(1).optional(),
    XENDIT_CALLBACK_TOKEN: z.string().min(1).optional(),
    XENDIT_MASTER_ACCOUNT_ID: z.string().min(1).optional(),
  },
  client: {
    // --- Supabase (public) --- new-format publishable key (sb_publishable_...)
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    // --- Upgrade contact (Phase 3 / P3.1) --- Messenger link an operator taps to upgrade their
    // plan. Billing is manual-first (B4): collection happens over Messenger/GCash, so the "Upgrade"
    // CTA opens this chat. Optional — when unset the CTA degrades to plain "message us" copy.
    NEXT_PUBLIC_UPGRADE_MESSENGER_URL: z.url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ADMIN_ALERT_EMAIL: process.env.ADMIN_ALERT_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    SITE_URL: process.env.SITE_URL,
    XENDIT_SECRET_KEY: process.env.XENDIT_SECRET_KEY,
    XENDIT_CALLBACK_TOKEN: process.env.XENDIT_CALLBACK_TOKEN,
    XENDIT_MASTER_ACCOUNT_ID: process.env.XENDIT_MASTER_ACCOUNT_ID,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_UPGRADE_MESSENGER_URL: process.env.NEXT_PUBLIC_UPGRADE_MESSENGER_URL,
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
