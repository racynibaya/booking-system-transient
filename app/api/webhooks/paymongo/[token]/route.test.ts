// @vitest-environment node
//
// M3 — the token-routed webhook's trust boundary: unknown token → 404, the per-tenant whsk_ is what
// verifies the event, and only a verified event reaches the shared handler. The DAL and the shared
// handler are mocked (their behavior is covered elsewhere); we assert the routing/verify logic here.
import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleVerifiedPaymongoEvent } from "@/lib/paymongo/webhook-handler";
import { getGatewayConnectionByToken } from "@/lib/supabase/gateway-dal";

import { POST } from "./route";

vi.mock("@/lib/supabase/gateway-dal", () => ({ getGatewayConnectionByToken: vi.fn() }));
vi.mock("@/lib/paymongo/webhook-handler", () => ({ handleVerifiedPaymongoEvent: vi.fn() }));

const getConn = vi.mocked(getGatewayConnectionByToken);
const handle = vi.mocked(handleVerifiedPaymongoEvent);

const WHSK = "whsk_test_tenant_secret";
const BODY = JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid" } } });

function connection(whsk = WHSK) {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    provider: "paymongo",
    sk: "sk_test_x",
    whsk,
    webhookToken: "tok_abc",
    webhookId: "hook_1",
    status: "active",
  };
}

// Build a current, validly-signed Paymongo-Signature header for BODY using the given secret.
function signNow(secret = WHSK, tSec = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${tSec}.${BODY}`).digest("hex");
  return `t=${tSec},te=${sig},li=`;
}

function post(token: string, header: string | null) {
  const headers = new Headers();
  if (header) headers.set("paymongo-signature", header);
  const req = new Request(`http://localhost/api/webhooks/paymongo/${token}`, {
    method: "POST",
    body: BODY,
    headers,
  });
  return POST(req, { params: Promise.resolve({ token }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  handle.mockResolvedValue(new Response("delegated", { status: 200 }));
});

describe("POST /api/webhooks/paymongo/[token]", () => {
  it("404s an unknown token and never verifies or handles", async () => {
    getConn.mockResolvedValue(null);
    const res = await post("tok_unknown", signNow());
    expect(res.status).toBe(404);
    expect(handle).not.toHaveBeenCalled();
  });

  it("401s when the signature does not verify against THAT tenant's whsk_", async () => {
    getConn.mockResolvedValue(connection());
    const res = await post("tok_abc", signNow("whsk_wrong_secret"));
    expect(res.status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("delegates to the shared handler when the per-tenant signature verifies", async () => {
    getConn.mockResolvedValue(connection());
    const res = await post("tok_abc", signNow());
    expect(handle).toHaveBeenCalledWith(BODY);
    expect(await res.text()).toBe("delegated");
    expect(res.status).toBe(200);
  });

  it("401s a stale-timestamp event even with a valid HMAC (replay window)", async () => {
    getConn.mockResolvedValue(connection());
    const stale = Math.floor(Date.now() / 1000) - 10 * 60; // 10 min old
    const res = await post("tok_abc", signNow(WHSK, stale));
    expect(res.status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });
});
