import { CreditCard, Wallet } from "lucide-react";

import { PaymentMethodsSection } from "@/components/settings/payment-methods-section";
import { XenditOnboardingSection } from "@/components/settings/xendit-onboarding-section";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/env";
import {
  getCurrentTenant,
  getPaymentMethods,
  getXenditAccount,
  requireUser,
} from "@/lib/supabase/dal";

export default async function SettingsPage() {
  const user = await requireUser();
  // The Xendit commission rail is dormant until the platform key is set — only fetch + show the
  // online-payments section on a deployment where it's configured (same gate as the webhook/actions).
  const xenditEnabled = !!env.XENDIT_SECRET_KEY;
  const [methods, tenant, xenditAccount] = await Promise.all([
    getPaymentMethods(),
    getCurrentTenant(),
    xenditEnabled ? getXenditAccount() : Promise.resolve(null),
  ]);
  const xenditDefaults = {
    legal_name: tenant?.name ?? "",
    trading_name: tenant?.name ?? "",
    email: user.email ?? "",
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Your payout methods — guests see these when paying their deposit."
      />

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

      {xenditEnabled && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <IconChip icon={CreditCard} tone="sea" />
              <h2 className="text-display-sm text-ink">Online payments</h2>
            </div>
            <p className="text-body-sm text-muted">
              Let guests pay online at checkout. Your share settles to your own account — Tuloy only
              takes its commission at the point of payment.
            </p>
          </div>
          <XenditOnboardingSection account={xenditAccount} defaults={xenditDefaults} />
        </section>
      )}
    </div>
  );
}
