import { CalendarCheck, Lock, ShieldCheck } from "lucide-react";

import { type ListingCardData } from "@/components/marketplace/listing-card";
import { MarketplaceBrowser } from "@/components/marketplace/marketplace-browser";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { Stagger, StaggerItem } from "@/components/motion";
import { createAnonClient } from "@/lib/supabase/server";

// Regenerate at least hourly so the daily-rotation seed (below) flips shortly after midnight and new
// listings/prices stay fresh. The anon client carries no cookies, so without this the page would
// render once at build and freeze the order forever.
export const revalidate = 3600;

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
  const mapped: ListingCardData[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    area: r.area,
    fromPrice: r.from_price,
    featured: r.featured,
    coverUrl: r.cover_image_path
      ? supabase.storage.from("property-images").getPublicUrl(r.cover_image_path).data.publicUrl
      : null,
  }));

  // Fair exposure: rotate the listing order daily so no stay is permanently top-of-grid (in a
  // marketplace, top placement = more bookings). The shuffle is deterministic per Manila day, so it
  // stays stable within a visit (no jump on refresh) yet cycles every stay through the top over time.
  // The browse view also derives its section order from this order, so whole areas rotate too. The
  // only deliberate priority is the paid Featured rail — earned, not a freebie for a big barangay.
  const cards = seededShuffle(mapped, manilaDaySeed());

  return (
    <>
      <MarketplaceHeader />
      <main className="flex-1">
        {/* Hero band: a sea-glass depth wash + drifting aurora + film grain so the headline sits
            on living atmosphere instead of flat canvas, dissolving back into the page below. The
            band carries the headline + honest trust strip; the search field floats up from the
            browse section below to straddle this band's lower edge (the "search-first" signature). */}
        <section className="grain relative isolate overflow-hidden">
          <div className="surface-mesh absolute inset-0 -z-10" />
          <div aria-hidden className="hero-aurora -z-10 animate-aurora-drift" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-b from-transparent to-canvas" />
          <div className="mx-auto max-w-6xl px-6 pt-14 pb-24 text-center sm:pt-20 sm:pb-28">
            <Stagger className="flex flex-col items-center">
              <StaggerItem>
                <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas/80 px-4 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
                  <ShieldCheck className="size-3.5 text-primary" /> Every host verified by Tuloy
                </span>
              </StaggerItem>
              <StaggerItem>
                <h1 className="mt-6 max-w-3xl font-display text-hero text-balance text-ink">
                  Stay in San Juan, La Union
                </h1>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-4 max-w-xl text-body-md text-pretty text-body">
                  Every San Juan stay in one place — verified hosts, live availability, and a secure
                  booking that beats chasing a dozen Messenger threads.
                </p>
              </StaggerItem>
              <StaggerItem>
                <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-body-sm font-medium text-ink">
                  <TrustPoint icon={ShieldCheck} label="ID-verified hosts" />
                  <span aria-hidden className="hidden h-4 w-px bg-hairline sm:block" />
                  <TrustPoint icon={CalendarCheck} label="Live availability" />
                  <span aria-hidden className="hidden h-4 w-px bg-hairline sm:block" />
                  <TrustPoint icon={Lock} label="Secure deposit" />
                </ul>
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          {cards.length === 0 ? (
            <div className="-mt-10 rounded-2xl border border-hairline bg-canvas px-6 py-16 text-center shadow-e2">
              <p className="text-body-md text-muted">No stays listed yet. Check back soon.</p>
            </div>
          ) : (
            <MarketplaceBrowser listings={cards} />
          )}
        </section>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// A seed that changes once per Manila day (YYYY-MM-DD → int hash), so the rotation is fixed for the
// whole day and identical for every visitor that day — stable, cache-safe, and fair across days.
function manilaDaySeed(): number {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  let h = 0;
  for (let i = 0; i < ymd.length; i++) h = (Math.imul(h, 31) + ymd.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Deterministic Fisher–Yates driven by a mulberry32 PRNG: same seed ⇒ same order, so the daily seed
// gives a stable-yet-rotating shuffle without holding any per-listing ranking server-side.
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function TrustPoint({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} />
      {label}
    </li>
  );
}
