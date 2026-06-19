"use client";

import { Users } from "lucide-react";

import { useSelectedRoom } from "@/components/public/selected-room-context";

export type RoomCard = {
  id: string;
  name: string;
  capacity: number;
  base_price: number;
  description: string | null;
  photoUrls: string[];
};

// Equal-tile photo grid. Every tile is the same aspect ratio so rows always align (a feature
// tile of a different aspect spanning two rows is what made the old layout look lopsided).
// Column count adapts to the photo count so each reads as balanced; all photos are shown
// (there's no lightbox to hide extras behind).
function RoomGallery({ photos, name }: { photos: string[]; name: string }) {
  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <div className="overflow-hidden rounded-md border border-hairline bg-surface-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={`${name} photo`}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      </div>
    );
  }

  // 2 or 4 → tidy 1×2 / 2×2; otherwise 2-up on phones, 3-up on desktop.
  const cols =
    photos.length === 2 || photos.length === 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid gap-2 sm:gap-3 ${cols}`}>
      {photos.map((url) => (
        <div
          key={url}
          className="group overflow-hidden rounded-md border border-hairline bg-surface-soft"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${name} photo`}
            loading="lazy"
            className="aspect-4/3 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </div>
      ))}
    </div>
  );
}

// Public room showcase. Mirrors the booking card: renders only the room the guest has
// selected there (photos, name, capacity, price). Rooms without photos still list details.
export function RoomsSection({ rooms }: { rooms: RoomCard[] }) {
  const { selectedRoomId } = useSelectedRoom();

  if (rooms.length === 0) return null;
  const room = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-8">
        <article key={room.id} className="flex animate-room-swap flex-col gap-4">
          <RoomGallery photos={room.photoUrls} name={room.name} />

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
            <p className="max-w-2xl text-body-md leading-relaxed text-muted">{room.description}</p>
          )}
        </article>
      </div>
    </section>
  );
}
