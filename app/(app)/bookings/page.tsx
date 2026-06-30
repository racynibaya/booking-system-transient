import { Users } from "lucide-react";
import Link from "next/link";

import { BookingsFilters } from "@/components/bookings/bookings-filters";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  filterAndSortByView,
  filterByStatus,
  parseBookingFilters,
  viewCounts,
} from "@/lib/bookings";
import { todayStr } from "@/lib/dates";
import {
  getBookingFilterOptions,
  getBookings,
  getCurrentTenant,
  requireUser,
} from "@/lib/supabase/dal";

import { BookingsLive } from "./bookings-live";

// F2.1 bookings dashboard — the operator's daily driver. Filtering is server-side and
// URL-driven (?property=&room=&status=&q=&from=&to=&view=), so a filtered board is
// shareable/bookmarkable and scales past a single client-loaded list. The scale-sensitive
// filters run in Postgres (getBookings); the smart views + status multi-select are applied
// here over the reconciled rows (see effectiveStatus / lib/bookings).
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireUser();
  const { status, view, ...sqlFilters } = parseBookingFilters(await searchParams);

  const [baseRows, options, tenant] = await Promise.all([
    getBookings(sqlFilters),
    getBookingFilterOptions(),
    getCurrentTenant(),
  ]);

  const today = todayStr();
  const counts = viewCounts(baseRows, today);
  const rows = filterAndSortByView(filterByStatus(baseRows, status), view, today);

  return (
    <div className="flex flex-col gap-6">
      {tenant && <BookingsLive tenantId={tenant.id} />}
      <PageHeader
        title="Bookings"
        description="See, filter, and confirm or cancel your bookings."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/guests" className={buttonClassName({ variant: "secondary", size: "sm" })}>
              <Users className="size-4" /> Guests
            </Link>
            <Link href="/bookings/new" className={buttonClassName({ size: "sm" })}>
              + Add booking
            </Link>
          </div>
        }
      />
      <BookingsFilters
        options={options}
        counts={counts}
        view={view}
        filters={{ ...sqlFilters, status }}
        resultCount={rows.length}
      />
      <BookingsTable
        bookings={rows}
        hasAnyBookings={baseRows.length > 0}
        view={view}
        today={today}
      />
    </div>
  );
}
