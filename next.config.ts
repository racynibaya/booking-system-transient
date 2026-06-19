import type { NextConfig } from "next";

// Validate env vars at build/startup (throws on missing/invalid).
import "./env";

// Storage images are served from the active Supabase host (local 127.0.0.1:54321 in dev,
// the cloud project host in prod). Derive the allowed remote pattern from the same env var
// so next/image optimizes whichever environment we're built for.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);

const nextConfig: NextConfig = {
  // Next 16 dev blocks cross-origin requests to its dev resources (incl. the HMR
  // WebSocket). We run on 127.0.0.1 in dev (the local Supabase SiteURL for magic
  // links), which Next treats as cross-origin vs `localhost` — blocking it kills
  // HMR and, in turn, client hydration (forms stop working). Allow it explicitly.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Local Supabase serves images from 127.0.0.1, a loopback IP. Next 16 refuses to
    // optimize remote images from local/private IPs unless this is enabled — so gate it
    // to non-production (prod uses the public cloud host and must not carry the flag).
    ...(process.env.NODE_ENV !== "production" ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
