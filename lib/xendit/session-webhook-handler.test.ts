import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Coverage for the Xendit Payment Session webhook — the money seam that confirms a booking after a
// completed PAY session. The handler must: ignore non-completed events, classify confirm errors as
// permanent (200, Xendit stops) vs transient (500, Xendit retries), email the guest only on a REAL
// confirm (NULL-composite guard), and detect a distinct second payment landing on an already-confirmed
// booking (guest charged twice → refund needed). All of that is asserted here against a mocked
// service client + email sender.

const rpc = vi.fn();
const paymentsMaybeSingle = vi.fn();
// from("payments").select("id").eq("booking_id",…).eq("provider_ref",…).maybeSingle()
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: paymentsMaybeSingle }) }) }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({ rpc, from })),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn(async () => true) }));

import { sendEmail } from "@/lib/email/resend";

import { handleVerifiedXenditSessionEvent } from "./session-webhook-handler";

const sendEmailMock = vi.mocked(sendEmail);

const BOOKING_ID = "0b5a9f2e-3c4d-4e6f-8a1b-2c3d4e5f6a7b";

const confirmedRow = {
  id: BOOKING_ID,
  guest_name: "Guest Tester",
  guest_email: "guest@example.com",
  guest_phone: null,
  check_in: "2026-08-01",
  check_out: "2026-08-03",
  num_guests: 2,
  deposit_amount: 2500,
  total_amount: 5000,
  property_name: "Casa Tester",
  unit_name: "Room 1",
};

// A completed PAY session event (what Xendit posts). reference_id = bookingId (we set it at session
// create time); amount is plain pesos; payment_id is the provider ref.
function completedSession(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: "payment_session.completed",
    data: {
      reference_id: BOOKING_ID,
      status: "COMPLETED",
      amount: 2632,
      payment_id: "pay_abc123",
      ...overrides,
    },
  });
}

beforeEach(() => {
  rpc.mockReset();
  paymentsMaybeSingle.mockReset();
  sendEmailMock.mockClear();
  from.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleVerifiedXenditSessionEvent — shape gating", () => {
  it("400s on malformed JSON", async () => {
    const res = await handleVerifiedXenditSessionEvent("{not json");
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("200-ignores a non-completed event", async () => {
    const res = await handleVerifiedXenditSessionEvent(
      JSON.stringify({ event: "payment_session.expired", data: { status: "EXPIRED" } }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("200-ignores a completed EVENT whose data.status is not COMPLETED", async () => {
    const res = await handleVerifiedXenditSessionEvent(
      JSON.stringify({ event: "payment_session.completed", data: { status: "PENDING" } }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("200s (no confirm) when reference_id is missing", async () => {
    const res = await handleVerifiedXenditSessionEvent(
      completedSession({ reference_id: undefined }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("handleVerifiedXenditSessionEvent — confirm + guest email", () => {
  it("confirms, emails the guest, and 200s on a real confirm", async () => {
    rpc.mockResolvedValueOnce({ data: confirmedRow, error: null });
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "confirm_booking_gateway",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_provider: "xendit",
        p_provider_ref: "pay_abc123",
        p_amount: 2632,
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" }),
    );
  });

  it("does NOT email when the confirmed booking has no guest_email", async () => {
    rpc.mockResolvedValueOnce({ data: { ...confirmedRow, guest_email: null }, error: null });
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("handleVerifiedXenditSessionEvent — error classification", () => {
  it.each(["SLOT_TAKEN", "AMOUNT_MISMATCH", "NOT_CONFIRMABLE", "UNKNOWN_BOOKING"])(
    "200s on permanent business error %s (Xendit must stop retrying)",
    async (code) => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: `boom: ${code}` } });
      const res = await handleVerifiedXenditSessionEvent(completedSession());
      expect(res.status).toBe(200);
      expect(sendEmailMock).not.toHaveBeenCalled();
    },
  );

  it("500s on a transient DB error (Xendit retries)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "connection reset by peer" } });
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(500);
  });
});

describe("handleVerifiedXenditSessionEvent — replay / double-charge detection", () => {
  it("200s quietly on a replay whose payment is already on file (idempotent no-op)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }); // NULL-composite no-op
    paymentsMaybeSingle.mockResolvedValueOnce({ data: { id: "existing-payment" } });
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("flags a DISTINCT second payment on an already-confirmed booking (refund needed)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    paymentsMaybeSingle.mockResolvedValueOnce({ data: null }); // this provider_ref is NOT on file
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("SECOND_PAYMENT"));
  });

  it("logs loudly when a replay no-op has no provider_ref to verify", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const res = await handleVerifiedXenditSessionEvent(completedSession({ payment_id: undefined }));
    expect(res.status).toBe(200);
    expect(paymentsMaybeSingle).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("SECOND_PAYMENT?"));
  });

  it("treats an all-null composite (PostgREST NULL row) as a no-op, not a real confirm", async () => {
    const allNull = Object.fromEntries(Object.keys(confirmedRow).map((k) => [k, null]));
    rpc.mockResolvedValueOnce({ data: allNull, error: null });
    paymentsMaybeSingle.mockResolvedValueOnce({ data: { id: "existing" } });
    const res = await handleVerifiedXenditSessionEvent(completedSession());
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
