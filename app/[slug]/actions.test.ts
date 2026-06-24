import { beforeEach, describe, expect, it, vi } from "vitest";

// M4 trust boundary for createGatewayCheckout: the guest's deposit is charged on the HOST's own
// PayMongo key (operator-as-merchant, B8). The action must (a) use the per-tenant connection's sk_,
// never a platform env key, and (b) refuse when the host has no active connection — there is no
// fallback path that could route money to the wrong merchant.

const createCheckoutSession = vi.fn(async () => ({
  id: "cs_test_1",
  checkoutUrl: "https://checkout.paymongo.com/cs_test_1",
}));
const getGatewayConnection = vi.fn();

// One chainable builder serves both the booking read (.select().eq().single()) and the atomic
// session claim (.update().eq().is().select().maybeSingle()).
let booking: Record<string, unknown> | null;
let claim: Record<string, unknown> | null;
const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  is: vi.fn(() => builder),
  update: vi.fn(() => builder),
  single: vi.fn(async () => ({ data: booking })),
  maybeSingle: vi.fn(async () => ({ data: claim })),
};

vi.mock("@/lib/paymongo/client", () => ({
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...(a as [])),
  toCentavos: (pesos: number) => Math.round(pesos * 100),
}));
vi.mock("@/lib/supabase/gateway-dal", () => ({
  getGatewayConnection: (...a: unknown[]) => getGatewayConnection(...(a as [])),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => builder }),
  createAnonClient: () => ({}),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", "localhost:3000"]]),
}));
// resend.ts imports "server-only" (unresolvable under vitest); the auto-ack send is mocked out here.
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn(async () => true) }));

import { createGatewayCheckout } from "./actions";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  booking = {
    tenant_id: "tenant-1",
    status: "held",
    deposit_amount: 1890,
    gateway_checkout_url: null,
    guest_name: "Test Guest",
    guest_email: null,
    property: { slug: "host-slug", name: "Host Place" },
  };
  claim = { gateway_checkout_url: "https://checkout.paymongo.com/cs_test_1" };
});

describe("createGatewayCheckout — operator-as-merchant key boundary", () => {
  it("charges on the host's own per-tenant key, never an env fallback", async () => {
    getGatewayConnection.mockResolvedValue({ sk: "sk_test_HOST", status: "active" });
    const res = await createGatewayCheckout(BOOKING_ID);
    expect(res).toEqual({ ok: true, checkoutUrl: "https://checkout.paymongo.com/cs_test_1" });
    expect(getGatewayConnection).toHaveBeenCalledWith("tenant-1");
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "sk_test_HOST" }),
    );
  });

  it("refuses when the host has no connection (no checkout is created)", async () => {
    getGatewayConnection.mockResolvedValue(null);
    const res = await createGatewayCheckout(BOOKING_ID);
    expect(res.ok).toBe(false);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the host's connection is not active", async () => {
    getGatewayConnection.mockResolvedValue({ sk: "sk_test_HOST", status: "disabled" });
    const res = await createGatewayCheckout(BOOKING_ID);
    expect(res.ok).toBe(false);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
