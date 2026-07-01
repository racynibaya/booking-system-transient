import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the F1.5 confirm idempotency bug: confirm_booking "returns null"
// on a re-confirm, but PostgREST renders a NULL composite as an all-null OBJECT
// ({id:null,…}) — which is truthy. The action must gate the email send on a real field
// (booking?.id), so a re-confirm / double-click does NOT fire duplicate emails.

const rpc = vi.fn();

// Query builder chain. Two callers share it with different terminals:
//   cancelBooking            → ...update().eq().in().select().maybeSingle()  (F2.3)
//   createManualBooking flip → ...update().eq().in()                         (awaited directly)
// So .in() returns an object that is BOTH awaitable (→ { error }, for the manual flip) and
// chainable (.select, for cancel). `flipError` drives the manual-flip await result.
let flipError: { message: string } | null = null;
type CancelResult = { data: Record<string, unknown> | null; error: { message: string } | null };
const maybeSingleMock = vi.fn(
  async (): Promise<CancelResult> => ({ data: cancelRow, error: null }),
);
const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const inMock = vi.fn(() => ({
  select: selectMock,
  then: (resolve: (v: { error: { message: string } | null }) => unknown) =>
    resolve({ error: flipError }),
}));
const eqMock = vi.fn(() => ({ in: inMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const from = vi.fn(() => ({ update: updateMock }));

// createManualBooking calls the RPC via the anon client (create_booking_hold is granted to
// anon, not authenticated) and the guarded confirm UPDATE via the session client. Both share
// the same rpc/from mocks so existing confirm/cancel assertions are unaffected.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc, from })),
  createAnonClient: vi.fn(() => ({ rpc })),
}));
vi.mock("@/lib/supabase/dal", () => ({
  requireUser: vi.fn(async () => ({ email: "operator@example.com" })),
  getCurrentTenant: vi.fn(async () => ({ id: "tenant-1" })),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// createManualBooking redirects on success; mock it to a recordable no-op so the action
// returns instead of throwing NEXT_REDIRECT.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { sendEmail } from "@/lib/email/resend";
import { getCurrentTenant } from "@/lib/supabase/dal";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelBooking, confirmBooking, createManualBooking } from "./actions";

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

// The row cancelBooking's .select().maybeSingle() returns on a winning cancel (has a
// guest_email so the cancellation email fires).
const cancelRow = {
  guest_name: "Guest Tester",
  guest_email: "guest@example.com",
  guest_phone: null,
  check_in: "2026-08-01",
  check_out: "2026-08-03",
  num_guests: 2,
  deposit_amount: 2500,
  total_amount: 5000,
};

beforeEach(() => {
  rpc.mockReset();
  sendEmailMock.mockClear();
  from.mockClear();
  updateMock.mockClear();
  eqMock.mockClear();
  inMock.mockClear();
  selectMock.mockClear();
  maybeSingleMock.mockClear();
  maybeSingleMock.mockResolvedValue({ data: cancelRow, error: null });
  flipError = null;
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
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

describe("cancelBooking — F2.1 guarded status write", () => {
  it("flips an active booking to cancelled, guarding on the occupancy statuses", async () => {
    const res = await cancelBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ status: "cancelled", cancellation_reason: null });
    expect(eqMock).toHaveBeenCalledWith("id", BOOKING_ID);
    expect(inMock).toHaveBeenCalledWith("status", ["held", "awaiting_confirmation", "confirmed"]);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/bookings", "layout");
  });

  it("persists the operator's reason and passes it to the guest email", async () => {
    const res = await cancelBooking(BOOKING_ID, "  Room flooded, so sorry!  ");
    expect(res).toEqual({ ok: true });
    // Trimmed and written to the column.
    expect(updateMock).toHaveBeenCalledWith({
      status: "cancelled",
      cancellation_reason: "Room flooded, so sorry!",
    });
    // The note reaches the guest, with reply-to pointed at the operator.
    const arg = sendEmailMock.mock.calls[0]?.[0];
    expect(arg?.html).toContain("Room flooded, so sorry!");
    expect(arg?.replyTo).toBe("operator@example.com");
  });

  it("rejects a reason over the length cap without touching the database", async () => {
    const res = await cancelBooking(BOOKING_ID, "x".repeat(501));
    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("sends the guest a cancellation email on the winning cancel", async () => {
    const res = await cancelBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" }),
    );
  });

  it("sends NOTHING on a no-op re-cancel (0 rows → null) but still succeeds", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await cancelBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not email when the cancelled booking has no guest email", async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...cancelRow, guest_email: null }, error: null });
    const res = await cancelBooking(BOOKING_ID);
    expect(res).toEqual({ ok: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid id without touching the database", async () => {
    const res = await cancelBooking("not-a-uuid");
    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("errors when the operator has no tenant", async () => {
    vi.mocked(getCurrentTenant).mockResolvedValueOnce(null);
    const res = await cancelBooking(BOOKING_ID);
    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("surfaces a database error as a failed result", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await cancelBooking(BOOKING_ID);
    expect(res.ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});

describe("createManualBooking — F2.2 one-engine entry", () => {
  const ROOM_ID = "3f1c6b88-9a4d-4f2e-9c7a-1d2e3f4a5b6c";
  const PROPERTY_ID = "7a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

  const baseInput = {
    propertyId: PROPERTY_ID,
    roomTypeId: ROOM_ID,
    checkIn: "2026-08-01",
    checkOut: "2026-08-03",
    numGuests: 2,
    guestName: "Walk-in Guest",
    guestPhone: "",
    guestEmail: "guest@example.com",
    status: "confirmed" as const,
  };

  it("holds via the RPC then flips a confirmed booking with a guarded UPDATE", async () => {
    rpc.mockResolvedValue({ data: confirmedRow, error: null });
    await createManualBooking(baseInput);

    expect(rpc).toHaveBeenCalledWith(
      "create_booking_hold",
      expect.objectContaining({
        p_room_type_id: ROOM_ID,
        p_check_in: "2026-08-01",
        p_check_out: "2026-08-03",
        p_num_guests: 2,
        p_guest_name: "Walk-in Guest",
        p_hold_minutes: 5,
      }),
    );
    expect(updateMock).toHaveBeenCalledWith({ status: "confirmed", hold_expires_at: null });
    expect(eqMock).toHaveBeenCalledWith("id", BOOKING_ID);
    expect(inMock).toHaveBeenCalledWith("status", ["held"]);
    expect(sendEmailMock).toHaveBeenCalledTimes(2); // guest + operator
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/bookings", "layout");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/bookings");
  });

  it("leaves a held booking alone — no UPDATE, no email", async () => {
    rpc.mockResolvedValue({ data: confirmedRow, error: null });
    await createManualBooking({ ...baseInput, status: "held" });

    expect(rpc).toHaveBeenCalledWith(
      "create_booking_hold",
      expect.objectContaining({ p_hold_minutes: 5 }),
    );
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/bookings");
  });

  it("maps RPC conflicts to friendly errors and does not write or redirect", async () => {
    const cases: [string, string][] = [
      ["NO_AVAILABILITY: sold out", "Those dates aren't available for this room."],
      ["INVALID_GUESTS", "That's more guests than this room holds."],
      ["INVALID_RANGE", "Check-out must be after check-in."],
      ["UNKNOWN_ROOM_TYPE", "That room couldn't be found. Please pick again."],
    ];
    for (const [message, friendly] of cases) {
      rpc.mockResolvedValue({ data: null, error: { message } });
      updateMock.mockClear();
      vi.mocked(redirect).mockClear();
      const res = await createManualBooking(baseInput);
      expect(res).toEqual({ ok: false, error: friendly });
      expect(updateMock).not.toHaveBeenCalled();
      expect(vi.mocked(redirect)).not.toHaveBeenCalled();
    }
  });

  it("reports a real-but-unconfirmed booking when the confirm UPDATE fails", async () => {
    rpc.mockResolvedValue({ data: confirmedRow, error: null });
    flipError = { message: "boom" };
    const res = await createManualBooking(baseInput);

    expect(res).toEqual({
      ok: false,
      error: "Booking saved but couldn't be marked confirmed. Open it from the dashboard.",
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/bookings", "layout");
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input without touching the RPC", async () => {
    const res = await createManualBooking({ ...baseInput, roomTypeId: "not-a-uuid" });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("errors when the operator has no tenant", async () => {
    vi.mocked(getCurrentTenant).mockResolvedValueOnce(null);
    const res = await createManualBooking(baseInput);
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats an all-null composite as a failure (no UPDATE, no redirect)", async () => {
    rpc.mockResolvedValue({ data: allNullRow, error: null });
    const res = await createManualBooking(baseInput);
    expect(res).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(updateMock).not.toHaveBeenCalled();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
