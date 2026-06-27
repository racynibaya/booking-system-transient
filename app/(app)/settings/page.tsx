import { Banknote, Wallet } from "lucide-react";

import { PaymentMethodsSection } from "@/components/settings/payment-methods-section";
import { PayoutAccountSection } from "@/components/settings/payout-account-section";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import {
  getCurrentTenant,
  getPaymentMethods,
  getPayoutAccount,
  requireUser,
} from "@/lib/supabase/dal";

export default async function SettingsPage() {
  await requireUser();
  const [methods, tenant, payoutAccount] = await Promise.all([
    getPaymentMethods(),
    getCurrentTenant(),
    getPayoutAccount(),
  ]);

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

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <IconChip icon={Banknote} tone="sea" />
            <h2 className="text-display-sm text-ink">Get paid</h2>
          </div>
          <p className="text-body-sm text-muted">
            Where we send your share after a guest pays. Just your GCash or bank — no PayMongo
            account needed.
          </p>
        </div>
        <PayoutAccountSection account={payoutAccount} />
      </section>
    </div>
  );
}
