import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";

type PropertyCardData = {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  room_types: { count: number }[];
};

// Tappable property row, reused on the dashboard and the properties list.
export function PropertyCard({ property }: { property: PropertyCardData }) {
  const rooms = property.room_types?.[0]?.count ?? 0;

  return (
    <Link href={`/properties/${property.id}`} className="group block">
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-soft">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-strong text-muted">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-md text-ink">{property.name}</p>
          <p className="mt-0.5 truncate text-body-sm text-muted">
            {property.area ?? "—"} · {rooms} room type{rooms === 1 ? "" : "s"}
          </p>
          <p className="mt-1 truncate text-caption-sm text-muted-soft">
            tuloy.ph/{property.slug} · goes live soon
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}
