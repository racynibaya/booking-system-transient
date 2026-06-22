import { LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

import { AmenitiesSection } from "@/components/public/amenities-section";
import { BookingCard, type PublicRoom } from "@/components/public/booking-card";
import { LocationMap } from "@/components/public/location-map";
import { MobileBookingBar } from "@/components/public/mobile-booking-bar";
import { RoomsSection, type RoomCard } from "@/components/public/rooms-section";
import { SelectedRoomProvider } from "@/components/public/selected-room-context";
import { SocialLinks } from "@/components/public/social-links";
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
    amenities: string[];
    dot_accredited: boolean;
    facebook_url: string | null;
    instagram_url: string | null;
    tiktok_url: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    cover_image_path: string | null;
  };
  accepts_online_payment: boolean;
  room_types: PublicRoom[];
};

async function getListing(slug: string): Promise<{
  listing: Listing;
  coverUrl: string | null;
  ogImageUrl: string | null;
  rooms: RoomCard[];
} | null> {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("get_public_listing", { p_slug: slug });
  const listing = data as unknown as Listing | null;
  if (!listing?.property) return null;

  const publicUrl = (path: string) =>
    supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;

  const path = listing.property.cover_image_path;
  const coverUrl = path ? publicUrl(path) : null;

  // Share-preview image: a fixed 1200×630 crop via Supabase's image transform endpoint.
  // Messenger only renders a link's image inline when the dimensions are declared (see
  // generateMetadata) and dislikes oversized source images, so we hand it an exact-size crop
  // rather than the full-resolution cover used by the hero.
  const ogImageUrl = path
    ? supabase.storage
        .from("property-images")
        .getPublicUrl(path, { transform: { width: 1200, height: 630, resize: "cover" } }).data
        .publicUrl
    : null;

  // Resolve each room's stored photo paths to public URLs for the showcase section.
  const rooms: RoomCard[] = listing.room_types.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    base_price: r.base_price,
    description: r.description,
    photoUrls: (r.photos ?? []).map(publicUrl),
  }));

  return { listing, coverUrl, ogImageUrl, rooms };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  if (!result) return { title: "Tuloy" };

  const { property } = result.listing;
  const title = `${property.name} · Book direct`;
  const description =
    property.description ??
    `Book ${property.name}${property.area ? ` in ${property.area}` : ""} directly — real-time availability, no booking fees.`;
  // Share preview (Messenger / FB / iMessage / etc.) shows the operator's own cover photo
  // and property name — not the Tuloy favicon. The width/height are declared so Messenger
  // renders the image inline; they match the 1200×630 crop ogImageUrl points at.
  const images = result.ogImageUrl
    ? [{ url: result.ogImageUrl, width: 1200, height: 630, alt: property.name }]
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: property.name,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  if (!result) notFound();
  const { listing, coverUrl, rooms } = result;
  const { property } = listing;

  const hasGoodToKnow = !!(property.check_in_time || property.check_out_time);

  return (
    <SelectedRoomProvider initialRoomId={listing.room_types[0]?.id ?? ""}>
      <main className="w-full overflow-x-hidden bg-canvas">
        {/* ---- Hero banner (brand sunset / photographic) ------------------------------ */}
        <section className="relative w-full overflow-hidden">
          {/* Brand sunset gradient base — or the operator's cover photo layered over it. */}
          <div className="absolute inset-0 bg-linear-to-br from-sunset-1 via-sunset-2 to-sunset-3" />
          {/* soft top-left highlight gives the flat gradient some depth */}
          <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_15%_0%,rgba(255,255,255,0.28),transparent_55%)]" />
          {/* faint sun + wave mark as a brand watermark when there's no cover photo */}
          {!coverUrl && (
            <Image
              src="/favicon/tuloy-icon-white.svg"
              alt=""
              width={400}
              height={400}
              className="pointer-events-none absolute -right-12 -bottom-20 size-80 opacity-[0.08]"
            />
          )}
          {coverUrl && (
            <Image
              src={coverUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              quality={85}
              className="object-cover object-center"
            />
          )}
          {/* bottom legibility scrim for the white title */}
          <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />

          <div className="relative mx-auto flex min-h-[46vh] max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6">
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

            <div className="flex flex-1 flex-col justify-end py-8 md:py-12">
              <div className="max-w-xl text-canvas">
                <h1 className="text-hero tracking-tight text-canvas">{property.name}</h1>
                {property.area && (
                  <p className="mt-3 flex items-center gap-1.5 text-display-sm text-white/85">
                    <MapPin className="size-5 shrink-0" /> {property.area}
                  </p>
                )}
                {property.dot_accredited && (
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-caption text-white/90 backdrop-blur">
                    <ShieldCheck className="size-3.5 shrink-0 text-white" /> DOT Accredited
                  </span>
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
            </div>
          </div>
        </section>

        {/* ---- Body: scrollable details (left) + sticky booking card (right) ----------- */}
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-10 px-4 py-12 pb-28 sm:px-6 lg:max-w-6xl lg:grid-cols-[1fr_360px] lg:gap-12 lg:py-16 lg:pb-16">
          {/* Desktop only — pinned right + sticky. On mobile the card moves into the bottom sheet. */}
          <aside className="hidden lg:col-start-2 lg:row-start-1 lg:block">
            <div className="lg:sticky lg:top-6">
              <BookingCard
                rooms={listing.room_types}
                propertyName={property.name}
                area={property.area}
                acceptsOnlinePayment={listing.accepts_online_payment}
              />
              {/* Fills the sidebar gap below the booking card on desktop. */}
              <div className="mt-4 hidden lg:block">
                <SocialLinks
                  facebook={property.facebook_url}
                  instagram={property.instagram_url}
                  tiktok={property.tiktok_url}
                  propertyName={property.name}
                />
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-12 lg:col-start-1 lg:row-start-1">
            <RoomsSection rooms={rooms} />

            <AmenitiesSection amenities={property.amenities} />

            {hasGoodToKnow && (
              <section className="flex flex-col gap-4">
                <h2 className="text-display-sm tracking-tight text-ink">Good to know</h2>
                <div className="grid grid-cols-2 gap-3">
                  {property.check_in_time && (
                    <div className="flex items-center gap-3 rounded-md border border-hairline p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-primary">
                        <LogIn className="size-4" />
                      </span>
                      <div>
                        <p className="text-caption text-muted">Check-in</p>
                        <p className="text-title-md text-ink">
                          {formatTime(property.check_in_time)}
                        </p>
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
                        <p className="text-title-md text-ink">
                          {formatTime(property.check_out_time)}
                        </p>
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

            {/* On mobile the sidebar collapses, so the socials close out the page here. */}
            <div className="lg:hidden">
              <SocialLinks
                facebook={property.facebook_url}
                instagram={property.instagram_url}
                tiktok={property.tiktok_url}
                propertyName={property.name}
              />
            </div>
          </div>
        </div>

        <MobileBookingBar
          rooms={listing.room_types}
          propertyName={property.name}
          area={property.area}
          acceptsOnlinePayment={listing.accepts_online_payment}
        />
      </main>
    </SelectedRoomProvider>
  );
}
