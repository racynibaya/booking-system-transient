import Link from "next/link";

import { BookingsTable } from "@/components/bookings/bookings-table";
import { buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getBookings, requireUser } from "@/lib/supabase/dal";

// F2.1 bookings dashboard — the operator's daily driver. A single table over every
// booking with status + date-scope filters, deposit/total columns, and inline Confirm
// (for deposits awaiting confirmation) / Cancel actions. Supersedes the thin F1.5
// "Pending confirmations" list, which is now folded in as the "Awaiting" rows.
export default async function BookingsPage() {
  await requireUser();
  const bookings = await getBookings();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bookings"
        description="See, filter, and confirm or cancel your bookings."
        action={
          <Link href="/bookings/new" className={buttonClassName({ size: "sm" })}>
            + Add booking
          </Link>
        }
      />
      <BookingsTable bookings={bookings} />
    </div>
  );
}
