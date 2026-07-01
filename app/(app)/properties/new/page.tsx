import Link from "next/link";

import { PropertyForm } from "@/components/properties/property-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

import { createProperty } from "../actions";

export default async function NewPropertyPage() {
  await requireUser();

  // Two-step clickwrap: show the operator-agreement checkbox only on the genuine first listing
  // (i.e. no operator_listing consent yet). createProperty records it server-side, deduped.
  const tenant = await getCurrentTenant();
  let requireConsent = false;
  if (tenant) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tenant_consents")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("context", "operator_listing")
      .limit(1);
    requireConsent = !data || data.length === 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/properties"
          className="text-body-sm text-muted transition-colors hover:text-ink"
        >
          ← Properties
        </Link>
        <PageHeader title="New property" description="You can add rooms and availability next." />
      </div>
      <Card className="p-5 md:p-6">
        <PropertyForm
          action={createProperty}
          submitLabel="Create property"
          requireConsent={requireConsent}
        />
      </Card>
    </div>
  );
}
