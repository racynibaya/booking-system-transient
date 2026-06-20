import { createHmac, timingSafeEqual } from "node:crypto";

// Pure PayMongo helpers — NO `server-only` import so they stay unit-testable (the F2.3 lesson:
// server-only breaks vitest). Framework-free domain logic (architecture P6). The network client
// (createCheckoutSession) lives in ./client.

// PayMongo amounts are in centavos: ₱1.00 → 100, ₱1500.50 → 150050.
export function toCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

// --- Webhook signature verification -------------------------------------------------------
//
// PayMongo signs each webhook with the hook's secret_key (whsk_...). The `Paymongo-Signature`
// header is `t=<unix_ts>,te=<test_sig>,li=<live_sig>`; the signed payload is `${t}.${rawBody}`,
// HMAC-SHA256 hex, compared against `te` (test mode) or `li` (live mode).
//
// ⚠️ SPIKE: this header layout is the documented scheme but was NOT reconfirmable from the
// reference snapshot — VALIDATE against a real sandbox event during the live run before trusting
// it in production (architecture P8: verify, don't assume). The logic below is pure + tested.

export type ParsedSignature = { timestamp: string; test: string; live: string };

export function parsePaymongoSignature(header: string): ParsedSignature | null {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  if (!parts.t || (!parts.te && !parts.li)) return null;
  return { timestamp: parts.t, test: parts.te ?? "", live: parts.li ?? "" };
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// Default replay window: reject events whose signed timestamp is more than this far from now.
// PayMongo retries a webhook for up to ~3 days, so the window must be generous enough not to drop a
// legitimate retry; 5 minutes only blocks a captured-and-much-later replay (defense in depth — the
// HMAC + idempotent confirm are the primary guards).
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

// Returns true iff the raw body authenticates against the webhook secret. `rawBody` MUST be the
// exact bytes received (read request.text() before any JSON parse — re-serializing changes them).
//
// `opts.toleranceSeconds` opts into a freshness check on the signed `t` (unix SECONDS): outside the
// window → reject. Off by default so the pure-HMAC unit tests and any non-time-sensitive caller are
// unaffected; the webhook routes pass WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS. `nowMs` is injectable for
// deterministic tests.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  opts?: { toleranceSeconds?: number; nowMs?: number },
): boolean {
  if (!signatureHeader) return false;
  const parsed = parsePaymongoSignature(signatureHeader);
  if (!parsed) return false;

  if (opts?.toleranceSeconds && opts.toleranceSeconds > 0) {
    const tsSec = Number(parsed.timestamp);
    const nowSec = (opts.nowMs ?? Date.now()) / 1000;
    if (!Number.isFinite(tsSec) || Math.abs(nowSec - tsSec) > opts.toleranceSeconds) {
      return false;
    }
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  // Accept either signature slot — sandbox events populate `te`, live events `li`.
  return safeEqualHex(expected, parsed.test) || safeEqualHex(expected, parsed.live);
}
