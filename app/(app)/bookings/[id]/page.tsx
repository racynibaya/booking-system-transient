import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  Clock,
  Mail,
  MapPin,
  Phone,
  Receipt,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ConfirmBookingButton } from "@/components/bookings/confirm-booking-button";
import { HoldCountdown } from "@/components/bookings/hold-countdown";
import { MarkCollectedButton } from "@/components/bookings/mark-collected-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { isLive, STATUS_LABELS } from "@/lib/bookings";
import { formatDateShort, fromDateStr } from "@/lib/dates";
import { getBooking, requireUser } from "@/lib/supabase/dal";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const STATUS_TONE: Partial<Record<BookingStatus, "success" | "warning" | "danger" | "muted">> = {
  confirmed: "success",
  completed: "success",
  awaiting_confirmation: "warning",
  held: "warning",
  cancelled: "danger",
  no_show: "danger",
  expired: "muted",
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const nightsBetween = (ci: string, co: string) =>
  Math.max(1, Math.round((fromDateStr(co).getTime() - fromDateStr(ci).getTime()) / 86_400_000));

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-caption-sm text-muted">{label}</p>
        <div className="text-body-md text-ink">{children}</div>
      </div>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const b = await getBooking(id);
  if (!b) notFound();

  const status = b.status as BookingStatus;
  const paid = (b.payments ?? [])
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const balance = (b.total_amount ?? 0) - paid;
  const nights = nightsBetween(b.check_in, b.check_out);

  const actionable = status === "awaiting_confirmation" || status === "held";
  const canCancel = isLive(status);
  const showCollect = (status === "confirmed" || status === "completed") && balance > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1 text-body-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Bookings
        </Link>
        <PageHeader
          title={b.guest_name}
          description={`${b.room_types?.name ?? "Room"} · ${formatDateShort(b.check_in)} → ${formatDateShort(b.check_out)} · ${nights} night${nights > 1 ? "s" : ""}`}
          action={<Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABELS[status]}</Badge>}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Left: the facts */}
        <div className="flex flex-col gap-5">
          <Card elevation={1} className="p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <IconChip icon={CalendarRange} tone="sea" />
              <h2 className="text-title-md text-ink">Stay</h2>
            </div>
            <div className="divide-y divide-hairline-soft">
              <Row icon={CalendarRange} label="Dates">
                {formatDateShort(b.check_in)} → {formatDateShort(b.check_out)} · {nights} night
                {nights > 1 ? "s" : ""}
              </Row>
              <Row icon={BedDouble} label="Room">
                {b.room_types?.name ?? "—"} · {b.num_guests} guest{b.num_guests > 1 ? "s" : ""}
              </Row>
              <Row icon={MapPin} label="Property">
                {b.properties?.name ?? "—"}
              </Row>
            </div>
          </Card>

          <Card elevation={1} className="p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <IconChip icon={User} tone="sea" />
              <h2 className="text-title-md text-ink">Guest</h2>
            </div>
            <div className="divide-y divide-hairline-soft">
              <Row icon={User} label="Name">
                {b.guest_name}
              </Row>
              <Row icon={Phone} label="Phone">
                {b.guest_phone ? (
                  <a href={`tel:${b.guest_phone}`} className="text-primary hover:underline">
                    {b.guest_phone}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
              <Row icon={Mail} label="Email">
                {b.guest_email ? (
                  <a href={`mailto:${b.guest_email}`} className="text-primary hover:underline">
                    {b.guest_email}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
            </div>
          </Card>

          <Card elevation={1} className="p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <IconChip icon={Wallet} tone={balance > 0 ? "warning" : "success"} />
              <h2 className="text-title-md text-ink">Payment</h2>
            </div>
            <div className="divide-y divide-hairline-soft">
              <Row icon={Wallet} label="Deposit">
                {b.deposit_amount != null ? peso(b.deposit_amount) : "—"}
              </Row>
              <Row icon={Wallet} label="Total">
                {b.total_amount != null ? peso(b.total_amount) : "—"}
              </Row>
              <Row icon={Wallet} label="Collected">
                {peso(paid)}
              </Row>
              <Row icon={Wallet} label="Balance">
                <span className={balance > 0 ? "font-semibold text-warning" : "text-success"}>
                  {balance > 0 ? `${peso(balance)} due` : "Fully paid"}
                </span>
              </Row>
              {b.proofUrl && (
                <Row icon={Receipt} label="Payment proof">
                  <a
                    href={b.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    View receipt
                  </a>
                </Row>
              )}
            </div>
          </Card>
        </div>

        {/* Right rail: status, actions, timeline */}
        <div className="flex flex-col gap-5">
          <Card elevation={2} className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title-md text-ink">Status</h2>
              <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABELS[status]}</Badge>
            </div>

            {status === "held" && b.hold_expires_at && (
              <HoldCountdown expiresAt={b.hold_expires_at} />
            )}

            {actionable || canCancel || showCollect ? (
              <div className="flex flex-wrap gap-2">
                {actionable && <ConfirmBookingButton bookingId={b.id} guestName={b.guest_name} />}
                {showCollect && <MarkCollectedButton bookingId={b.id} balance={balance} />}
                {canCancel && <CancelBookingButton bookingId={b.id} guestName={b.guest_name} />}
              </div>
            ) : (
              <p className="text-body-sm text-muted">No actions available for this booking.</p>
            )}
          </Card>

          <Card elevation={1} className="flex flex-col gap-1 p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <IconChip icon={Clock} tone="sea" size="sm" />
              <h2 className="text-title-sm text-ink">Timeline</h2>
            </div>
            <Row icon={Clock} label="Requested">
              {formatDateShort(b.created_at.slice(0, 10))}
            </Row>
            {b.source && (
              <Row icon={MapPin} label="Source">
                <span className="capitalize">{b.source.replace(/_/g, " ")}</span>
              </Row>
            )}
            {status === "cancelled" && b.cancellation_reason && (
              <Row icon={Clock} label="Cancellation reason">
                {b.cancellation_reason}
              </Row>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
