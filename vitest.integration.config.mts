import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests (./tests): exercise the real database — RLS, the
// create_booking_hold invariant, tenant isolation, the public read path.
// They require a running Supabase stack + .env.local, so they are EXCLUDED
// from the default `npm run test` (CI has no database) and run separately
// via `npm run test:integration`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // Run test FILES one at a time. These suites share ONE real database, and a few touch a global
    // singleton (public.billing_config — the subscription-enforcement switch). Parallel files would
    // race on that shared mode, so serialize at the file level for determinism. Tests within a file
    // still run in order. Cost is small (suite is seconds); the payoff is no shared-state flakiness.
    fileParallelism: false,
  },
});
