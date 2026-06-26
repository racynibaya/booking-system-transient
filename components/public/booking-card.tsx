"use client";

import "react-day-picker/style.css";

import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import {
  createGatewayCheckout,
  createPublicBooking,
  submitProof,
  type PublicPaymentMethod,
} from "@/app/[slug]/actions";
import { useSelectedRoom } from "@/components/public/selected-room-context";
import { isRangeBookable, unitsAvailableOn } from "@/lib/availability";
import { formatDateShort, fromDateStr, toDateStr, todayStr } from "@/lib/dates";
import { compressImage } from "@/lib/image";
import { computeTotal, nights } from "@/lib/pricing";

export type PublicRoom = {
  id: string;
  name: string;
  capacity: number;
  quantity: number;
  base_price: number;
  description: string | null;
  photos: string[];
  bookings: { check_in: string; check_out: string }[];
  blocks: { start_date: string; end_date: string }[];
};

const fieldClass =
  "h-11 w-full rounded-sm border border-hairline bg-canvas px-3 text-body-md text-ink placeholder:text-muted-soft transition-colors focus:border-border-strong focus:outline-none";
const labelClass = "text-caption text-muted";
// Shared primary CTA — the brand sea gradient with a soft sea-tinted lift.
const ctaClass =
  "h-12 w-full rounded-full bg-linear-to-r from-sunset-1 via-sunset-2 to-sunset-3 text-button-md text-on-primary shadow-[0_12px_30px_-12px_rgba(31,111,120,0.5)] transition-[transform,opacity] hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export function BookingCard({
  rooms,
  propertyName,
  area,
  acceptsOnlinePayment,
  source,
}: {
  rooms: PublicRoom[];
  propertyName: string;
  area: string | null;
  acceptsOnlinePayment: boolean;
  source?: string;
}) {
  const { selectedRoomId: roomId, setSelectedRoomId: setRoomId } = useSelectedRoom();
  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  // The calendar is collapsed by default; tapping a date cell reveals it (Airbnb-style).
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeField, setActiveField] = useState<"in" | "out">("in");
  const [step, setStep] = useState<"select" | "details" | "payment" | "done">("select");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Set once the hold succeeds (F1.4 deposit step).
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [methods, setMethods] = useState<PublicPaymentMethod[]>([]);
  // Which saved method the guest is paying with — they only ever use one, so we show one at a time
  // instead of stacking every QR (scales to any number of methods).
  const [payMethodIdx, setPayMethodIdx] = useState(0);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [payingOnline, setPayingOnline] = useState(false);
  // Read synchronously by the beforeunload guard so it can tell an INTENTIONAL pay-online redirect
  // apart from an accidental tab close (state would be stale inside that listener's closure).
  const payingOnlineRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  // react-day-picker speaks Date; availability + the server action speak YYYY-MM-DD
  // strings. from = check-in, to = check-out, half-open [checkIn, checkOut) — so the
  // checkout day stays bookable and a 1-night stay is two adjacent days.
  const checkIn = range?.from ? toDateStr(range.from) : "";
  const checkOut = range?.to ? toDateStr(range.to) : "";

  // Reuse the same per-day rule the operator calendar/RPC use, so sold-out days can't
  // be selected. Memoized per room since the booking/block sets are stable per room.
  const stays = useMemo(
    () => room?.bookings.map((b) => ({ checkIn: b.check_in, checkOut: b.check_out })) ?? [],
    [room],
  );
  const blockRanges = useMemo(
    () => room?.blocks.map((b) => ({ start: b.start_date, end: b.end_date })) ?? [],
    [room],
  );
  const disabledDays = useMemo(
    () => [
      { before: fromDateStr(todayStr()) },
      (day: Date) =>
        !!room && unitsAvailableOn(toDateStr(day), room.quantity, stays, blockRanges) === 0,
    ],
    [room, stays, blockRanges],
  );
  // "Booked" is a visual modifier, not a disable rule — sold-out days are already in
  // disabledDays. Past days are excluded so they read as "past" (faded), while taken
  // future days get the distinct struck-through "booked" treatment.
  const bookedDays = useMemo(
    () => (day: Date) => {
      if (!room) return false;
      const ds = toDateStr(day);
      if (ds < todayStr()) return false;
      return unitsAvailableOn(ds, room.quantity, stays, blockRanges) === 0;
    },
    [room, stays, blockRanges],
  );

  const datesValid = checkIn !== "" && checkOut !== "" && checkOut > checkIn;
  const guestsValid = !!room && guests >= 1 && guests <= room.capacity;
  const available = useMemo(() => {
    if (!room || !datesValid) return true;
    return isRangeBookable({ checkIn, checkOut }, room.quantity, stays, blockRanges);
  }, [room, checkIn, checkOut, datesValid, stays, blockRanges]);
  const canContinue = datesValid && guestsValid && available;

  const stayNights = datesValid ? nights(checkIn, checkOut) : 0;
  const total = room ? computeTotal(room.base_price, stayNights) : 0;

  // Tick once a second, only while the deposit countdown is on screen.
  useEffect(() => {
    if (step !== "payment") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  // While the deposit hold is live, intercept refresh / tab-close / back so the guest
  // can't accidentally drop their held slot. Browsers show their own generic confirm;
  // the explicit "you'll lose your spot" copy is in the card below.
  useEffect(() => {
    if (step !== "payment") return;
    const warn = (e: BeforeUnloadEvent) => {
      // Paying online navigates away on purpose — don't fight it. The hold lives in the DB, not the
      // tab, so it isn't lost; the guard is only for an accidental refresh/close mid-deposit.
      if (payingOnlineRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);
  const msLeft = holdExpiresAt ? new Date(holdExpiresAt).getTime() - now : 0;
  const countdown =
    msLeft > 0
      ? `${Math.floor(msLeft / 60000)}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}`
      : null;

  async function reserve() {
    if (!room) return;
    setError(null);
    setPending(true);
    const res = await createPublicBooking({
      roomTypeId: room.id,
      checkIn,
      checkOut,
      numGuests: guests,
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      source,
    });
    setPending(false);
    if (res.ok) {
      setBookingId(res.bookingId);
      setMethods(res.paymentMethods);
      setDeposit(res.deposit);
      setHoldExpiresAt(res.holdExpiresAt);
      setStep("payment");
    } else setError(res.error);
  }

  // Online deposit: hand off to the host's hosted PayMongo page. The webhook confirms the booking;
  // the guest comes back to /{slug}/pay/return. We don't flip step here — the redirect leaves the
  // page, and the beforeunload guard is fine to ignore since the hold is being paid, not abandoned.
  async function payOnline() {
    if (!bookingId) return;
    setError(null);
    setPayingOnline(true);
    payingOnlineRef.current = true; // suppress the leave-tab guard for this intentional redirect
    const res = await createGatewayCheckout(bookingId);
    if (res.ok) {
      window.location.href = res.checkoutUrl;
    } else {
      setPayingOnline(false);
      payingOnlineRef.current = false;
      setError(res.error);
    }
  }

  async function sendProof() {
    if (!bookingId || !proofFile) return;
    setError(null);
    setPending(true);
    // Shrink the receipt screenshot before upload (keeps it legible; cuts proof storage).
    const proof = await compressImage(proofFile, { maxDim: 1600, quality: 0.85 });
    const fd = new FormData();
    fd.set("bookingId", bookingId);
    fd.set("proof", proof);
    const res = await submitProof(fd);
    setPending(false);
    if (res.ok) setStep("done");
    else setError(res.error);
  }

  // White reserve card on the light listing — the key conversion surface, so it floats on the
  // high-elevation tier (sea-tinted depth + top-edge highlight), ink text, hairline border.
  const cardClass = "w-full rounded-md border border-hairline bg-canvas p-5 text-ink shadow-e3";

  if (rooms.length === 0) {
    return (
      <div className={cardClass}>
        <p className="text-body-md text-muted">This place isn&apos;t taking bookings yet.</p>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className={`${cardClass} animate-room-swap`}>
        <p className="text-title-md font-semibold text-ink">Pay your deposit</p>
        <p className="mt-1 text-caption text-muted">
          {room?.name} · {formatDateShort(checkIn)} → {formatDateShort(checkOut)}
        </p>

        {countdown ? (
          <p className="mt-3 text-body-sm text-body">
            Slot held for <span className="font-semibold text-ink">{countdown}</span> — send the
            deposit now, then upload your screenshot.
          </p>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-sm border border-error/20 bg-error/10 p-3 text-body-sm text-error">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Your timer ran out, so this slot may have just been booked by someone else. If
              you&apos;ve already paid, upload your receipt — and if it&apos;s no longer available,
              the host will refund your deposit in full.
            </span>
          </div>
        )}

        {countdown && (
          <p className="mt-3 flex items-start gap-2 rounded-sm border border-primary/25 bg-primary-disabled/40 p-3 text-body-sm text-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Keep this tab open — if you refresh or leave, you&apos;ll lose your held spot.
            </span>
          </p>
        )}

        {acceptsOnlinePayment && (
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" disabled={payingOnline} onClick={payOnline} className={ctaClass}>
              {payingOnline ? "Opening secure checkout…" : `Pay ₱${deposit ?? "—"} online`}
            </button>
            <p className="text-center text-caption text-muted">
              Instant confirmation — pay on a secure PayMongo page and your booking is confirmed the
              moment it goes through.
            </p>
            <div className="mt-2 flex items-center gap-3 text-caption-sm text-muted-soft">
              <span className="h-px flex-1 bg-hairline" />
              or send it manually
              <span className="h-px flex-1 bg-hairline" />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-sm border border-hairline bg-surface-soft p-4">
          <p className="text-display-sm text-ink">
            ₱{deposit ?? "—"}
            <span className="text-body-sm font-normal text-muted"> deposit</span>
          </p>
          {methods.length > 0 ? (
            (() => {
              const m = methods[payMethodIdx] ?? methods[0];
              return (
                <div className="mt-3 flex flex-col gap-3">
                  {/* One method at a time. With several, a single selector picks which to pay with —
                      no scrolling past a wall of QR codes. With one, the picker is hidden. */}
                  {methods.length > 1 && (
                    <label className="flex flex-col gap-1">
                      <span className="text-caption font-medium text-muted">Pay with</span>
                      <div className="relative">
                        <select
                          value={payMethodIdx}
                          onChange={(e) => setPayMethodIdx(Number(e.target.value))}
                          className={`${fieldClass} appearance-none pr-10 font-medium`}
                        >
                          {methods.map((opt, i) => (
                            <option key={i} value={i} className="text-ink">
                              {opt.label}
                              {opt.accountNumber ? ` · ${opt.accountNumber}` : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
                      </div>
                    </label>
                  )}

                  <div className="flex flex-col gap-0.5 text-body-sm text-body">
                    {methods.length === 1 && (
                      <span className="text-caption font-medium text-muted">{m.label}</span>
                    )}
                    {m.accountNumber && (
                      <span>
                        {m.bankName ? `${m.bankName}: ` : ""}
                        <span className="font-semibold text-ink">{m.accountNumber}</span>
                      </span>
                    )}
                    {m.accountName && <span className="text-muted">{m.accountName}</span>}
                    {m.qrUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote QR, matches the cover-image pattern
                      <img
                        src={m.qrUrl}
                        alt={`${m.label} QR code`}
                        className="mt-2 size-40 rounded-sm border border-hairline bg-white object-contain p-1"
                      />
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="mt-3 text-body-sm text-muted">
              The host hasn&apos;t added payment details yet — please contact them to pay.
            </p>
          )}
        </div>

        {/* Refund frame (B): honest, no Tuloy guarantee. We record money, never hold it — the
            deposit goes straight to the host, so refunds are the host's to handle, not ours. */}
        <p className="mt-3 text-caption text-muted">
          Your deposit secures the booking. Cancellations &amp; refunds are handled directly by the
          host per their policy.
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className={labelClass}>Upload your payment receipt</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="text-body-sm text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-ink file:px-3 file:py-2 file:text-button-sm file:text-canvas"
          />
        </label>

        {error && <p className="mt-3 text-body-sm text-error">{error}</p>}

        <button
          type="button"
          disabled={pending || !proofFile}
          onClick={sendProof}
          className={`mt-4 ${ctaClass}`}
        >
          {pending ? "Submitting…" : "I've paid — submit proof"}
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={`${cardClass} animate-room-swap`}>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-display-sm text-ink">Proof received!</h2>
        <p className="mt-2 text-body-sm text-body">
          Thanks — we&apos;ve sent your payment proof to the host for {room?.name},{" "}
          {formatDateShort(checkIn)} → {formatDateShort(checkOut)}. They&apos;ll confirm your
          booking shortly.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-0.5">
        <p className="text-title-md font-semibold text-ink">{propertyName}</p>
        {(area || step === "details") && (
          <p className="text-caption text-muted">
            {step === "details" ? "Almost there — just your details" : area}
          </p>
        )}
      </div>

      {step === "select" ? (
        <div key="select" className="mt-4 flex animate-room-swap flex-col gap-3">
          {rooms.length > 1 ? (
            // Multi-room: make the choice unmistakable so guests don't assume the first room
            // is the only one. Emphasized label + count badge, stronger field, helper line.
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-caption-sm font-semibold tracking-wide text-muted uppercase">
                  Choose your room
                </span>
                <span className="rounded-full bg-surface-strong px-2 py-0.5 text-caption-sm font-semibold text-ink">
                  {rooms.length} rooms
                </span>
              </div>
              <div className="relative">
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`${fieldClass} appearance-none border-border-strong bg-surface-soft pr-10 font-medium`}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} className="text-ink">
                      {r.name} · ₱{r.base_price}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
              </div>
              <span className="text-caption-sm text-muted">
                Tap to compare all {rooms.length} rooms
              </span>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Room</span>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className={fieldClass}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id} className="text-ink">
                    {r.name} · ₱{r.base_price}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Nightly rate headline; the full total drops to the breakdown once dates are set. */}
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-display-md text-ink">
              ₱{room?.base_price ?? "—"}
              <span className="text-body-sm font-normal text-muted"> / night</span>
            </p>
            {room && (
              <p className="text-caption text-muted">
                up to {room.capacity} guest{room.capacity > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Dates + guests composite field. Tapping a date cell reveals the calendar. */}
          <div className="overflow-hidden rounded-md border border-hairline">
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setActiveField("in");
                  setCalendarOpen(true);
                }}
                className={`flex flex-col items-start gap-0.5 border-r border-hairline px-3 py-2.5 text-left transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  calendarOpen && activeField === "in" ? "bg-surface-strong" : ""
                }`}
              >
                <span className="text-caption-sm font-semibold tracking-wide text-muted uppercase">
                  Check-in
                </span>
                <span className={`text-body-md ${checkIn ? "text-ink" : "text-muted-soft"}`}>
                  {checkIn ? formatDateShort(checkIn) : "Add date"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveField("out");
                  setCalendarOpen(true);
                }}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  calendarOpen && activeField === "out" ? "bg-surface-strong" : ""
                }`}
              >
                <span className="text-caption-sm font-semibold tracking-wide text-muted uppercase">
                  Checkout
                </span>
                <span className={`text-body-md ${checkOut ? "text-ink" : "text-muted-soft"}`}>
                  {checkOut ? formatDateShort(checkOut) : "Add date"}
                </span>
              </button>
            </div>

            <div className="relative border-t border-hairline focus-within:bg-surface-soft">
              <div className="pointer-events-none flex items-center justify-between px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption-sm font-semibold tracking-wide text-muted uppercase">
                    Guests
                  </span>
                  <span className="text-body-md text-ink">
                    {guests} guest{guests > 1 ? "s" : ""}
                  </span>
                </div>
                <ChevronDown className="size-4 text-muted" />
              </div>
              <select
                aria-label="Guests"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              >
                {Array.from({ length: room?.capacity ?? 1 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="text-ink">
                    {n} guest{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calendar — collapsed until a date cell is tapped; auto-closes on a full range. */}
          {calendarOpen && (
            <div className="booking-calendar flex animate-room-swap justify-center rounded-md border border-hairline bg-surface-soft px-1 py-2">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  // v9 sets from===to on the first click; only collapse once a real
                  // multi-night range (checkout after check-in) is chosen.
                  if (r?.from && r?.to && r.to.getTime() > r.from.getTime()) {
                    setCalendarOpen(false);
                  }
                }}
                disabled={disabledDays}
                excludeDisabled
                modifiers={{ booked: bookedDays }}
                modifiersClassNames={{ booked: "rdp-booked" }}
                style={
                  {
                    "--rdp-accent-color": "var(--color-primary)",
                    "--rdp-accent-background-color": "var(--color-primary)",
                    "--rdp-today-color": "var(--color-primary)",
                  } as CSSProperties
                }
              />
            </div>
          )}

          {datesValid && !available && (
            <p className="text-body-sm text-error">Not available for those dates.</p>
          )}

          {/* Pricing breakdown — only the lines our model actually has (no fabricated fees). */}
          {datesValid && available && (
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-soft p-4">
              <div className="flex items-center justify-between text-body-sm text-body">
                <span>
                  ₱{room?.base_price} × {stayNights} {stayNights === 1 ? "night" : "nights"}
                </span>
                <span>₱{total}</span>
              </div>
              <div className="flex items-center justify-between border-t border-hairline pt-2 text-title-md font-semibold text-ink">
                <span>Total</span>
                <span>₱{total}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep("details")}
            className={`mt-1 ${ctaClass}`}
          >
            Reserve
          </button>

          <p className="text-center text-caption text-muted">You won&apos;t be charged yet</p>
        </div>
      ) : (
        <div key="details" className="mt-4 flex animate-room-swap flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </label>

          {error && <p className="text-body-sm text-error">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("select")}
              className="h-12 rounded-full border border-hairline px-5 text-button-sm text-ink transition-colors hover:bg-surface-soft"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending || name.trim() === "" || email.trim() === ""}
              onClick={reserve}
              className={`flex-1 ${ctaClass}`}
            >
              {pending ? "Reserving…" : "Confirm reservation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
