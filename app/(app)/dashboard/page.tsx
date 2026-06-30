import { Check, Moon, Sun, Sunrise } from "lucide-react";

import { DashboardDeck } from "@/components/dashboard/dashboard-deck";
import { DeckShareButton } from "@/components/dashboard/deck-share-button";
import {
  OnboardingProgress,
  type BookingPageInfo,
  type SetupStep,
} from "@/components/dashboard/onboarding-progress";
import { NeedsAction } from "@/components/dashboard/needs-action";
import { OccupancyCard } from "@/components/dashboard/occupancy-card";
import { OwesList } from "@/components/dashboard/owes-list";
import { PropertyCard } from "@/components/properties/property-card";
import { ShareLinkButton } from "@/components/properties/share-link-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import {
  getCurrentTenant,
  getNeedsActionCounts,
  getOccupancySnapshot,
  getPaymentMethods,
  getProperties,
  getRevenueSummary,
  requireUser,
} from "@/lib/supabase/dal";
import type { PageStatus } from "@/components/properties/property-card";

export default async function DashboardPage() {
  await requireUser();
  const [tenant, properties, paymentMethods, revenue, occupancy, needsAction] = await Promise.all([
    getCurrentTenant(),
    getProperties(),
    getPaymentMethods(),
    getRevenueSummary(),
    getOccupancySnapshot(),
    getNeedsActionCounts(),
  ]);

  const roomCount = properties.reduce((n, p) => n + (p.room_types?.[0]?.count ?? 0), 0);
  const hasProperty = properties.length > 0;
  const isVerified = tenant?.verification_status === "approved";
  // The booking page's REAL public state: live once approved, else under review.
  const pageStatus: PageStatus = isVerified ? "live" : "review";

  // Time-of-day greeting + matching coastal icon (sunrise → sun → moon), in Manila time so it
  // reads right for San Juan operators regardless of where the server renders.
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }).format(new Date()),
  );
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const tod = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const DayIcon = hour < 12 ? Sunrise : hour < 18 ? Sun : Moon;
  const greeting = tenant?.name ? `${partOfDay}, ${tenant.name}.` : "Welcome to Tuloy.";
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const primary = properties[0];
  const firstPropertyHref = hasProperty ? `/properties/${properties[0].id}` : "/properties/new";
  const steps: SetupStep[] = [
    { label: "Add your property", done: hasProperty, href: firstPropertyHref },
    { label: "Add a room type", done: roomCount > 0, href: firstPropertyHref },
    { label: "Add a GCash payout", done: (paymentMethods?.length ?? 0) > 0, href: "/settings" },
    { label: "Get verified", done: isVerified, href: "/verification" },
  ];
  const setupComplete = steps.every((s) => s.done);
  const bookingPage: BookingPageInfo | undefined = primary
    ? { name: primary.name, slug: primary.slug, status: pageStatus }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* The signature: greeting + money thesis fused on a living coastal deck. */}
      <div className="animate-card-rise">
        <DashboardDeck
          date={today}
          greeting={greeting}
          partOfDay={tod}
          icon={DayIcon}
          collectedThisWeek={revenue.collectedThisWeek}
          comingThisMonth={revenue.comingThisMonth}
          owesTotal={revenue.owesTotal}
          owesCount={revenue.owes.length}
          addBookingHref="/bookings/new"
          share={primary && <DeckShareButton slug={primary.slug} name={primary.name} />}
        />
      </div>

      {/* Still setting up: the checklist sits right under the deck. */}
      {!setupComplete && (
        <div className="animate-card-rise" style={{ animationDelay: "70ms" }}>
          <OnboardingProgress steps={steps} bookingPage={bookingPage} />
        </div>
      )}

      {/* Who still owes you (left) + how-full / waiting-on-you (right). */}
      <div
        className="grid animate-card-rise grid-cols-1 gap-4 md:grid-cols-2"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex flex-col gap-4">
          <OwesList owes={revenue.owes} />
        </div>
        <div className="flex flex-col gap-4">
          <OccupancyCard snapshot={occupancy} />
          <NeedsAction
            needsConfirmation={needsAction.needsConfirmation}
            expiringHolds={needsAction.expiringHolds}
          />
        </div>
      </div>

      {/* Setup done AND not lapsed: a slim confirmation that the page is live. When the plan has
          lapsed the page is closed, so we suppress this — the closed banner carries that message. */}
      {setupComplete && bookingPage && pageStatus === "live" && (
        <Card
          className="flex animate-card-rise flex-wrap items-center justify-between gap-3 border-success/20 bg-linear-to-r from-success-bg/70 to-canvas p-5"
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <IconChip icon={Check} tone="success" />
            <div className="min-w-0">
              <p className="text-title-sm text-ink">Your booking page is live</p>
              <p className="truncate font-mono text-caption-sm text-muted">/{bookingPage.slug}</p>
            </div>
            <Badge tone="success">Live</Badge>
          </div>
          <ShareLinkButton slug={bookingPage.slug} name={bookingPage.name} />
        </Card>
      )}

      {hasProperty && (
        <section
          className="flex animate-card-rise flex-col gap-3"
          style={{ animationDelay: "210ms" }}
        >
          <h2 className="text-display-sm text-ink">Your properties</h2>
          <div className="flex flex-col gap-3">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} pageStatus={pageStatus} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
