"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBooking } from "@/app/(app)/bookings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Operator's "Cancel" control (F2.1). Opens an on-brand confirmation dialog — cancelling
// frees the room's dates and notifies no one, so it's framed as irreversible. The pending
// transition guards a double-click; a re-cancel is a harmless no-op server-side (the
// action's status guard). On success the action revalidates /bookings, so the row's
// status badge updates in place.
export function CancelBookingButton({
  bookingId,
  guestName,
}: {
  bookingId: string;
  guestName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <X className="size-4" />
        {pending ? "Cancelling…" : "Cancel"}
      </Button>

      <ConfirmDialog
        open={open}
        title="Cancel booking?"
        description={`This cancels ${guestName}'s booking and frees the dates for others. You can't undo it.`}
        confirmLabel="Yes, cancel it"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const res = await cancelBooking(bookingId);
            if (res.ok) toast.success("Booking cancelled — the dates are free again.");
            else toast.error(res.error);
            setOpen(false);
          });
        }}
      />
    </>
  );
}
