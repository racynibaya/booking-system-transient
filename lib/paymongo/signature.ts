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

// Returns true iff the raw body authenticates against the webhook secret. `rawBody` MUST be the
// exact bytes received (read request.text() before any JSON parse — re-serializing changes them).
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const parsed = parsePaymongoSignature(signatureHeader);
  if (!parsed) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  // Accept either signature slot — sandbox events populate `te`, live events `li`.
  return safeEqualHex(expected, parsed.test) || safeEqualHex(expected, parsed.live);
}
