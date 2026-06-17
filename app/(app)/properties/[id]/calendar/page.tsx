import Link from "next/link";
import { notFound } from "next/navigation";

import { RoomCalendar } from "@/components/properties/room-calendar";
import { PageHeader } from "@/components/ui/page-header";
import { getProperty, getRoomCalendarData, requireUser } from "@/lib/supabase/dal";

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const rooms = property.room_types ?? [];
  const calendars = await Promise.all(rooms.map((rt) => getRoomCalendarData(rt.id)));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href={`/properties/${id}`}
          className="text-body-sm text-muted transition-colors hover:text-ink"
        >
          ← {property.name}
        </Link>
        <PageHeader
          title="Availability"
          description="Block dates guests can't book — maintenance, personal use, or off-season."
        />
      </div>

      {rooms.length === 0 ? (
        <p className="text-body-sm text-muted">Add a room type first to manage its availability.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {rooms.map((rt, i) => (
            <RoomCalendar
              key={rt.id}
              propertyId={id}
              roomType={{ id: rt.id, name: rt.name, quantity: rt.quantity }}
              bookings={calendars[i].bookings}
              blocks={calendars[i].blocks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
