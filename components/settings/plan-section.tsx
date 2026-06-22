import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubscribeButtons } from "@/components/settings/subscribe-buttons";
import { DISPLAY_PLANS, PLANS, type PlanId } from "@/lib/plans";

// Operator-facing plan + billing CTA. When the platform PayMongo account is configured
// (`checkoutEnabled`), operators pay self-serve via a hosted checkout (GCash/card) and the webhook
// flips the plan + advances `paidUntil`. When it's NOT configured (or the Business tier), the CTA
// degrades to the Messenger fallback. The room-count line mirrors the soft cap guard (D7) — over cap
// is a nudge here, never a block.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// The tiers an operator can pay for self-serve (free is the default; business is contact-sales).
const SELF_SERVE_OFFERS: PlanId[] = DISPLAY_PLANS.filter((p) => p.priceMonthly !== null).map(
  (p) => p.id,
);

export function PlanSection({
  plan,
  roomCount,
  paidUntil,
  subscriptionStatus,
  checkoutEnabled,
  messengerUrl,
}: {
  plan: PlanId;
  roomCount: number;
  paidUntil: string | null;
  subscriptionStatus: string;
  checkoutEnabled: boolean;
  messengerUrl?: string;
}) {
  const current = PLANS[plan];
  const cap = current.roomCap;
  const overCap = cap !== null && roomCount > cap;
  const isPaid = plan !== "free";
  const pastDue = subscriptionStatus === "past_due";
  const renewsOn = formatDate(paidUntil);

  // Business is value-priced/contact-sales — always the Messenger path. Self-serve PayMongo checkout
  // is the path for solo/pro when the platform account is configured.
  const showSelfServe = checkoutEnabled && plan !== "business";

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge tone={pastDue || overCap ? "warning" : isPaid ? "success" : "neutral"}>
            {pastDue ? `${current.label} · Past due` : current.label}
          </Badge>
          <p className="mt-2 text-title-md text-ink">
            {current.price}
            {isPaid ? " / month" : ""}
          </p>
          <p className="text-body-sm text-muted">
            {roomCount} room{roomCount === 1 ? "" : "s"}
            {cap !== null ? ` of ${cap}` : " · unlimited"}
          </p>
          {isPaid && renewsOn && !pastDue && (
            <p className="text-body-sm text-muted">Renews {renewsOn}</p>
          )}
        </div>
        <div className="sm:shrink-0">
          {showSelfServe ? (
            <SubscribeButtons offers={SELF_SERVE_OFFERS} currentPlan={plan} />
          ) : messengerUrl ? (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                size: "sm",
                variant: pastDue || overCap ? "primary" : "secondary",
              })}
            >
              {isPaid ? "Upgrade" : "Choose a plan"}
            </a>
          ) : (
            <span className="text-body-sm text-muted">Message us to upgrade</span>
          )}
        </div>
      </div>

      {pastDue && (
        <p className="text-body-sm text-warning">
          Your {current.label} plan is past due{renewsOn ? ` (lapsed ${renewsOn})` : ""}. Renew to
          keep it active.
        </p>
      )}

      {overCap && !pastDue && (
        <p className="text-body-sm text-warning">
          You&rsquo;re over the {current.label} limit of {cap} rooms. Your booking page keeps
          working — upgrade when you&rsquo;re ready to keep growing.
        </p>
      )}
    </Card>
  );
}
