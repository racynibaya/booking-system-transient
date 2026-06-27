import { ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/landing/site-footer";
import { type ListingCardData } from "@/components/marketplace/listing-card";
import { MarketplaceBrowser } from "@/components/marketplace/marketplace-browser";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { Reveal } from "@/components/motion";
import { createAnonClient } from "@/lib/supabase/server";

type RpcRow = {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  cover_image_path: string | null;
  from_price: number | null;
  featured: boolean;
};

export default async function MarketplaceHome() {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("list_public_listings");
  const rows = (data ?? []) as RpcRow[];

  // Resolve each cover to its public URL; next/image handles the card-sized resize via `sizes`
  // (same path the [slug] hero uses). Coverless listings fall back to the brand gradient.
  const cards: ListingCardData[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    area: r.area,
    fromPrice: r.from_price,
    featured: r.featured,
    coverUrl: r.cover_image_path
      ? supabase.storage.from("property-images").getPublicUrl(r.cover_image_path).data.publicUrl
      : null,
  }));

  return (
    <>
      <MarketplaceHeader />
      <main className="flex-1">
        {/* Hero band: a sea-glass depth wash + film grain so the headline sits on atmosphere
            instead of flat canvas, dissolving back into the page below. */}
        <section className="grain relative isolate overflow-hidden">
          <div className="surface-mesh absolute inset-0 -z-10" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-b from-transparent to-canvas" />
          <div className="mx-auto max-w-6xl px-6 pt-12 pb-10 sm:pt-16">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas/80 px-4 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
                <ShieldCheck className="size-3.5 text-primary" /> Every host verified by Tuloy
              </span>
              <h1 className="mt-5 max-w-2xl font-display text-hero text-balance text-ink">
                Stay in San Juan, La Union
              </h1>
              <p className="mt-4 max-w-xl text-body-md text-body">
                Every San Juan stay in one place — verified hosts, live availability, and a secure
                booking that beats chasing a dozen Messenger threads.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          {cards.length === 0 ? (
            <div className="rounded-md border border-hairline bg-surface-soft/50 px-6 py-16 text-center">
              <p className="text-body-md text-muted">No stays listed yet. Check back soon.</p>
            </div>
          ) : (
            <MarketplaceBrowser listings={cards} />
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
