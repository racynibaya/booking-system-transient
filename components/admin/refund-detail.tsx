"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminLookupBookingForRefund,
  refundBooking,
  type RefundPreview,
} from "@/app/(admin)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { REFUND_REASONS, type RefundReason } from "@/lib/paymongo/refund-reasons";

const REASON_LABEL: Record<RefundReason, string> = {
  duplicate: "Duplicate",
  fraudulent: "Fraudulent",
  requested_by_customer: "Requested by customer",
  others: "Other",
};

const peso = (n: number | null) => (n == null ? "—" : `₱${n.toLocaleString("en-PH")}`);

function stayRange(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return "—";
  const f = (s: string) =>
    new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return `${f(checkIn)} – ${f(checkOut)}`;
}

// Refund a single booking. Driven by `bookingId` (from a list row or the manual lookup) — fetches the
// preview on mount/change, then lets the admin pick a reason + amount and confirm.
export function RefundDetail({
  bookingId,
  onRefunded,
  onClose,
}: {
  bookingId: string;
  onRefunded?: () => void;
  onClose?: () => void;
}) {
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [amount, setAmount] = useState(""); // blank = full refund
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [refunding, startRefund] = useTransition();

  // Fetch the preview on mount. The panel keys this component by bookingId, so a different selection
  // remounts it fresh — no need to reset state synchronously here (which the hooks lint forbids).
  useEffect(() => {
    startLoad(async () => {
      const res = await adminLookupBookingForRefund(bookingId);
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      setPreview(res.preview);
    });
  }, [bookingId]);

  const partial = amount.trim() === "" ? undefined : Number(amount);
  const amountInvalid =
    partial !== undefined &&
    (Number.isNaN(partial) ||
      partial <= 0 ||
      (preview?.capturedAmount != null && partial > preview.capturedAmount));
  const refundPesos = partial ?? preview?.capturedAmount ?? null;

  function doRefund() {
    if (!preview) return;
    startRefund(async () => {
      const res = await refundBooking({
        bookingId: preview.bookingId,
        reason,
        amountPesos: partial,
      });
      setConfirmOpen(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Refund submitted.");
      onRefunded?.();
      const fresh = await adminLookupBookingForRefund(preview.bookingId);
      if (fresh.ok) setPreview(fresh.preview);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-muted">
          Booking <span className="font-mono">{bookingId}</span>
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">Loading booking…</p>
      ) : loadError ? (
        <p className="rounded-sm border border-hairline bg-surface-soft p-3 text-body-sm text-error">
          {loadError}
        </p>
      ) : preview ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-title-sm text-ink">{preview.guestName ?? "Guest"}</p>
              <p className="text-caption-sm text-muted">
                {preview.propertyName ? `${preview.propertyName} · ` : ""}
                {stayRange(preview.checkIn, preview.checkOut)}
              </p>
            </div>
            {preview.ledgerStatus && (
              <Badge tone={preview.refundable ? "accent" : "muted"}>
                {preview.ledgerStatus.replace("_", " ")}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-hairline pt-3">
            <span className="text-caption text-muted">Captured online</span>
            <span className="text-body-sm font-semibold text-ink tabular-nums">
              {peso(preview.capturedAmount)}
            </span>
          </div>

          {!preview.refundable ? (
            <p className="rounded-sm border border-hairline bg-surface-soft p-3 text-body-sm text-muted">
              {preview.note}
            </p>
          ) : (
            <>
              <label>
                <span className="mb-1.5 block text-caption text-muted">Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as RefundReason)}
                  className="h-14 w-full rounded-sm border border-hairline bg-canvas px-3.5 text-body-md text-ink transition-colors focus:border-2 focus:border-ink focus:outline-none"
                >
                  {REFUND_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-caption text-muted">
                  Amount (blank = full refund of {peso(preview.capturedAmount)})
                </span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={preview.capturedAmount?.toString() ?? "0"}
                  inputMode="decimal"
                />
                {amountInvalid && (
                  <span className="mt-1 block text-caption-sm text-error" role="alert">
                    Enter an amount between ₱1 and {peso(preview.capturedAmount)}.
                  </span>
                )}
              </label>

              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={amountInvalid}
                className="self-start"
              >
                Refund {peso(refundPesos)}
              </Button>
            </>
          )}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Refund ${peso(refundPesos)}?`}
        description={`This sends the guest a refund from the Tuloy wallet for booking ${preview?.bookingId}. If the operator was already paid out, their share is recorded as a clawback. This can't be undone.`}
        confirmLabel="Refund"
        pending={refunding}
        onConfirm={doRefund}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
