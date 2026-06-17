import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Unit/component tests only. E2E (booking flow, async Server Components)
    // lives in ./e2e and runs under Playwright. DB-backed integration tests
    // live in ./tests and run via `npm run test:integration` (they need a
    // Supabase stack + .env.local, which CI has no access to).
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "tests/**", "node_modules/**", ".next/**"],
  },
});
