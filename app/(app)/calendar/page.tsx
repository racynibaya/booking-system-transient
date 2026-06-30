import { Building2, CalendarRange } from "lucide-react";

import { RoomCalendar } from "@/components/properties/room-calendar";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { getCalendarProperties, getRoomCalendarData, requireUser } from "@/lib/supabase/dal";

// M3 — the availability calendar, promoted to a top-level surface. Every room across every property
// in one place so the operator can check a date (before replying to a guest or taking a walk-in) and
// block dates without digging into each property. Reuses the self-contained RoomCalendar (it owns its
// own block create/delete); this page just aggregates and groups by property.
export default async function CalendarPage() {
  await requireUser();
  const properties = await getCalendarProperties();

  const rooms = properties.flatMap((p) =>
    (p.room_types ?? []).map((rt) => ({ propertyId: p.id, rt })),
  );
  const calendars = await Promise.all(rooms.map((r) => getRoomCalendarData(r.rt.id)));
  const calByRoom = new Map(rooms.map((r, i) => [r.rt.id, calendars[i]]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="Every room's availability in one place — block dates guests can't book."
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No rooms to show yet"
          description="Add a property and a room type, and its availability will appear here."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {properties.map((p) => {
            const propRooms = p.room_types ?? [];
            if (propRooms.length === 0) return null;
            return (
              <section key={p.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <IconChip icon={Building2} tone="sea" />
                  <h2 className="text-display-sm text-ink">{p.name}</h2>
                </div>
                <div className="flex flex-col gap-6">
                  {propRooms.map((rt) => {
                    const cal = calByRoom.get(rt.id);
                    if (!cal) return null;
                    return (
                      <RoomCalendar
                        key={rt.id}
                        propertyId={p.id}
                        roomType={{ id: rt.id, name: rt.name, quantity: rt.quantity }}
                        bookings={cal.bookings}
                        blocks={cal.blocks}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
