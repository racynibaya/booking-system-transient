"use client";

import "react-day-picker/style.css";

import { useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { toast } from "sonner";

import { createBlock, deleteBlock } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unitsAvailableOn, type BlockRange, type StayRange } from "@/lib/availability";
import { addDays, toDateStr } from "@/lib/dates";

type CalBlock = { id: string; start: string; end: string; reason: string | null };

export function RoomCalendar({
  propertyId,
  roomType,
  bookings,
  blocks,
}: {
  propertyId: string;
  roomType: { id: string; name: string; quantity: number };
  bookings: StayRange[];
  blocks: CalBlock[];
}) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const blockRanges: BlockRange[] = blocks.map((b) => ({ start: b.start, end: b.end }));

  // Per-day classification for coloring (lib/availability — same rule as the RPC).
  const dayState = (day: Date): "blocked" | "full" | "partial" | "free" => {
    const ds = toDateStr(day);
    if (blockRanges.some((b) => b.start <= ds && ds < b.end)) return "blocked";
    const units = unitsAvailableOn(ds, roomType.quantity, bookings, blockRanges);
    if (units === 0) return "full";
    if (units < roomType.quantity) return "partial";
    return "free";
  };

  async function addBlock() {
    if (!range?.from || !range?.to) return;
    setPending(true);
    // react-day-picker gives inclusive from/to; our blocks are half-open, so the
    // exclusive end is the day after the last selected day.
    const res = await createBlock(propertyId, roomType.id, {
      start_date: toDateStr(range.from),
      end_date: addDays(toDateStr(range.to), 1),
      reason,
    });
    setPending(false);
    if (res.ok) {
      setRange(undefined);
      setReason("");
      toast.success("Dates blocked");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-hairline p-4 sm:p-6">
      <div>
        <h2 className="text-display-sm text-ink">{roomType.name}</h2>
        <p className="text-body-sm text-muted">{roomType.quantity} units</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="operator-calendar">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            disabled={{ before: new Date() }}
            // Map RDP theme vars (default blue, set on .rdp-root) to brand tokens.
            // Inline style outranks the stylesheet — drives selected days, the today
            // marker, and the nav chevrons.
            style={
              {
                "--rdp-accent-color": "var(--color-primary)",
                "--rdp-accent-background-color": "var(--color-primary-disabled)",
                "--rdp-today-color": "var(--color-primary)",
              } as CSSProperties
            }
            modifiers={{
              blocked: (day) => dayState(day) === "blocked",
              full: (day) => dayState(day) === "full",
              partial: (day) => dayState(day) === "partial",
            }}
            modifiersClassNames={{
              blocked: "rounded-sm bg-surface-strong text-muted-soft line-through",
              full: "text-muted-soft",
              partial: "text-ink",
            }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-caption text-muted">Block dates (maintenance, personal use)</p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
            />
            <Button
              type="button"
              size="sm"
              disabled={!range?.from || !range?.to || pending}
              onClick={addBlock}
              className="self-start"
            >
              {pending ? "Blocking…" : "Block selected dates"}
            </Button>
            <p className="text-caption-sm text-muted">
              <span className="text-ink">Dark</span> = available ·{" "}
              <span className="text-muted-soft">faded</span> = full ·{" "}
              <span className="rounded-sm bg-surface-strong px-1 text-muted-soft line-through">
                struck
              </span>{" "}
              = blocked. The checkout day stays bookable.
            </p>
          </div>

          {blocks.length > 0 && (
            <ul className="flex flex-col gap-2">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-sm border border-hairline px-3 py-2"
                >
                  <span className="min-w-0 truncate text-body-sm text-ink">
                    {b.start} → {b.end}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={async () => {
                      const res = await deleteBlock(b.id, propertyId);
                      if (res.ok) toast.success("Block removed");
                      else toast.error(res.error);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
