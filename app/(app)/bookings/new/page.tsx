import { PauseCircle } from "lucide-react";
import Link from "next/link";

import { ManualBookingForm } from "@/components/bookings/manual-booking-form";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getBookingsPaused, getManualBookingFormData, requireUser } from "@/lib/supabase/dal";

import { createManualBooking } from "../actions";

// F2.2 — manual booking entry. Mirrors properties/new: a thin Server Component that
// fetches the picker dataset (properties → rooms → availability) and hands it to the
// client form. The form posts to createManualBooking, which reuses the same
// create_booking_hold RPC as the public guest flow (one booking engine).
export default async function NewBookingPage() {
  await requireUser();
  // Lapsed + enforced → new bookings are paused. Show it upfront rather than letting the operator fill
  // the whole form and fail at submit. The engine guard (create_booking_hold) remains the backstop.
  const [properties, bookingsPaused] = await Promise.all([
    getManualBookingFormData(),
    getBookingsPaused(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/bookings" className="text-body-sm text-muted transition-colors hover:text-ink">
          ← Bookings
        </Link>
        <PageHeader
          title="New booking"
          description="Record a walk-in, phone, or messenger booking."
        />
      </div>
      {bookingsPaused ? (
        <EmptyState
          icon={PauseCircle}
          title="New bookings are paused"
          description="Your plan lapsed, so you can’t take new bookings until you renew. Your property and existing bookings are safe."
          action={
            <Link href="/settings" className={buttonClassName({ size: "sm" })}>
              Renew your plan
            </Link>
          }
        />
      ) : (
        <Card className="p-5 md:p-6">
          {properties.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-body-md text-body">
                You need a property with at least one room before you can add a booking.
              </p>
              <Link href="/properties/new" className={buttonClassName({ size: "sm" })}>
                Add a property
              </Link>
            </div>
          ) : (
            <ManualBookingForm properties={properties} action={createManualBooking} />
          )}
        </Card>
      )}
    </div>
  );
}
