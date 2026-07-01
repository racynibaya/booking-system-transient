"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { markBalanceCollected } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";

// Records the cash/GCash balance the online flow never sees, from the booking record (M5). The
// server action computes the exact remaining and is idempotent, so a double-click is a safe no-op.
export function MarkCollectedButton({
  bookingId,
  balance,
}: {
  bookingId: string;
  balance: number;
}) {
  const [pending, start] = useTransition();
  const peso = `₱${balance.toLocaleString("en-PH")}`;

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await markBalanceCollected(bookingId);
          if (res.ok) toast.success(`Marked ${peso} as collected.`);
          else toast.error(res.error);
        })
      }
    >
      <Check className="size-4" /> {pending ? "Saving…" : `Mark ${peso} collected`}
    </Button>
  );
}
