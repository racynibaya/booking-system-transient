import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLANS, type PlanId } from "@/lib/plans";

// Operator-facing plan + upgrade CTA. Billing is manual-first (B4): there's no recurring gateway,
// so "Upgrade" opens a Messenger chat where collection happens over GCash. The room-count line
// mirrors the soft cap guard (D7) — over cap is a nudge here, never a block.
export function PlanSection({
  plan,
  roomCount,
  messengerUrl,
}: {
  plan: PlanId;
  roomCount: number;
  messengerUrl?: string;
}) {
  const current = PLANS[plan];
  const cap = current.roomCap;
  const overCap = cap !== null && roomCount > cap;
  const isPaid = plan !== "free";

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge tone={overCap ? "warning" : isPaid ? "success" : "neutral"}>{current.label}</Badge>
          <p className="mt-2 text-title-md text-ink">
            {current.price}
            {isPaid ? " / month" : ""}
          </p>
          <p className="text-body-sm text-muted">
            {roomCount} room{roomCount === 1 ? "" : "s"}
            {cap !== null ? ` of ${cap}` : " · unlimited"}
          </p>
        </div>
        <div className="sm:shrink-0">
          {messengerUrl ? (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                size: "sm",
                variant: overCap ? "primary" : "secondary",
              })}
            >
              {isPaid ? "Upgrade" : "Choose a plan"}
            </a>
          ) : (
            <span className="text-body-sm text-muted">Message us to upgrade</span>
          )}
        </div>
      </div>

      {overCap && (
        <p className="text-body-sm text-warning">
          You&rsquo;re over the {current.label} limit of {cap} rooms. Your booking page keeps
          working — upgrade when you&rsquo;re ready to keep growing.
        </p>
      )}
    </Card>
  );
}
