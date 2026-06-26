import { Sparkles, Wallet, Zap } from "lucide-react";

import { env } from "@/env";
import { GatewaySection } from "@/components/settings/gateway-section";
import { PaymentMethodsSection } from "@/components/settings/payment-methods-section";
import { PlanSection } from "@/components/settings/plan-section";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { type PlanId } from "@/lib/plans";
import {
  getBookingsPaused,
  getCurrentTenant,
  getGatewayConnectionStatus,
  getPaymentMethods,
  getRoomCount,
  requireUser,
} from "@/lib/supabase/dal";

export default async function SettingsPage() {
  await requireUser();
  const [methods, tenant, roomCount, bookingsPaused] = await Promise.all([
    getPaymentMethods(),
    getCurrentTenant(),
    getRoomCount(),
    getBookingsPaused(),
  ]);
  // Online payments are a Business-plan capability — only fetch/show the section for that tier.
  const gatewayStatus = tenant?.plan === "business" ? await getGatewayConnectionStatus() : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Your payout methods — guests see these when paying their deposit."
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <IconChip icon={Sparkles} tone="accent" />
            <h2 className="text-display-sm text-ink">Your plan</h2>
          </div>
          <p className="text-body-sm text-muted">
            Your subscription tier and room usage. No per-booking commission, ever.
          </p>
        </div>
        <PlanSection
          plan={(tenant?.plan as PlanId) ?? "free"}
          roomCount={roomCount}
          paidUntil={tenant?.paid_until ?? null}
          subscriptionStatus={tenant?.subscription_status ?? "trialing"}
          bookingsPaused={bookingsPaused}
          checkoutEnabled={!!env.PAYMONGO_PLATFORM_SECRET_KEY}
          messengerUrl={env.NEXT_PUBLIC_UPGRADE_MESSENGER_URL}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <IconChip icon={Wallet} tone="sea" />
            <h2 className="text-display-sm text-ink">Payment methods</h2>
          </div>
          <p className="text-body-sm text-muted">
            The accounts guests can send their deposit to. Shown with the booking hold, never on the
            public listing — and we check each account name against your ID.
          </p>
        </div>
        <PaymentMethodsSection methods={methods ?? []} tenantId={tenant?.id ?? ""} />
      </section>

      {gatewayStatus && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <IconChip icon={Zap} tone="primary" />
              <h2 className="text-display-sm text-ink">Online payments</h2>
            </div>
            <p className="text-body-sm text-muted">
              Connect your PayMongo account to let guests pay their deposit by card or e-wallet and
              confirm the booking instantly.
            </p>
          </div>
          <GatewaySection status={gatewayStatus} />
        </section>
      )}
    </div>
  );
}
