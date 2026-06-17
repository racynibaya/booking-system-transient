import Image from "next/image";
import { notFound } from "next/navigation";

import { BookingCard, type PublicRoom } from "@/components/public/booking-card";
import { createAnonClient } from "@/lib/supabase/server";

type Listing = {
  property: {
    id: string;
    name: string;
    slug: string;
    area: string | null;
    address: string | null;
    description: string | null;
    cover_image_path: string | null;
  };
  room_types: PublicRoom[];
};

async function getListing(
  slug: string,
): Promise<{ listing: Listing; coverUrl: string | null } | null> {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("get_public_listing", { p_slug: slug });
  const listing = data as unknown as Listing | null;
  if (!listing?.property) return null;

  const path = listing.property.cover_image_path;
  const coverUrl = path
    ? supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl
    : null;
  return { listing, coverUrl };
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
  const { listing, coverUrl } = result;
  const { property } = listing;

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden">
      {/* base/fallback gradient, the operator photo, then a legibility overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink to-[#2a0d14]" />
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/45" />

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
              <p className="mt-3 text-display-sm text-white/85">{property.area}, La Union</p>
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
    </main>
  );
}
