import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { PropertyForm } from "@/components/properties/property-form";
import { RoomTypesSection } from "@/components/properties/room-types-section";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getProperty, requireUser } from "@/lib/supabase/dal";

import { updateProperty } from "../actions";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/properties"
          className="text-body-sm text-muted transition-colors hover:text-ink"
        >
          ← Properties
        </Link>
        <PageHeader
          title={property.name}
          description={`tuloy.ph/${property.slug} · goes live soon`}
          action={
            <Link
              href={`/properties/${id}/calendar`}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              <CalendarDays className="size-4" /> Availability
            </Link>
          }
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-display-sm text-ink">Details</h2>
        <Card className="p-5 md:p-6">
          <PropertyForm
            action={updateProperty.bind(null, id)}
            submitLabel="Save changes"
            defaultValues={{
              name: property.name,
              area: property.area ?? "",
              address: property.address ?? "",
              description: property.description ?? "",
              dot_accredited: property.dot_accredited,
            }}
          />
        </Card>
      </section>

      <RoomTypesSection propertyId={id} roomTypes={property.room_types ?? []} />

      <section className="flex flex-col gap-3 border-t border-hairline pt-6">
        <h2 className="text-title-md text-ink">Danger zone</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline p-4">
          <p className="text-body-sm text-muted">
            Deleting removes this property and all its rooms.
          </p>
          <DeletePropertyButton id={id} />
        </div>
      </section>
    </div>
  );
}
