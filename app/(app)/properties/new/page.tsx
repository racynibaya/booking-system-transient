import Link from "next/link";

import { PropertyForm } from "@/components/properties/property-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/supabase/dal";

import { createProperty } from "../actions";

export default async function NewPropertyPage() {
  await requireUser();

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
        <PropertyForm action={createProperty} submitLabel="Create property" />
      </Card>
    </div>
  );
}
