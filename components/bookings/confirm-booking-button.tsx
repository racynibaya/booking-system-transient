"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { confirmBooking } from "@/app/(app)/bookings/actions";
import { Button } from "@/components/ui/button";

// Operator's "Confirm" control. Guards a double-click via the pending transition,
// and a re-confirm is a harmless no-op server-side (idempotent RPC). On success the
// action revalidates /bookings, so this row drops off the list.
export function ConfirmBookingButton({
  bookingId,
  guestName,
}: {
  bookingId: string;
  guestName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Confirm ${guestName}'s booking? This marks the deposit as received.`)) return;
        startTransition(async () => {
          const res = await confirmBooking(bookingId);
          if (res.ok) toast.success("Booking confirmed — both parties notified.");
          else toast.error(res.error);
        });
      }}
    >
      <Check className="size-4" />
      {pending ? "Confirming…" : "Confirm"}
    </Button>
  );
}
