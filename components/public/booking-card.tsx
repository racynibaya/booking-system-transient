"use client";

import "react-day-picker/style.css";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import { createPublicBooking, submitProof, type GcashDetails } from "@/app/[slug]/actions";
import { useSelectedRoom } from "@/components/public/selected-room-context";
import { isRangeBookable, unitsAvailableOn } from "@/lib/availability";
import { fromDateStr, toDateStr, todayStr } from "@/lib/dates";
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
  "h-11 w-full rounded-sm border border-white/20 bg-white/10 px-3 text-body-md text-canvas placeholder:text-white/40 transition-colors focus:border-white/60 focus:outline-none";
const labelClass = "text-caption text-white/70";

export function BookingCard({
  rooms,
  propertyName,
  area,
}: {
  rooms: PublicRoom[];
  propertyName: string;
  area: string | null;
}) {
  const { selectedRoomId: roomId, setSelectedRoomId: setRoomId } = useSelectedRoom();
  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [step, setStep] = useState<"select" | "details" | "payment" | "done">("select");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Set once the hold succeeds (F1.4 deposit step).
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [gcash, setGcash] = useState<GcashDetails | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
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
    });
    setPending(false);
    if (res.ok) {
      setBookingId(res.bookingId);
      setGcash(res.gcash);
      setDeposit(res.deposit);
      setHoldExpiresAt(res.holdExpiresAt);
      setStep("payment");
    } else setError(res.error);
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

  const cardClass =
    "w-full rounded-md border border-white/15 bg-ink/50 p-5 text-canvas backdrop-blur-md md:max-w-sm";

  if (rooms.length === 0) {
    return (
      <div className={cardClass}>
        <p className="text-body-md text-white/80">This place isn&apos;t taking bookings yet.</p>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className={cardClass}>
        <p className="text-title-md font-semibold text-canvas">Pay your deposit</p>
        <p className="mt-1 text-caption text-white/60">
          {room?.name} · {checkIn} → {checkOut}
        </p>

        {countdown ? (
          <p className="mt-3 text-body-sm text-white/80">
            Slot held for <span className="font-semibold text-canvas">{countdown}</span> — send the
            deposit now, then upload your screenshot.
          </p>
        ) : (
          <p className="mt-3 text-body-sm text-white">
            Your hold has lapsed. Don&apos;t send payment yet — upload anyway and we&apos;ll try to
            recover your slot, or contact the host.
          </p>
        )}

        <div className="mt-4 rounded-sm border border-white/15 bg-white/5 p-4">
          <p className="text-display-sm text-canvas">
            ₱{deposit ?? "—"}
            <span className="text-body-sm font-normal text-white/60"> deposit</span>
          </p>
          {gcash?.number ? (
            <div className="mt-3 flex flex-col gap-0.5 text-body-sm text-white/85">
              <span>
                GCash: <span className="font-semibold text-canvas">{gcash.number}</span>
              </span>
              {gcash.name && <span className="text-white/70">{gcash.name}</span>}
            </div>
          ) : (
            <p className="mt-3 text-body-sm text-white/70">
              The host hasn&apos;t added GCash details yet — please contact them to pay.
            </p>
          )}
          {gcash?.qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote QR, matches the cover-image pattern
            <img
              src={gcash.qrUrl}
              alt="GCash QR code"
              className="mt-3 size-40 rounded-sm bg-white object-contain p-1"
            />
          )}
        </div>

        <label className="mt-4 flex flex-col gap-1">
          <span className={labelClass}>Upload your GCash receipt</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="text-body-sm text-white/80 file:mr-3 file:rounded-sm file:border-0 file:bg-canvas file:px-3 file:py-2 file:text-button-sm file:text-ink"
          />
        </label>

        {error && <p className="mt-3 text-body-sm text-white">{error}</p>}

        <button
          type="button"
          disabled={pending || !proofFile}
          onClick={sendProof}
          className="mt-4 h-12 w-full rounded-sm bg-canvas text-button-md text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : "I've paid — submit proof"}
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={cardClass}>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-display-sm text-canvas">Proof received!</h2>
        <p className="mt-2 text-body-sm text-white/80">
          Thanks — we&apos;ve sent your payment proof to the host for {room?.name}, {checkIn} →{" "}
          {checkOut}. They&apos;ll confirm your booking shortly.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-0.5">
        <p className="text-title-md font-semibold text-canvas">{propertyName}</p>
        {(area || step === "details") && (
          <p className="text-caption text-white/60">
            {step === "details" ? "Almost there — just your details" : area}
          </p>
        )}
      </div>

      {step === "select" ? (
        <div className="mt-4 flex flex-col gap-3">
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

          <div className="flex flex-col gap-1">
            <span className={labelClass}>
              {checkIn && checkOut
                ? `${checkIn} → ${checkOut}`
                : checkIn
                  ? "Pick a checkout date"
                  : "Select your dates"}
            </span>
            <div className="booking-calendar flex justify-center rounded-sm border border-white/20 bg-white/5 px-1 py-2">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                disabled={disabledDays}
                excludeDisabled
                style={
                  {
                    "--rdp-accent-color": "var(--color-primary)",
                    "--rdp-accent-background-color": "var(--color-primary)",
                    "--rdp-today-color": "var(--color-primary)",
                  } as CSSProperties
                }
              />
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Guests {room ? `(up to ${room.capacity})` : ""}</span>
            <input
              type="number"
              min={1}
              max={room?.capacity}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className={fieldClass}
            />
          </label>

          {datesValid && !available && (
            <p className="text-body-sm text-white/80">Not available for those dates.</p>
          )}

          <div className="mt-1 border-t border-white/15 pt-3">
            {datesValid ? (
              // Once dates are picked the TOTAL is the headline (with an explicit label),
              // and the nightly rate × nights drops to a small breakdown — so guests don't
              // mistake the per-night price for what they'll actually pay.
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-caption tracking-wide text-white/55 uppercase">Total</span>
                  <p className="text-display-md leading-none text-canvas">₱{total}</p>
                </div>
                <p className="shrink-0 pb-0.5 text-right text-caption text-white/65">
                  ₱{room?.base_price} / night
                  <br />× {stayNights} {stayNights === 1 ? "night" : "nights"}
                </p>
              </div>
            ) : (
              <div className="flex items-baseline justify-between">
                <p className="text-display-md text-canvas">
                  ₱{room?.base_price ?? "—"}
                  <span className="text-body-sm font-normal text-white/60"> / night</span>
                </p>
                {room && (
                  <p className="hidden text-caption text-white/60 sm:block">
                    up to {room.capacity} guests
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep("details")}
            className="h-12 w-full rounded-sm bg-canvas text-button-md text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reserve
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
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
            <span className={labelClass}>Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </label>

          {error && <p className="text-body-sm text-white">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("select")}
              className="h-12 rounded-sm border border-white/30 px-4 text-button-sm text-canvas transition-colors hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending || name.trim() === ""}
              onClick={reserve}
              className="h-12 flex-1 rounded-sm bg-canvas text-button-md text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Reserving…" : "Confirm reservation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
