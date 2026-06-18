"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { useMemo, useState } from "react";

import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ConfirmBookingButton } from "@/components/bookings/confirm-booking-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { fromDateStr, todayStr } from "@/lib/dates";
import type { getBookings } from "@/lib/supabase/dal";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Awaited<ReturnType<typeof getBookings>>[number];
type Status = Database["public"]["Enums"]["booking_status"];

function prettyDate(s: string) {
  return format(fromDateStr(s), "MMM d");
}

function peso(amount: number | null) {
  return amount == null ? "—" : `₱${amount.toLocaleString("en-PH")}`;
}

// Status → label + on-brand badge tone. Rausch (accent) flags the one state that needs
// the operator's action; the error-red (danger) flags dead bookings; neutrals for the rest.
const STATUS_META: Record<
  Status,
  { label: string; tone: "neutral" | "accent" | "danger" | "muted" }
> = {
  pending: { label: "Pending", tone: "muted" },
  held: { label: "Held", tone: "muted" },
  awaiting_confirmation: { label: "Awaiting", tone: "accent" },
  confirmed: { label: "Confirmed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "muted" },
  completed: { label: "Completed", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
};

// Statuses an operator can still act on (Confirm/Cancel). Terminal ones show no actions.
const ACTIVE: Status[] = ["held", "awaiting_confirmation", "confirmed"];

// The status filter only offers values that actually appear in this operator's list.
const STATUS_ORDER: Status[] = [
  "awaiting_confirmation",
  "held",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
  "no_show",
  "pending",
];

type Scope = "upcoming" | "past" | "all";

const columns = (() => {
  const col = createColumnHelper<Booking>();
  return [
    col.accessor("guest_name", {
      header: "Guest",
      cell: (c) => {
        const b = c.row.original;
        const contact = b.guest_phone ?? b.guest_email;
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{b.guest_name}</p>
            {contact && <p className="mt-0.5 truncate text-caption-sm text-muted">{contact}</p>}
          </div>
        );
      },
    }),
    col.display({
      id: "stay",
      header: "Property · Room",
      cell: (c) => {
        const b = c.row.original;
        return (
          <div className="min-w-0">
            <p className="truncate text-body-sm text-ink">{b.properties?.name ?? "—"}</p>
            {b.room_types?.name && (
              <p className="mt-0.5 truncate text-caption-sm text-muted">{b.room_types.name}</p>
            )}
          </div>
        );
      },
    }),
    col.display({
      id: "dates",
      header: "Dates",
      cell: (c) => {
        const b = c.row.original;
        return (
          <span className="text-body-sm whitespace-nowrap text-ink">
            {prettyDate(b.check_in)} – {prettyDate(b.check_out)}
          </span>
        );
      },
    }),
    col.accessor("num_guests", {
      header: "Guests",
      cell: (c) => <span className="text-body-sm text-ink">{c.getValue()}</span>,
    }),
    col.accessor("status", {
      header: "Status",
      cell: (c) => {
        const meta = STATUS_META[c.getValue()];
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    }),
    col.accessor("deposit_amount", {
      header: "Deposit",
      cell: (c) => (
        <span className="text-body-sm whitespace-nowrap text-ink">{peso(c.getValue())}</span>
      ),
    }),
    col.accessor("total_amount", {
      header: "Total",
      cell: (c) => (
        <span className="text-body-sm whitespace-nowrap text-ink">{peso(c.getValue())}</span>
      ),
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (c) => {
        const b = c.row.original;
        if (!ACTIVE.includes(b.status)) return null;
        return (
          <div className="flex justify-end gap-2 whitespace-nowrap">
            {b.status === "awaiting_confirmation" && (
              <ConfirmBookingButton bookingId={b.id} guestName={b.guest_name} />
            )}
            <CancelBookingButton bookingId={b.id} guestName={b.guest_name} />
          </div>
        );
      },
    }),
  ];
})();

// F2.1 bookings dashboard. Client-side status + date-scope filtering over the operator's
// full booking list (lean at transient-rental volumes); the table is the single surface for
// confirming and cancelling. Inventory effects are handled server-side by the status write.
export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [scope, setScope] = useState<Scope>("upcoming");

  const today = todayStr();

  const rows = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      // Date-string compare is chronological for YYYY-MM-DD. Scope is on check-out so a
      // currently-staying guest counts as upcoming, not past.
      if (scope === "upcoming" && b.check_out < today) return false;
      if (scope === "past" && b.check_out >= today) return false;
      return true;
    });
  }, [bookings, statusFilter, scope, today]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption-sm text-muted">Status</span>
          <Select
            className="h-11 w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption-sm text-muted">Dates</span>
          <Select
            className="h-11 w-40"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All dates</option>
          </Select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={bookings.length === 0 ? "No bookings yet" : "No bookings match"}
          description={
            bookings.length === 0
              ? "When a guest books — or you log a walk-in — it'll show up here."
              : "Try a different status or date range."
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-hairline-soft">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-caption-sm font-medium text-muted">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-hairline-soft last:border-0 hover:bg-surface-soft"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
