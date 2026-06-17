import { LogIn, LogOut, MapPin } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

import { BookingCard, type PublicRoom } from "@/components/public/booking-card";
import { LocationMap } from "@/components/public/location-map";
import { RoomsSection, type RoomCard } from "@/components/public/rooms-section";
import { formatTime } from "@/lib/dates";
import { createAnonClient } from "@/lib/supabase/server";

type Listing = {
  property: {
    id: string;
    name: string;
    slug: string;
    area: string | null;
    address: string | null;
    description: string | null;
    about: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    cover_image_path: string | null;
  };
  room_types: PublicRoom[];
};

async function getListing(
  slug: string,
): Promise<{ listing: Listing; coverUrl: string | null; rooms: RoomCard[] } | null> {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("get_public_listing", { p_slug: slug });
  const listing = data as unknown as Listing | null;
  if (!listing?.property) return null;

  const publicUrl = (path: string) =>
    supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;

  const path = listing.property.cover_image_path;
  const coverUrl = path ? publicUrl(path) : null;

  // Resolve each room's stored photo paths to public URLs for the showcase section.
  const rooms: RoomCard[] = listing.room_types.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    base_price: r.base_price,
    description: r.description,
    photoUrls: (r.photos ?? []).map(publicUrl),
  }));

  return { listing, coverUrl, rooms };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  return { title: result ? `${result.listing.property.name} · Book direct` : "Tuloy" };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  if (!result) notFound();
  const { listing, coverUrl, rooms } = result;
  const { property } = listing;

  const hasGoodToKnow = !!(property.check_in_time || property.check_out_time);

  return (
    <main className="w-full overflow-x-hidden bg-canvas">
      {/* ---- Hero (dark, photographic) — the fold ------------------------------------ */}
      <section className="relative min-h-dvh w-full overflow-hidden">
        {/* base/fallback gradient, the operator photo, then a legibility overlay */}
        <div className="absolute inset-0 bg-linear-to-br from-ink to-[#2a0d14]" />
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/35 to-black/45" />

        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6">
          <header className="flex items-center justify-between text-canvas">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-canvas/15 backdrop-blur">
                <Image
                  src="/favicon/tuloy-icon-white.svg"
                  alt=""
                  width={64}
                  height={64}
                  className="size-4"
                />
              </span>
              <span className="truncate text-title-md font-semibold">{property.name}</span>
            </div>
            <div className="ml-3 hidden shrink-0 items-center gap-1.5 sm:flex">
              <span className="text-caption-sm text-white/55">Powered by</span>
              <Image
                src="/logo/tuloy-logo-white.svg"
                alt="Tuloy"
                width={208}
                height={112}
                className="h-5 w-auto"
              />
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center gap-6 py-6 md:flex-row md:items-center md:justify-between md:gap-10 md:py-10">
            <div className="max-w-xl text-canvas">
              <h1 className="text-hero tracking-tight text-canvas">{property.name}</h1>
              {property.area && (
                <p className="mt-3 flex items-center gap-1.5 text-display-sm text-white/85">
                  <MapPin className="size-5 shrink-0" /> {property.area}
                </p>
              )}
              {property.description && (
                <p className="mt-4 max-w-md text-body-md leading-relaxed text-white/75">
                  {property.description}
                </p>
              )}
              <p className="mt-5 text-body-sm text-white/70">
                Book direct · real-time availability · no booking fees
              </p>
            </div>

            <BookingCard
              rooms={listing.room_types}
              propertyName={property.name}
              area={property.area}
            />
          </div>
        </div>
      </section>

      {/* ---- Content (light) — scrolls under the hero -------------------------------- */}
      <div className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-14 sm:px-6 md:py-20">
        <RoomsSection rooms={rooms} />

        {property.about && (
          <section className="flex flex-col gap-4">
            <h2 className="text-display-sm tracking-tight text-ink">About this place</h2>
            <p className="max-w-2xl text-body-md leading-relaxed whitespace-pre-line text-muted">
              {property.about}
            </p>
          </section>
        )}

        {hasGoodToKnow && (
          <section className="flex flex-col gap-4">
            <h2 className="text-display-sm tracking-tight text-ink">Good to know</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {property.check_in_time && (
                <div className="flex items-center gap-3 rounded-md border border-hairline p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-primary">
                    <LogIn className="size-4" />
                  </span>
                  <div>
                    <p className="text-caption text-muted">Check-in</p>
                    <p className="text-title-md text-ink">{formatTime(property.check_in_time)}</p>
                  </div>
                </div>
              )}
              {property.check_out_time && (
                <div className="flex items-center gap-3 rounded-md border border-hairline p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-primary">
                    <LogOut className="size-4" />
                  </span>
                  <div>
                    <p className="text-caption text-muted">Check-out</p>
                    <p className="text-title-md text-ink">{formatTime(property.check_out_time)}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {property.address && (
          <section className="flex flex-col gap-4">
            <h2 className="text-display-sm tracking-tight text-ink">Where you&apos;ll be</h2>
            <p className="flex items-center gap-1.5 text-body-md text-muted">
              <MapPin className="size-4 shrink-0" /> {property.address}
            </p>
            <LocationMap address={property.address} />
          </section>
        )}
      </div>
    </main>
  );
}
