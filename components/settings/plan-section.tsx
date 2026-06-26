import { Crown, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
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
  bookingsPaused = false,
  checkoutEnabled,
  messengerUrl,
}: {
  plan: PlanId;
  roomCount: number;
  paidUntil: string | null;
  subscriptionStatus: string;
  // true = the plan lapsed AND enforcement is on, so the public page + manual entry are CLOSED to new
  // bookings until renewal (the single entitlement authority decides this — see getBookingsPaused).
  bookingsPaused?: boolean;
  checkoutEnabled: boolean;
  messengerUrl?: string;
}) {
  const current = PLANS[plan];
  const cap = current.roomCap;
  const overCap = cap !== null && roomCount > cap;
  const isPaid = plan !== "free";
  const pastDue = subscriptionStatus === "past_due";
  const renewsOn = formatDate(paidUntil);

  // Business is the top tier — nothing higher to upgrade to, so it shows no CTA (just a top-plan
  // note). Self-serve PayMongo checkout is the path for solo/pro when the platform account is
  // configured; otherwise solo/pro fall back to the Messenger path.
  const isTopTier = plan === "business";
  const showSelfServe = checkoutEnabled && !isTopTier;

  return (
    <Card
      className={`flex flex-col gap-4 p-4 shadow-glow md:p-5 ${
        isPaid ? "border-accent/15 bg-linear-to-br from-accent/6 via-canvas to-canvas" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={isPaid ? Crown : Sparkles} tone="accent" size="lg" gradient={isPaid} />
          <div className="min-w-0">
            <Badge
              tone={
                bookingsPaused || pastDue || overCap ? "warning" : isPaid ? "success" : "neutral"
              }
            >
              {bookingsPaused
                ? `${current.label} · Page closed`
                : pastDue
                  ? `${current.label} · Past due`
                  : current.label}
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
        </div>
        {isTopTier && (
          <p className="text-body-sm text-muted sm:shrink-0 sm:text-right">
            You&rsquo;re on Business — our top plan.
          </p>
        )}
      </div>

      {!isTopTier && (
        <div className="border-t border-hairline pt-4">
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
                className: "w-full sm:w-auto",
              })}
            >
              {isPaid ? "Upgrade" : "Choose a plan"}
            </a>
          ) : (
            <span className="text-body-sm text-muted">Message us to upgrade</span>
          )}
        </div>
      )}

      {bookingsPaused ? (
        <p className="text-body-sm text-warning">
          Your booking page is closed because your {current.label} plan lapsed
          {renewsOn ? ` (${renewsOn})` : ""}. Guests can&rsquo;t book and you can&rsquo;t add
          bookings until you renew — your property and existing bookings are safe.
        </p>
      ) : (
        pastDue && (
          <p className="text-body-sm text-warning">
            Your {current.label} plan is past due{renewsOn ? ` (lapsed ${renewsOn})` : ""}. Renew to
            keep it active.
          </p>
        )
      )}

      {overCap && !pastDue && !bookingsPaused && (
        <p className="text-body-sm text-warning">
          You&rsquo;re over the {current.label} limit of {cap} rooms. Your booking page keeps
          working — upgrade when you&rsquo;re ready to keep growing.
        </p>
      )}
    </Card>
  );
}
