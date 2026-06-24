import { ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/landing/site-footer";
import { type ListingCardData } from "@/components/marketplace/listing-card";
import { MarketplaceBrowser } from "@/components/marketplace/marketplace-browser";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
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
        <section className="mx-auto max-w-6xl px-6 pt-12 pb-8 sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas px-4 py-1.5 text-caption text-muted shadow-card">
            <ShieldCheck className="size-3.5 text-primary" /> Every host verified by Tuloy
          </span>
          <h1 className="mt-5 max-w-2xl font-display text-hero text-balance text-ink">
            Stay in San Juan, La Union
          </h1>
          <p className="mt-4 max-w-xl text-body-md text-body">
            Browse verified local stays with live availability. Reserve straight with the host — no
            booking fees, no middlemen.
          </p>
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
