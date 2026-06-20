import { PaymentMethodsSection } from "@/components/settings/payment-methods-section";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant, getPaymentMethods, requireUser } from "@/lib/supabase/dal";

export default async function SettingsPage() {
  await requireUser();
  const [methods, tenant] = await Promise.all([getPaymentMethods(), getCurrentTenant()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Your payout methods — guests see these when paying their deposit."
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-display-sm text-ink">Payment methods</h2>
          <p className="text-body-sm text-muted">
            The accounts guests can send their deposit to. Shown with the booking hold, never on the
            public listing — and we check each account name against your ID.
          </p>
        </div>
        <PaymentMethodsSection methods={methods ?? []} tenantId={tenant?.id ?? ""} />
      </section>
    </div>
  );
}
