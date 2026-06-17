import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { PropertyCard } from "@/components/properties/property-card";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getProperties, requireUser } from "@/lib/supabase/dal";

export default async function PropertiesPage() {
  await requireUser();
  const properties = await getProperties();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Properties"
        description="The places you take bookings for."
        action={
          properties.length > 0 ? (
            <Link href="/properties/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> New property
            </Link>
          ) : undefined
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first place — its name, location, and the rooms guests can book."
          action={
            <Link href="/properties/new" className={buttonClassName()}>
              <Plus className="size-4" /> Add property
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
