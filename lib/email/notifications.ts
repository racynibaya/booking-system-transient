import type { ConfirmationBooking } from "./templates";

// Shared row → template-view mapping for the notification paths (F2.3). A pure mapper, kept
// outside the "use server" actions file so both the Server Actions (confirm/cancel) and the
// cron sweep route can use it — a plain module can export a sync helper; a "use server" file
// can't (every export there must be an async server action).

export type NotificationBookingRow = {
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  num_guests: number;
  deposit_amount: number | null;
  total_amount: number | null;
};

export function toConfirmationBooking(b: NotificationBookingRow): ConfirmationBooking {
  return {
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    guestPhone: b.guest_phone,
    checkIn: b.check_in,
    checkOut: b.check_out,
    numGuests: b.num_guests,
    depositAmount: b.deposit_amount,
    totalAmount: b.total_amount,
  };
}
