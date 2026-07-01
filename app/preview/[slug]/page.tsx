import { notFound } from "next/navigation";

import {
  EMPTY_REVIEWS,
  ListingView,
  resolveListingAssets,
  type Listing,
} from "@/components/public/listing-view";
import { requireAdmin } from "@/lib/supabase/admin-dal";
import { createClient } from "@/lib/supabase/server";

// Admin-only preview of a not-yet-public listing, rendered at the exact guest-facing layout so an
// admin can vet it before approving. Dynamic + admin-gated — deliberately kept OFF the public
// /[slug] route so that page stays cookie-free and cacheable (ISR). admin_preview_listing
// self-guards on is_admin as a second gate; a non-admin hitting this route 404s via requireAdmin().
export default async function ListingPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_preview_listing", { p_slug: slug });
  const listing = data as unknown as Listing | null;
  if (!listing?.property) notFound();

  const { coverUrl, rooms, spacePhotos } = resolveListingAssets(listing, supabase);

  return (
    <ListingView
      listing={listing}
      coverUrl={coverUrl}
      rooms={rooms}
      spacePhotos={spacePhotos}
      reviews={EMPTY_REVIEWS}
      preview
    />
  );
}
