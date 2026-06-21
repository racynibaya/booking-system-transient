"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { markBalanceCollected } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateShort } from "@/lib/dates";
import type { OwedBalance } from "@/lib/supabase/dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

// "Who still owes me?" — a glance, plus a one-tap "Mark collected" for the cash-on-arrival
// balance the online flow never records. Shows the soonest-arriving few; the rest live on the
// Bookings tab. The dashboard answers "how am I doing"; it doesn't try to be the full ledger.
const MAX_ROWS = 4;

export function OwesList({ owes }: { owes: OwedBalance[] }) {
  const [pending, startTransition] = useTransition();

  function onMark(o: OwedBalance) {
    startTransition(async () => {
      const res = await markBalanceCollected(o.bookingId);
      if (res.ok) toast.success(`Marked ${peso(o.balance)} from ${o.guestName} as collected.`);
      else toast.error(res.error);
    });
  }

  if (owes.length === 0) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-bg text-success">
          <Check className="size-4.5" />
        </span>
        <p className="text-body-sm text-muted">All balances settled — nobody owes you right now.</p>
      </Card>
    );
  }

  const shown = owes.slice(0, MAX_ROWS);
  const remaining = owes.length - shown.length;

  return (
    <Card className="flex flex-col p-5">
      <h2 className="text-title-md text-ink">Still owes you</h2>
      <ul className="mt-3 flex flex-col divide-y divide-hairline-soft">
        {shown.map((o) => (
          <li key={o.bookingId} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-sm text-ink">{o.guestName}</p>
              <p className="truncate text-caption-sm text-muted">
                {o.propertyName} · {formatDateShort(o.checkIn)}
              </p>
            </div>
            <span className="shrink-0 text-title-sm text-ink">{peso(o.balance)}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => onMark(o)}
            >
              <Check className="size-4" /> Mark collected
            </Button>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <Link
          href="/bookings?view=upcoming"
          className="mt-3 text-body-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          +{remaining} more in Bookings
        </Link>
      )}
    </Card>
  );
}
