import { GcashForm } from "@/components/settings/gcash-form";
import { GcashQrUploader } from "@/components/settings/gcash-qr-uploader";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getGcashSettings, requireUser } from "@/lib/supabase/dal";

export default async function SettingsPage() {
  await requireUser();
  const gcash = await getGcashSettings();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Your GCash payout details — guests see these when paying their deposit."
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-display-sm text-ink">GCash payout</h2>
          <p className="text-body-sm text-muted">
            The account guests send their deposit to. Shown with the booking hold, never on the
            public listing.
          </p>
        </div>
        <Card className="flex flex-col gap-6 p-5 md:p-6">
          <GcashForm
            defaultValues={{
              gcash_name: gcash?.gcash_name ?? "",
              gcash_number: gcash?.gcash_number ?? "",
            }}
          />
          <div className="flex flex-col gap-2 border-t border-hairline pt-6">
            <p className="text-title-md text-ink">QR code</p>
            <p className="text-body-sm text-muted">
              Upload a screenshot of your GCash QR screen <strong>showing your name</strong> —
              guests scan it to pay, and we check the name to verify your account.
            </p>
            {gcash && (
              <div className="mt-2">
                <GcashQrUploader tenantId={gcash.id} currentPath={gcash.gcash_qr_path} />
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
