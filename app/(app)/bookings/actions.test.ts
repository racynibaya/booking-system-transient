import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the F1.5 confirm idempotency bug: confirm_booking "returns null"
// on a re-confirm, but PostgREST renders a NULL composite as an all-null OBJECT
// ({id:null,…}) — which is truthy. The action must gate the email send on a real field
// (booking?.id), so a re-confirm / double-click does NOT fire duplicate emails.

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc })) }));
vi.mock("@/lib/supabase/dal", () => ({
  requireUser: vi.fn(async () => ({ email: "operator@example.com" })),
  getCurrentTenant: vi.fn(async () => ({ id: "tenant-1" })),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sendEmail } from "@/lib/email/resend";

import { confirmBooking } from "./actions";

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
};

// What PostgREST actually returns for a NULL composite (the no-op re-confirm).
const allNullRow = Object.fromEntries(Object.keys(confirmedRow).map((k) => [k, null]));

beforeEach(() => {
  rpc.mockReset();
  sendEmailMock.mockClear();
});

describe("confirmBooking — F1.5 notification idempotency", () => {
  it("sends guest + operator emails on the winning confirm", async () => {
    rpc.mockResolvedValue({ data: confirmedRow, error: null });
    const res = await confirmBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(2); // guest + operator
  });

  it("sends NOTHING on a re-confirm (all-null composite is truthy but has no id)", async () => {
    rpc.mockResolvedValue({ data: allNullRow, error: null });
    const res = await confirmBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
