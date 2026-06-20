import { Check, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { formatDateShort } from "@/lib/dates";
import { createServiceClient } from "@/lib/supabase/server";

// Where the guest lands after the hosted PayMongo page (createGatewayCheckout's successUrl). The
// webhook → confirm_booking_gateway is the source of truth (architecture P10); this page only
// REFLECTS the booking's current status. Confirmation is near-instant but async, so a freshly-paid
// booking may still read 'held' for a beat — we show a "confirming…" state that the guest can
// refresh. The booking id in ?b is the guest's own capability (same as the checkout action).

type BookingStatus = "held" | "awaiting_confirmation" | "confirmed" | "cancelled" | "expired";

async function loadBooking(bookingId: string, slug: string) {
  if (!bookingId) return null;
  const admin = createServiceClient();
  const { data } = await admin
    .from("bookings")
    .select("status, check_in, check_out, guest_name, property:properties(slug, name)")
    .eq("id", bookingId)
    .single();
  if (!data) return null;
  const property = data.property as { slug: string; name: string } | null;
  // Scope to the URL's host so a stray id from another listing can't render here.
  if (property?.slug !== slug) return null;
  return { ...data, property, status: data.status as BookingStatus };
}

const cardClass =
  "w-full max-w-md rounded-md border border-hairline bg-canvas p-6 text-ink shadow-card";

export default async function PayReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ b?: string }>;
}) {
  const { slug } = await params;
  const { b } = await searchParams;
  const booking = await loadBooking(b ?? "", slug);

  const backHref = `/${slug}`;
  const stay = booking
    ? `${formatDateShort(booking.check_in)} → ${formatDateShort(booking.check_out)}`
    : "";

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-canvas px-4 py-16">
      {!booking ? (
        <div className={cardClass}>
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-strong text-muted">
            <TriangleAlert className="size-5" />
          </span>
          <h1 className="mt-4 text-display-sm text-ink">We couldn&apos;t find that booking</h1>
          <p className="mt-2 text-body-sm text-body">
            The payment link may have expired. Head back to the listing to start again.
          </p>
          <Link
            href={backHref}
            className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-button-sm text-canvas transition-opacity hover:opacity-90"
          >
            Back to the listing
          </Link>
        </div>
      ) : booking.status === "confirmed" ? (
        <div className={cardClass}>
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
            <Check className="size-5" />
          </span>
          <h1 className="mt-4 text-display-sm text-ink">Booking confirmed!</h1>
          <p className="mt-2 text-body-sm text-body">
            Thanks{booking.guest_name ? `, ${booking.guest_name}` : ""} — your deposit went through
            and {booking.property?.name ?? "your stay"} is locked in for {stay}. The host will be in
            touch with the details.
          </p>
          <Link
            href={backHref}
            className="mt-5 inline-flex h-11 items-center rounded-full border border-hairline px-5 text-button-sm text-ink transition-colors hover:bg-surface-soft"
          >
            Back to the listing
          </Link>
        </div>
      ) : (
        <div className={cardClass}>
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-strong text-primary">
            <Clock className="size-5" />
          </span>
          <h1 className="mt-4 text-display-sm text-ink">Confirming your payment…</h1>
          <p className="mt-2 text-body-sm text-body">
            This usually takes only a few seconds. Refresh in a moment to see your confirmation — if
            your payment went through, {booking.property?.name ?? "your booking"} for {stay} is held
            for you.
          </p>
          <Link
            href={`${backHref}/pay/return?b=${b ?? ""}`}
            className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-button-sm text-canvas transition-opacity hover:opacity-90"
          >
            Refresh status
          </Link>
        </div>
      )}
    </main>
  );
}
