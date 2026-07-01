import { notFound } from "next/navigation";
import { cache } from "react";

import {
  EMPTY_REVIEWS,
  ListingView,
  resolveListingAssets,
  type Listing,
  type ReviewsData,
} from "@/components/public/listing-view";
import { createAnonClient } from "@/lib/supabase/server";

// ISR: the listing is static content + a calendar. Cache the rendered page and regenerate at most
// once a minute, so guests get an edge-served page instead of a per-request round trip to the
// Singapore function. The page reads NO request-time data (anon client only, no cookies, no
// searchParams) so it can be cached. The embedded availability can be up to ~60s stale, which is
// safe: the atomic create_booking_hold RPC re-checks at write time, so a stale calendar can only
// ever cause a failed hold ("just booked by someone else"), never a double-booking.
export const revalidate = 60;

// Opt this dynamic route into the ISR system without prerendering any slug at build (there are
// too many, and new ones appear constantly). Returning [] + dynamicParams (default true) means
// each listing is rendered on first request and then edge-cached per the revalidate window.
export function generateStaticParams() {
  return [];
}

// Memoized per request so generateMetadata and the page body share one get_public_listing +
// get_public_reviews fetch. Anon-only: admin preview of an unapproved listing lives on its own
// dynamic route (app/(admin)/admin/preview/[slug]) so this public page stays cookie-free/cacheable.
const getListing = cache(async (slug: string) => {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("get_public_listing", { p_slug: slug });
  const listing = data as unknown as Listing | null;
  if (!listing?.property) return null;

  const { coverUrl, ogImageUrl, rooms, spacePhotos } = resolveListingAssets(listing, supabase);

  const { data: reviewsData } = await supabase.rpc("get_public_reviews", { p_slug: slug });
  const reviews = (reviewsData as unknown as ReviewsData | null) ?? EMPTY_REVIEWS;

  return { listing, coverUrl, ogImageUrl, rooms, spacePhotos, reviews };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  if (!result) return { title: "Tuloy" };

  const { property } = result.listing;
  const title = `${property.name} · Book direct`;
  const description =
    property.description ??
    `Book ${property.name}${property.area ? ` in ${property.area}` : ""} directly — real-time availability, no booking fees.`;
  // Share preview (Messenger / FB / iMessage / etc.) shows the operator's own cover photo and
  // property name. The width/height are declared so Messenger renders the image inline; they match
  // the 1200×630 crop ogImageUrl points at.
  const images = result.ogImageUrl
    ? [{ url: result.ogImageUrl, width: 1200, height: 630, alt: property.name }]
    : undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: property.name, images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images },
  };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getListing(slug);
  if (!result) notFound();

  return (
    <ListingView
      listing={result.listing}
      coverUrl={result.coverUrl}
      rooms={result.rooms}
      spacePhotos={result.spacePhotos}
      reviews={result.reviews}
      preview={false}
    />
  );
}
