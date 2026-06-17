"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmBooking } from "@/app/(app)/bookings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Operator's "Confirm" control. Opens an on-brand confirmation dialog (a money action —
// marks the deposit received and notifies both parties). Guards a double-click via the
// pending transition, and a re-confirm is a harmless no-op server-side (idempotent RPC).
// On success the action revalidates /bookings, so this row drops off the list.
export function ConfirmBookingButton({
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
      <Button type="button" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        <Check className="size-4" />
        {pending ? "Confirming…" : "Confirm"}
      </Button>

      <ConfirmDialog
        open={open}
        title="Confirm booking?"
        description={`This marks ${guestName}'s deposit as received and notifies both of you. You can't undo it.`}
        confirmLabel="Yes, confirm"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const res = await confirmBooking(bookingId);
            if (res.ok) toast.success("Booking confirmed — both parties notified.");
            else toast.error(res.error);
            setOpen(false);
          });
        }}
      />
    </>
  );
}
