import type { NextConfig } from "next";

// Validate env vars at build/startup (throws on missing/invalid).
import "./env";

// Storage images are served from the active Supabase host (local 127.0.0.1:54321 in dev,
// the cloud project host in prod). Derive the allowed remote pattern from the same env var
// so next/image optimizes whichever environment we're built for.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);

// --- Security headers (defense-in-depth) ---------------------------------------------------------
// The app is a real-money, multi-tenant surface. These headers add clickjacking + MIME-sniff +
// referrer-leak protection and a Content-Security-Policy that pins where scripts/styles/images/
// frames may come from. Sources are derived from the active Supabase host so the policy is correct
// in every environment (local 127.0.0.1 in dev, the cloud project host in prod).
//
// NOTE on script-src 'unsafe-inline': Next's App Router streams the RSC/hydration payload via inline
// <script> tags, so a strict script-src would break the app. 'unsafe-inline' is the pragmatic v1;
// XSS risk is already low (React auto-escapes, zero dangerouslySetInnerHTML). Nonce-based hardening
// (via proxy.ts) is a follow-up. 'unsafe-eval' is dev-only (HMR needs it; prod does not).
const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = supabaseUrl.origin;
const supabaseWs = supabaseOrigin.replace(/^http/, "ws"); // ws(s):// — supabase-js realtime

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  `frame-src https://www.google.com`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
