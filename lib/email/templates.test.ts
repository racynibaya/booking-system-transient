import { describe, it, expect } from "vitest";

import {
  guestCancelledEmail,
  guestConfirmedEmail,
  operatorBookingEmail,
  type ConfirmationBooking,
} from "./templates";

const base: ConfirmationBooking = {
  guestName: "Maria Santos",
  guestEmail: "maria@example.com",
  guestPhone: "0917 555 1234",
  checkIn: "2026-10-10",
  checkOut: "2026-10-13",
  numGuests: 2,
  depositAmount: 1500,
  totalAmount: 7500,
};

describe("guestConfirmedEmail", () => {
  it("greets the guest and shows stay details with peso amounts", () => {
    const { subject, html } = guestConfirmedEmail(base);
    expect(subject).toMatch(/confirmed/i);
    expect(html).toContain("You're confirmed, Maria Santos!");
    expect(html).toContain("Oct 10, 2026"); // check-in
    expect(html).toContain("Oct 13, 2026"); // check-out
    expect(html).toContain("₱1,500"); // deposit
    expect(html).toContain("₱7,500"); // total
    expect(html).toContain("3-night"); // nights computed from the range
  });

  it("renders a dash when amounts are null", () => {
    const { html } = guestConfirmedEmail({ ...base, depositAmount: null, totalAmount: null });
    expect(html).toContain("—");
  });
});

describe("guestCancelledEmail", () => {
  it("tells the guest the booking was cancelled and shows the dates", () => {
    const { subject, html } = guestCancelledEmail(base);
    expect(subject).toMatch(/cancelled/i);
    expect(html).toContain("Booking cancelled, Maria Santos");
    expect(html).toContain("Oct 10, 2026");
    expect(html).toContain("Oct 13, 2026");
  });
});

describe("operatorBookingEmail", () => {
  it("includes guest contact so the operator can reach them", () => {
    const { subject, html } = operatorBookingEmail(base);
    expect(subject).toContain("Maria Santos");
    expect(html).toContain("0917 555 1234");
    expect(html).toContain("maria@example.com");
    expect(html).toContain("New confirmed booking");
  });

  it("falls back to a dash for missing guest contact", () => {
    const { html } = operatorBookingEmail({ ...base, guestPhone: null, guestEmail: null });
    expect(html).toContain("—");
  });
});
