"use client";

import "react-day-picker/style.css";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { isRangeBookable, unitsAvailableOn } from "@/lib/availability";
import { fromDateStr, toDateStr, todayStr } from "@/lib/dates";
import { computeDeposit, computeTotal, nights } from "@/lib/pricing";
import { manualBookingInput, type ManualBookingInput } from "@/lib/validation";

import type { ActionResult } from "@/app/(app)/bookings/actions";
import type { getManualBookingFormData } from "@/lib/supabase/dal";

// Type-only import from the server-only DAL is erased at compile — no runtime violation —
// and keeps the row shape in sync with what the page actually fetches.
type FormData = Awaited<ReturnType<typeof getManualBookingFormData>>;

export function ManualBookingForm({
  properties,
  action,
}: {
  properties: FormData;
  action: (input: ManualBookingInput) => Promise<ActionResult>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ManualBookingInput>({
    resolver: zodResolver(manualBookingInput),
    defaultValues: {
      propertyId: "",
      roomTypeId: "",
      checkIn: "",
      checkOut: "",
      numGuests: 1,
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      status: "confirmed",
    },
  });
  const [range, setRange] = useState<DateRange | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const propertyId = watch("propertyId");
  const roomTypeId = watch("roomTypeId");
  const numGuests = watch("numGuests");
  const status = watch("status");

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );
  const room = useMemo(
    () => property?.rooms.find((r) => r.id === roomTypeId),
    [property, roomTypeId],
  );

  // react-day-picker speaks Date; availability + the action speak YYYY-MM-DD strings.
  // from = check-in, to = check-out, half-open [checkIn, checkOut).
  const checkIn = range?.from ? toDateStr(range.from) : "";
  const checkOut = range?.to ? toDateStr(range.to) : "";

  // Same per-day rule the public flow + RPC use, so sold-out days can't be selected.
  const disabledDays = useMemo(
    () => [
      { before: fromDateStr(todayStr()) },
      (day: Date) =>
        !!room && unitsAvailableOn(toDateStr(day), room.quantity, room.bookings, room.blocks) === 0,
    ],
    [room],
  );

  const datesValid = checkIn !== "" && checkOut !== "" && checkOut > checkIn;
  const available =
    !room || !datesValid
      ? true
      : isRangeBookable({ checkIn, checkOut }, room.quantity, room.bookings, room.blocks);

  const stayNights = datesValid ? nights(checkIn, checkOut) : 0;
  const total = room ? computeTotal(room.base_price, stayNights) : 0;
  const deposit = property ? computeDeposit(total, property.deposit_percent) : 0;

  const guestsValid = !!room && numGuests >= 1 && numGuests <= room.capacity;
  const canSubmit = !!room && datesValid && available && guestsValid;

  function onPropertyChange(value: string) {
    setValue("propertyId", value);
    setValue("roomTypeId", ""); // room + dates depend on the property — reset both
    setRange(undefined);
    setValue("checkIn", "");
    setValue("checkOut", "");
  }
  function onRoomChange(value: string) {
    setValue("roomTypeId", value);
    setRange(undefined); // availability differs per room — clear the picked range
    setValue("checkIn", "");
    setValue("checkOut", "");
  }
  function onSelectRange(next: DateRange | undefined) {
    setRange(next);
    setValue("checkIn", next?.from ? toDateStr(next.from) : "", { shouldValidate: true });
    setValue("checkOut", next?.to ? toDateStr(next.to) : "", { shouldValidate: true });
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        // createManualBooking redirects to /bookings on success (never resolves here); it
        // only returns when something failed or a confirmed row couldn't be flipped.
        const res = await action(values);
        if (!res.ok) setFormError(res.error);
      })}
      className="flex max-w-xl flex-col gap-5"
    >
      <Field label="Property" error={errors.propertyId?.message}>
        <Select value={propertyId} onChange={(e) => onPropertyChange(e.target.value)}>
          <option value="">Select a property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Room type" error={errors.roomTypeId?.message}>
        <Select
          value={roomTypeId}
          onChange={(e) => onRoomChange(e.target.value)}
          disabled={!property}
        >
          <option value="">{property ? "Select a room…" : "Pick a property first"}</option>
          {property?.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · ₱{r.base_price}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted">
          {checkIn && checkOut
            ? `${checkIn} → ${checkOut}`
            : checkIn
              ? "Pick a checkout date"
              : "Select dates"}
        </span>
        <div className="operator-calendar flex justify-center rounded-sm border border-hairline bg-surface-soft px-1 py-2">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={onSelectRange}
            disabled={disabledDays}
            excludeDisabled
            // Map RDP theme vars (default blue) to brand Rausch — matches RoomCalendar.
            style={
              {
                "--rdp-accent-color": "var(--color-primary)",
                "--rdp-accent-background-color": "var(--color-primary-disabled)",
                "--rdp-today-color": "var(--color-primary)",
              } as CSSProperties
            }
          />
        </div>
        {!room && <span className="text-body-sm text-muted">Pick a room to see availability.</span>}
        {datesValid && !available && (
          <span className="text-body-sm text-error">Those dates aren&apos;t available.</span>
        )}
        {(errors.checkIn?.message || errors.checkOut?.message) && (
          <span className="text-body-sm text-error">
            {errors.checkIn?.message ?? errors.checkOut?.message}
          </span>
        )}
      </div>

      <Field
        label={`Guests${room ? ` (up to ${room.capacity})` : ""}`}
        error={errors.numGuests?.message}
      >
        <Input
          type="number"
          min={1}
          max={room?.capacity}
          {...register("numGuests", { valueAsNumber: true })}
        />
      </Field>

      <Field label="Guest name" error={errors.guestName?.message}>
        <Input {...register("guestName")} placeholder="Juan dela Cruz" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Phone (optional)" error={errors.guestPhone?.message}>
          <Input {...register("guestPhone")} placeholder="0917 000 0000" />
        </Field>
        <Field label="Email (optional)" error={errors.guestEmail?.message}>
          <Input type="email" {...register("guestEmail")} placeholder="guest@email.com" />
        </Field>
      </div>

      <Field label="Status" error={errors.status?.message}>
        <Select {...register("status")}>
          <option value="confirmed">Confirmed (walk-in / already arranged)</option>
          <option value="held">Hold (awaiting payment)</option>
        </Select>
      </Field>

      {datesValid && room && (
        <div className="flex items-end justify-between gap-3 rounded-md border border-hairline bg-surface-soft p-4">
          <div className="min-w-0">
            <span className="text-caption tracking-wide text-muted uppercase">Total</span>
            <p className="text-display-sm leading-none text-ink">₱{total}</p>
            {status === "held" && (
              <p className="mt-1 text-body-sm text-muted">Deposit due: ₱{deposit}</p>
            )}
          </div>
          <p className="shrink-0 pb-0.5 text-right text-caption text-muted">
            ₱{room.base_price} / night
            <br />× {stayNights} {stayNights === 1 ? "night" : "nights"}
          </p>
        </div>
      )}

      {formError && <p className="text-body-sm text-error">{formError}</p>}

      <Button type="submit" disabled={isSubmitting || !canSubmit} className="self-start">
        {isSubmitting ? "Saving…" : "Create booking"}
      </Button>
    </form>
  );
}
