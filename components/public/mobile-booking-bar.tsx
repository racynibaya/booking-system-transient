"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { BookingCard, type PublicRoom } from "@/components/public/booking-card";
import { useSelectedRoom } from "@/components/public/selected-room-context";

// Compact brand CTA for the sticky bar (the booking card's full-width gradient CTA, sized down).
const reserveBtn =
  "shrink-0 rounded-full bg-linear-to-r from-sunset-1 via-sunset-2 to-sunset-3 px-6 py-3 text-button-md text-on-primary shadow-[0_12px_30px_-12px_rgba(31,111,120,0.5)] transition-[transform,opacity] hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]";

// Slide-up bottom sheet. Mirrors the portaled overlay in amenities-section.tsx / confirm-dialog.tsx
// (scrim, Escape / backdrop close, body-scroll lock, rAF-driven entrance) but animates on the
// vertical transform so the panel rises from the bottom edge.
function Drawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-scrim/50 backdrop-blur-sm transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reserve"
        className={`relative flex max-h-[90vh] flex-col rounded-t-2xl border-t border-hairline bg-surface-soft shadow-card transition-transform duration-300 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
          <span className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong" />
          <span className="text-title-md font-semibold text-ink">Reserve</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-1 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// Mobile-only booking entry point: a sticky bottom bar (price + Reserve) that opens the full
// booking card in a bottom sheet. Hidden on desktop (lg+), where the card lives in the aside.
export function MobileBookingBar({
  rooms,
  propertyName,
  area,
  acceptsOnlinePayment,
}: {
  rooms: PublicRoom[];
  propertyName: string;
  area: string | null;
  acceptsOnlinePayment: boolean;
}) {
  const { selectedRoomId } = useSelectedRoom();
  const [open, setOpen] = useState(false);

  if (rooms.length === 0) return null;
  const room = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-hairline bg-canvas/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="min-w-0">
          <p className="text-title-md font-semibold text-ink">
            ₱{room.base_price}
            <span className="text-body-sm font-normal text-muted"> / night</span>
          </p>
          {area && <p className="truncate text-caption text-muted">{area}</p>}
        </div>
        <button type="button" onClick={() => setOpen(true)} className={reserveBtn}>
          Reserve
        </button>
      </div>

      {open && (
        <Drawer onClose={() => setOpen(false)}>
          <BookingCard
            rooms={rooms}
            propertyName={propertyName}
            area={area}
            acceptsOnlinePayment={acceptsOnlinePayment}
          />
        </Drawer>
      )}
    </div>
  );
}
