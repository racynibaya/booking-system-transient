import { Check, Clock } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PLANS, type PlanId } from "@/lib/plans";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";

// Where the operator lands after the hosted PayMongo subscription checkout (createSubscriptionCheckout's
// successUrl). The platform webhook → record_subscription_payment is the source of truth (P10); this
// page only REFLECTS the tenant's current plan. Activation is near-instant but async, so a freshly-paid
// operator may read the old plan for a beat — we show a "confirming…" state they can refresh.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function BillingReturnPage() {
  await requireUser();
  const tenant = await getCurrentTenant();

  const plan = (tenant?.plan as PlanId) ?? "free";
  const active = tenant?.subscription_status === "active";
  const renewsOn = formatDate(tenant?.paid_until ?? null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Plan payment" description="Your subscription status." />

      <Card className="flex max-w-md flex-col gap-3 p-6">
        {active ? (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
              <Check className="size-5" />
            </span>
            <h2 className="text-display-sm text-ink">You&rsquo;re on {PLANS[plan].label}</h2>
            <p className="text-body-sm text-body">
              Payment received — your plan is active{renewsOn ? ` and renews ${renewsOn}` : ""}.
            </p>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-strong text-primary">
              <Clock className="size-5" />
            </span>
            <h2 className="text-display-sm text-ink">Confirming your payment…</h2>
            <p className="text-body-sm text-body">
              This usually takes only a few seconds. Refresh in a moment to see your plan update.
            </p>
          </>
        )}
        <div className="mt-2 flex gap-3">
          <Link
            href="/settings/billing/return"
            className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-button-sm text-ink transition-colors hover:bg-surface-soft"
          >
            Refresh
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-button-sm text-canvas transition-opacity hover:opacity-90"
          >
            Back to settings
          </Link>
        </div>
      </Card>
    </div>
  );
}
