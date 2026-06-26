import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

import { IconChip } from "@/components/ui/icon-chip";
import { Card } from "@/components/ui/card";

type PropertyCardData = {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  room_types: { count: number }[];
};

// Real state of the public booking page, so the card never claims a status that isn't true.
// Same vocabulary as the onboarding badge ("Under review") and the plan card ("Page closed").
export type PageStatus = "live" | "review" | "paused";
const STATUS_LABEL: Record<PageStatus, string> = {
  live: "Live",
  review: "Under review",
  paused: "Page closed",
};

// Tappable property row, reused on the dashboard and the properties list.
export function PropertyCard({
  property,
  pageStatus,
}: {
  property: PropertyCardData;
  pageStatus?: PageStatus;
}) {
  const rooms = property.room_types?.[0]?.count ?? 0;

  return (
    <Link href={`/properties/${property.id}`} className="group block">
      <Card lift className="flex items-center gap-4 p-4">
        <IconChip icon={Building2} size="lg" gradient />
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-md text-ink">{property.name}</p>
          <p className="mt-0.5 truncate text-body-sm text-muted">
            {property.area ?? "—"} · {rooms} room type{rooms === 1 ? "" : "s"}
          </p>
          <p className="mt-1 truncate text-caption-sm text-muted-soft">
            tuloy.ph/{property.slug}
            {pageStatus ? ` · ${STATUS_LABEL[pageStatus]}` : ""}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}
