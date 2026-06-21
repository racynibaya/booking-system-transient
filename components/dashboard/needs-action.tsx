import { CheckCircle2, ChevronRight, Clock, MailQuestion } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { NeedsActionCounts } from "@/lib/supabase/dal";

// "Anything waiting on me?" — taps the operator on the shoulder and sends them straight to the
// Bookings board's Needs-action view. The dashboard counts; the per-guest work happens there.
function ActionRow({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <Link
      href="/bookings?view=action"
      className="group flex items-center gap-3 rounded-sm bg-surface-soft px-4 py-3 transition-colors hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-bg text-warning">
        {icon}
      </span>
      <p className="min-w-0 flex-1 text-body-md text-ink">
        <span className="font-semibold">{count}</span> {label}
      </p>
      <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function NeedsAction({ needsConfirmation, expiringHolds }: NeedsActionCounts) {
  if (needsConfirmation === 0 && expiringHolds === 0) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-bg text-success">
          <CheckCircle2 className="size-4.5" />
        </span>
        <div>
          <p className="text-title-sm text-ink">You&rsquo;re all caught up</p>
          <p className="text-caption-sm text-muted">Nothing needs your confirmation right now.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-title-md text-ink">Waiting on you</h2>
      <div className="flex flex-col gap-2">
        {needsConfirmation > 0 && (
          <ActionRow
            icon={<MailQuestion className="size-4.5" />}
            count={needsConfirmation}
            label={`booking${needsConfirmation > 1 ? "s" : ""} need your confirmation`}
          />
        )}
        {expiringHolds > 0 && (
          <ActionRow
            icon={<Clock className="size-4.5" />}
            count={expiringHolds}
            label={`hold${expiringHolds > 1 ? "s" : ""} about to expire`}
          />
        )}
      </div>
    </Card>
  );
}
