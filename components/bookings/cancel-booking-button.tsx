"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBooking } from "@/app/(app)/bookings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";

// Max length must match the server-side cap in cancelBooking's reason validation.
const REASON_MAX = 500;

// Operator's "Cancel" control (F2.1). Opens an on-brand confirmation dialog — cancelling
// frees the room's dates and notifies no one, so it's framed as irreversible. The pending
// transition guards a double-click; a re-cancel is a harmless no-op server-side (the
// action's status guard). On success the action revalidates /bookings, so the row's
// status badge updates in place.
//
// The optional reason is sent to the guest in the cancellation email and recorded on the
// booking — so a cancellation isn't a silent, unexplained drop.
export function CancelBookingButton({
  bookingId,
  guestName,
}: {
  bookingId: string;
  guestName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

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
        onCancel={() => {
          setReason("");
          setOpen(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
            const res = await cancelBooking(bookingId, reason);
            if (res.ok) toast.success("Booking cancelled — the dates are free again.");
            else toast.error(res.error);
            setReason("");
            setOpen(false);
          });
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-body-sm text-muted">Reason (optional — shared with the guest)</span>
          <Textarea
            value={reason}
            maxLength={REASON_MAX}
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The room is no longer available for these dates. Sorry for the trouble!"
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
