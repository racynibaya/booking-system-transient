import { timingSafeEqual } from "node:crypto";

// Pure Xendit webhook helper — NO `server-only` import so it stays unit-testable (the F2.3 lesson:
// server-only breaks vitest). Framework-free domain logic (architecture P6). The network client
// (createSubAccount, createRefund, …) lives in ./client.
//
// Unlike PayMongo (HMAC-SHA256 over the raw body), Xendit authenticates webhooks with a STATIC
// verification token: every callback carries an `x-callback-token` header that must equal the
// account's configured callback token. So verification is a constant-time string compare, not a
// signature recomputation — there is no body hashing and no timestamp window.
//
// ⚠️ Verify against a real sandbox callback before trusting in production (architecture P8: verify,
// don't assume). The logic below is pure + tested.

// True iff the header token matches the configured callback token. Constant-time to avoid leaking
// the token through comparison timing. A missing/blank header OR an unset expected token always
// rejects (a half-configured env can never accept an unverified webhook).
export function verifyCallbackToken(
  received: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch; the length check both guards that and is itself a
  // non-secret-dependent branch (the lengths are not the secret).
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
