import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL doesn't auto-clean between tests under Vitest globals.
afterEach(() => {
  cleanup();
});
