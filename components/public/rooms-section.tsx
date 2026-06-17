import { Users } from "lucide-react";

export type RoomCard = {
  id: string;
  name: string;
  capacity: number;
  base_price: number;
  description: string | null;
  photoUrls: string[];
};

// Public "the rooms" showcase. One card per room type: photos, name, capacity, price.
// Server-rendered, no lightbox (v1). Rooms without photos still list their details.
export function RoomsSection({ rooms }: { rooms: RoomCard[] }) {
  if (rooms.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-display-sm tracking-tight text-ink">The rooms</h2>
      <div className="flex flex-col gap-8">
        {rooms.map((room) => (
          <article key={room.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-title-md font-semibold text-ink">{room.name}</h3>
              <p className="text-title-md text-ink">
                ₱{room.base_price}
                <span className="text-body-sm font-normal text-muted"> / night</span>
              </p>
            </div>

            <p className="flex items-center gap-1.5 text-body-sm text-muted">
              <Users className="size-4" /> Up to {room.capacity} guest
              {room.capacity > 1 ? "s" : ""}
            </p>

            {room.description && (
              <p className="max-w-2xl text-body-md leading-relaxed text-muted">
                {room.description}
              </p>
            )}

            {room.photoUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {room.photoUrls.map((url, i) => (
                  <div
                    key={url}
                    className={`group relative overflow-hidden rounded-md border border-hairline bg-surface-soft ${
                      i === 0 ? "col-span-2 aspect-16/10 sm:col-span-2 sm:row-span-2" : "aspect-4/3"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${room.name} photo`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
