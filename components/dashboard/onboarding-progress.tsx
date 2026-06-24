import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ShareLinkButton } from "@/components/properties/share-link-button";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type SetupStep = { label: string; done: boolean; href: string };
export type BookingPageInfo = { name: string; slug: string; live: boolean };

// Onboarding card: a progress ring (% of setup done) beside a vertical checklist of what's left,
// so a starting operator can see exactly what stands between them and taking bookings. The
// booking-page link + Share + Live/Under-review badge sit at the bottom — the thing they want to
// grab and post. Server component; the ring is static SVG, Share is the one client island.
export function OnboardingProgress({
  steps,
  bookingPage,
}: {
  steps: SetupStep[];
  bookingPage?: BookingPageInfo;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - pct / 100);

  return (
    <Card elevated className="flex flex-col gap-6 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-title-md text-ink">Finish setting up</h2>
          <p className="mt-0.5 text-body-sm text-muted">
            A few steps and guests can book you for real.
          </p>
        </div>
        {next && (
          <Link href={next.href} className={buttonClassName({ size: "sm" })}>
            Continue setup
          </Link>
        )}
      </div>

      <div className="flex flex-col items-center gap-7 md:flex-row md:items-start md:gap-9">
        <div className="relative shrink-0">
          <svg width={92} height={92} viewBox="0 0 92 92" aria-hidden="true">
            <circle
              cx={46}
              cy={46}
              r={R}
              fill="none"
              strokeWidth={9}
              style={{ stroke: "var(--color-surface-strong)" }}
            />
            <circle
              cx={46}
              cy={46}
              r={R}
              fill="none"
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              transform="rotate(-90 46 46)"
              style={{ stroke: "var(--color-primary)" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-title-md text-ink">
            {pct}%
          </span>
        </div>

        <ol className="flex w-full flex-col gap-1">
          {steps.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className={`group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  s === next ? "bg-primary/5" : ""
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                    s.done ? "bg-primary text-on-primary" : "border border-border-strong"
                  }`}
                >
                  {s.done && <Check className="size-3.5" />}
                </span>
                <span className={`flex-1 text-body-md ${s.done ? "text-muted" : "text-ink"}`}>
                  {s.label}
                </span>
                {!s.done && (
                  <ChevronRight className="size-4 text-muted-soft transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {bookingPage && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="min-w-0 truncate rounded-sm bg-surface-soft px-3 py-2 font-mono text-caption-sm text-muted">
              /{bookingPage.slug}
            </span>
            <Badge tone={bookingPage.live ? "success" : "warning"}>
              {bookingPage.live ? "Live" : "Under review"}
            </Badge>
          </div>
          <ShareLinkButton slug={bookingPage.slug} name={bookingPage.name} />
        </div>
      )}
    </Card>
  );
}
