"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { createPublicBooking } from "@/app/[slug]/actions";
import { isRangeBookable } from "@/lib/availability";
import { todayStr } from "@/lib/dates";

export type PublicRoom = {
  id: string;
  name: string;
  capacity: number;
  quantity: number;
  base_price: number;
  description: string | null;
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
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [step, setStep] = useState<"select" | "details" | "done">("select");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);
  const datesValid = checkIn !== "" && checkOut !== "" && checkOut > checkIn;
  const guestsValid = !!room && guests >= 1 && guests <= room.capacity;
  const available = useMemo(() => {
    if (!room || !datesValid) return true;
    return isRangeBookable(
      { checkIn, checkOut },
      room.quantity,
      room.bookings.map((b) => ({ checkIn: b.check_in, checkOut: b.check_out })),
      room.blocks.map((b) => ({ start: b.start_date, end: b.end_date })),
    );
  }, [room, checkIn, checkOut, datesValid]);
  const canContinue = datesValid && guestsValid && available;

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

  if (step === "done") {
    return (
      <div className={cardClass}>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-display-sm text-canvas">Reserved!</h2>
        <p className="mt-2 text-body-sm text-white/80">
          We&apos;re holding {room?.name} for {checkIn} → {checkOut} for the next 15 minutes. The
          host will confirm and share GCash deposit details to complete your booking.
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
            {step === "details" ? "Almost there — just your details" : `${area}, La Union`}
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

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Check-in</span>
              <input
                type="date"
                min={todayStr()}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Check-out</span>
              <input
                type="date"
                min={checkIn || todayStr()}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className={fieldClass}
              />
            </label>
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

          <div className="mt-1 flex items-baseline justify-between border-t border-white/15 pt-3">
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
