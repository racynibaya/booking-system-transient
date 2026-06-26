import { CalendarDays, ExternalLink, ImageIcon, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CoverImageUploader } from "@/components/properties/cover-image-uploader";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { PropertyForm } from "@/components/properties/property-form";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { RoomTypesSection } from "@/components/properties/room-types-section";
import { ShareLinkButton } from "@/components/properties/share-link-button";
import { SpacePhotosUploader } from "@/components/properties/space-photos-uploader";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { getProperty, requireUser } from "@/lib/supabase/dal";

import { updateProperty } from "../actions";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/properties"
          className="text-body-sm text-muted transition-colors hover:text-ink"
        >
          ← Properties
        </Link>
        <PageHeader
          title={property.name}
          description={`Your booking page · /${property.slug}`}
          action={
            // Three buttons (≈371px) overflow phones < ~412px in the header's shrink-0
            // action slot, which won't wrap on its own. A definite width = viewport minus
            // the px-4 gutters lets them wrap on mobile; sm:w-auto keeps desktop inline.
            <div className="flex w-[calc(100vw-2rem)] flex-wrap gap-2 sm:w-auto">
              <ShareLinkButton slug={property.slug} name={property.name} />
              <Link
                href={`/${property.slug}`}
                target="_blank"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                <ExternalLink className="size-4" /> View page
              </Link>
              <Link
                href={`/properties/${id}/calendar`}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                <CalendarDays className="size-4" /> Availability
              </Link>
            </div>
          }
        />
      </div>

      <PropertyTabs
        rooms={
          <RoomTypesSection
            propertyId={id}
            tenantId={property.tenant_id}
            roomTypes={(property.room_types ?? []).map((rt) => ({
              id: rt.id,
              name: rt.name,
              capacity: rt.capacity,
              quantity: rt.quantity,
              base_price: rt.base_price,
              description: rt.description,
              photos: Array.isArray(rt.photos) ? (rt.photos as string[]) : [],
            }))}
          />
        }
        details={
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <IconChip icon={SlidersHorizontal} tone="sea" />
                <h2 className="text-display-sm text-ink">Details</h2>
              </div>
              <Card className="p-5 shadow-glow md:p-6">
                <PropertyForm
                  action={updateProperty.bind(null, id)}
                  submitLabel="Save changes"
                  defaultValues={{
                    name: property.name,
                    area: property.area ?? "",
                    address: property.address ?? "",
                    description: property.description ?? "",
                    check_in_time: (property.check_in_time ?? "14:00").slice(0, 5),
                    check_out_time: (property.check_out_time ?? "14:00").slice(0, 5),
                    min_stay_nights: property.min_stay_nights ?? 2,
                    dot_accredited: property.dot_accredited,
                    amenities: Array.isArray(property.amenities)
                      ? (property.amenities as string[])
                      : [],
                    facebook_url: property.facebook_url ?? "",
                    instagram_url: property.instagram_url ?? "",
                    tiktok_url: property.tiktok_url ?? "",
                  }}
                />
              </Card>
            </section>

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
        }
        cover={
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <IconChip icon={ImageIcon} tone="accent" />
                  <h2 className="text-display-sm text-ink">Cover photo</h2>
                </div>
                <p className="text-body-sm text-muted">
                  The full-bleed background guests see on your booking page.
                </p>
              </div>
              <Card className="p-5 shadow-glow md:p-6">
                <CoverImageUploader
                  propertyId={id}
                  tenantId={property.tenant_id}
                  currentPath={property.cover_image_path}
                />
              </Card>
            </section>

            <section className="flex flex-col gap-3 border-t border-hairline pt-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-title-md text-ink">Photos of the space</h2>
                <p className="text-body-sm text-muted">
                  Show off shared areas — the kitchen, common room, view. Add a caption so guests
                  know what they&apos;re looking at.
                </p>
              </div>
              <Card className="p-5 shadow-glow md:p-6">
                <SpacePhotosUploader
                  propertyId={id}
                  tenantId={property.tenant_id}
                  currentPhotos={
                    Array.isArray(property.photos)
                      ? (property.photos as { path: string; caption: string }[])
                      : []
                  }
                />
              </Card>
            </section>
          </div>
        }
      />
    </div>
  );
}
