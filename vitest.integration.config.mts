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
  },
});
