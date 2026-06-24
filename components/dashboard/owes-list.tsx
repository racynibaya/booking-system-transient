"use client";

import { Check, Wallet } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { markBalanceCollected } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
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
      <Card lift className="flex items-center gap-3 p-5">
        <IconChip icon={Check} tone="success" />
        <p className="text-body-sm text-muted">All balances settled — nobody owes you right now.</p>
      </Card>
    );
  }

  const shown = owes.slice(0, MAX_ROWS);
  const remaining = owes.length - shown.length;

  return (
    <Card lift className="flex flex-col p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={Wallet} tone="warning" />
        <h2 className="text-title-md text-ink">Still owes you</h2>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-hairline-soft">
        {shown.map((o) => (
          <li
            key={o.bookingId}
            className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="min-w-0 sm:flex-1">
              <p className="truncate text-title-sm text-ink">{o.guestName}</p>
              <p className="truncate text-caption-sm text-muted">
                {o.propertyName} · {formatDateShort(o.checkIn)}
              </p>
            </div>
            {/* On mobile, amount + action share their own justified row; sm+ flattens back to one row. */}
            <div className="flex items-center justify-between gap-3 sm:contents">
              <span className="text-title-sm text-ink sm:shrink-0">{peso(o.balance)}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => onMark(o)}
                className="sm:shrink-0"
              >
                <Check className="size-4" /> Mark collected
              </Button>
            </div>
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
