"use client";

import "react-day-picker/style.css";

import type { CSSProperties } from "react";
import { DayPicker, type DateRange, type Matcher } from "react-day-picker";

// The range date-picker, split into its own module so react-day-picker (+ its CSS) is loaded
// lazily — only when a guest opens the calendar — instead of shipping on every listing page's
// initial bundle. Availability logic stays in BookingCard; this is a pure render leaf.
export default function BookingCalendar({
  range,
  onSelect,
  disabledDays,
  bookedDays,
}: {
  range: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  disabledDays: Matcher[];
  bookedDays: Matcher;
}) {
  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={onSelect}
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
  );
}
