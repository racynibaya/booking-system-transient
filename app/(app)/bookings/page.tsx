import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import Link from "next/link";

import { ConfirmBookingButton } from "@/components/bookings/confirm-booking-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { fromDateStr } from "@/lib/dates";
import { getPendingConfirmations, requireUser } from "@/lib/supabase/dal";

function prettyDate(s: string) {
  return format(fromDateStr(s), "MMM d");
}

function peso(amount: number | null) {
  return amount == null ? "—" : `₱${amount.toLocaleString("en-PH")}`;
}

// Minimal "Pending confirmations" view (F1.5). Deliberately thin — the full
// bookings dashboard (filters, table, cancel) is F2.1. Here an operator sees
// deposits awaiting their confirmation, eyeballs the proof, and taps Confirm.
export default async function BookingsPage() {
  await requireUser();
  const pending = await getPendingConfirmations();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookings" description="Deposits waiting for your confirmation." />

      {pending.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing to confirm"
          description="When a guest pays a deposit and uploads their proof, it'll show up here for you to confirm."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((b) => (
            <Card key={b.id} className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-title-md text-ink">{b.guest_name}</p>
                  <p className="mt-0.5 text-body-sm text-muted">
                    {b.properties?.name ?? "—"}
                    {b.room_types?.name ? ` · ${b.room_types.name}` : ""}
                  </p>
                </div>
                <ConfirmBookingButton bookingId={b.id} guestName={b.guest_name} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <Detail
                  label="Dates"
                  value={`${prettyDate(b.check_in)} – ${prettyDate(b.check_out)}`}
                />
                <Detail label="Guests" value={String(b.num_guests)} />
                <Detail label="Deposit" value={peso(b.deposit_amount)} />
                <Detail label="Total" value={peso(b.total_amount)} />
              </dl>

              <div className="flex flex-wrap items-center gap-4 border-t border-hairline-soft pt-3 text-body-sm">
                {b.guest_phone && <span className="text-muted">{b.guest_phone}</span>}
                {b.guest_email && <span className="text-muted">{b.guest_email}</span>}
                {b.proofUrl ? (
                  <Link
                    href={b.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline underline-offset-2 hover:text-primary"
                  >
                    View payment proof
                  </Link>
                ) : (
                  <span className="text-muted-soft">No proof uploaded</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption-sm text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-body-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
