import { ArrowLeft, ChevronRight, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { STATUS_LABELS } from "@/lib/bookings";
import { formatDateShort } from "@/lib/dates";
import { getGuest, requireUser } from "@/lib/supabase/dal";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const TONE: Partial<Record<BookingStatus, "success" | "warning" | "danger" | "muted">> = {
  confirmed: "success",
  completed: "success",
  awaiting_confirmation: "warning",
  held: "warning",
  cancelled: "danger",
  no_show: "danger",
  expired: "muted",
};

// S1 — one guest: who they are + every booking they've made with you.
export default async function GuestProfilePage({ params }: { params: Promise<{ key: string }> }) {
  await requireUser();
  const { key } = await params;
  const g = await getGuest(decodeURIComponent(key));
  if (!g) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/guests"
          className="inline-flex items-center gap-1 text-body-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Guests
        </Link>
        <PageHeader
          title={g.name}
          description={`${g.stays} ${g.stays === 1 ? "stay" : "stays"} · ${peso(g.totalValue)} in bookings`}
          action={g.stays > 1 ? <Badge tone="accent">Repeat guest</Badge> : undefined}
        />
      </div>

      {/* Contact */}
      <div className="flex flex-wrap gap-2">
        {g.phone && (
          <a
            href={`tel:${g.phone}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-surface-soft"
          >
            <Phone className="size-4 text-muted" /> {g.phone}
          </a>
        )}
        {g.email && (
          <a
            href={`mailto:${g.email}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-surface-soft"
          >
            <Mail className="size-4 text-muted" /> {g.email}
          </a>
        )}
      </div>

      {/* Booking history */}
      <div className="flex flex-col gap-2">
        <h2 className="text-title-md text-ink">Booking history</h2>
        <Card elevation={1} className="flex flex-col divide-y divide-hairline-soft p-0">
          {g.bookings.map((b) => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="group flex items-center gap-3 p-4 transition-colors first:rounded-t-md last:rounded-b-md hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-title-sm text-ink">
                    {formatDateShort(b.check_in)} → {formatDateShort(b.check_out)}
                  </p>
                  <Badge tone={TONE[b.status as BookingStatus] ?? "neutral"}>
                    {STATUS_LABELS[b.status as BookingStatus]}
                  </Badge>
                </div>
                <p className="truncate text-caption-sm text-muted">
                  {b.room_types?.name ?? "Room"} · {b.num_guests} guest{b.num_guests > 1 ? "s" : ""}
                </p>
              </div>
              <span className="shrink-0 text-title-sm text-ink">
                {b.total_amount != null ? peso(b.total_amount) : "—"}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
