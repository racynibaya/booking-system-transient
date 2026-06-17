import type { NextConfig } from "next";

// Validate env vars at build/startup (throws on missing/invalid).
import "./env";

const nextConfig: NextConfig = {
  // Next 16 dev blocks cross-origin requests to its dev resources (incl. the HMR
  // WebSocket). We run on 127.0.0.1 in dev (the local Supabase SiteURL for magic
  // links), which Next treats as cross-origin vs `localhost` — blocking it kills
  // HMR and, in turn, client hydration (forms stop working). Allow it explicitly.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
