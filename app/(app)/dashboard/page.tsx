import { Check, Moon, Plus, Sun, Sunrise } from "lucide-react";
import Link from "next/link";

import {
  OnboardingProgress,
  type BookingPageInfo,
  type SetupStep,
} from "@/components/dashboard/onboarding-progress";
import { MoneyHero } from "@/components/dashboard/money-hero";
import { NeedsAction } from "@/components/dashboard/needs-action";
import { OccupancyCard } from "@/components/dashboard/occupancy-card";
import { OwesList } from "@/components/dashboard/owes-list";
import { PropertyCard } from "@/components/properties/property-card";
import { ShareLinkButton } from "@/components/properties/share-link-button";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import {
  getBookingsPaused,
  getCurrentTenant,
  getGatewayConnectionStatus,
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
  const [tenant, properties, paymentMethods, revenue, occupancy, needsAction, bookingsPaused] =
    await Promise.all([
      getCurrentTenant(),
      getProperties(),
      getPaymentMethods(),
      getRevenueSummary(),
      getOccupancySnapshot(),
      getNeedsActionCounts(),
      getBookingsPaused(),
    ]);

  const roomCount = properties.reduce((n, p) => n + (p.room_types?.[0]?.count ?? 0), 0);
  const hasProperty = properties.length > 0;
  const isVerified = tenant?.verification_status === "approved";
  const isBusiness = tenant?.plan === "business";
  // The booking page's REAL public state: closed when lapsed+enforced, else live once approved.
  const pageStatus: PageStatus = bookingsPaused ? "paused" : isVerified ? "live" : "review";

  // Online-payments gateway only matters on Business — fetch it only there (extra round-trip
  // for those operators only) so it can appear as its own checklist line.
  const gateway = isBusiness ? await getGatewayConnectionStatus() : null;

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
    ...(isBusiness
      ? [{ label: "Connect online payments", done: !!gateway?.connected, href: "/settings" }]
      : []),
    { label: "Get verified", done: isVerified, href: "/verification" },
  ];
  const setupComplete = steps.every((s) => s.done);
  const bookingPage: BookingPageInfo | undefined = primary
    ? { name: primary.name, slug: primary.slug, status: pageStatus }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + the two daily actions, one tap each. */}
      <header className="flex animate-card-rise flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconChip icon={DayIcon} size="lg" gradient className="hidden sm:flex" />
          <div>
            <p className="text-body-sm text-muted">{today}</p>
            <h1 className="mt-0.5 font-display text-display-xl text-ink">{greeting}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bookings/new" className={buttonClassName({ size: "sm" })}>
            <Plus className="size-4" /> Add booking
          </Link>
          {primary && <ShareLinkButton slug={primary.slug} name={primary.name} />}
        </div>
      </header>

      {/* Starting out: the checklist leads, since there's no money/occupancy yet. */}
      {!setupComplete && (
        <div className="animate-card-rise" style={{ animationDelay: "70ms" }}>
          <OnboardingProgress steps={steps} bookingPage={bookingPage} />
        </div>
      )}

      {/* Money (left) + how-full / waiting-on-you (right). */}
      <div
        className="grid animate-card-rise grid-cols-1 gap-4 md:grid-cols-2"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex flex-col gap-4">
          <MoneyHero
            collectedThisWeek={revenue.collectedThisWeek}
            comingThisMonth={revenue.comingThisMonth}
            owesTotal={revenue.owesTotal}
            owesCount={revenue.owes.length}
          />
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
