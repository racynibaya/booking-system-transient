"use client";

import { Eye, Info, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isOlderThanHours } from "@/lib/dates";

import { getOperatorDocs, requestChanges, setVerification, type OperatorDoc } from "../actions";

export type AdminOperator = {
  tenant_id: string;
  name: string | null;
  email: string;
  verification_status: "pending" | "approved" | "suspended" | "changes_requested";
  verification_note: string | null;
  gcash_changed_at: string | null;
  gcash_name: string | null;
  gcash_number: string | null;
  created_at: string;
};

// Verification status → label + semantic tone, on the same scale as booking badges.
// Amber = in the admin's queue, green = approved, red = suspended, neutral = ball's in
// the operator's court.
const STATUS = {
  pending: { label: "Pending review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  changes_requested: { label: "Changes requested", tone: "neutral" },
} as const;

const DOC_LABEL: Record<string, string> = {
  gov_id: "Government ID",
  gcash_qr: "GCash QR — name must match ID",
  business_permit: "Business permit / DOT",
  property_proof: "Property proof",
};

// Preset reasons the admin picks from (Option A). "Other" reveals a free-text box as a fallback.
const REASONS = [
  "Your government ID photo is blurry — please re-upload a clearer one.",
  "Your business permit / DOT certificate is unclear — please re-upload.",
  "The property photo doesn't clearly show your name and today's date — please retake it.",
  "One or more documents are missing — please upload all three.",
  "The GCash name doesn't match your ID — please correct it before we approve.",
  "A document is cut off or unreadable — please re-upload the full page.",
];

export function OperatorRow({ op }: { op: AdminOperator }) {
  const [pending, start] = useTransition();
  const [docs, setDocs] = useState<OperatorDoc[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(op.verification_note ?? "");
  const [custom, setCustom] = useState(false);

  const act = (status: "approved" | "suspended") =>
    start(async () => {
      const res = await setVerification(op.tenant_id, status);
      if (res.ok) toast.success(status === "approved" ? "Operator approved" : "Operator suspended");
      else toast.error(res.error);
    });

  const sendChanges = () =>
    start(async () => {
      const res = await requestChanges(op.tenant_id, note);
      if (res.ok) {
        toast.success("Sent back to operator");
        setNoteOpen(false);
      } else toast.error(res.error);
    });

  const confirmGcash = () =>
    start(async () => {
      const res = await setVerification(op.tenant_id, "approved");
      if (res.ok) toast.success("GCash change confirmed");
      else toast.error(res.error);
    });

  const gcashFlagged = op.verification_status === "approved" && !!op.gcash_changed_at;
  const gcashOverdue = gcashFlagged && isOlderThanHours(op.gcash_changed_at!, 72);

  async function toggleDocs() {
    if (showDocs) {
      setShowDocs(false);
      return;
    }
    setShowDocs(true);
    if (docs === null) {
      setLoadingDocs(true);
      const res = await getOperatorDocs(op.tenant_id);
      setLoadingDocs(false);
      if (res.ok) setDocs(res.docs);
      else {
        toast.error(res.error);
        setShowDocs(false);
      }
    }
  }

  const s = STATUS[op.verification_status];

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-title-md text-ink">{op.name ?? "(unnamed)"}</p>
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <p className="text-body-sm text-muted">{op.email}</p>
          <p className="mt-1 text-caption text-muted">
            GCash: {op.gcash_name ?? "—"}
            {op.gcash_number ? ` · ${op.gcash_number}` : ""}
          </p>
          {gcashFlagged && (
            <p className="mt-1 flex items-start gap-1.5 text-caption text-error">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              GCash changed — re-verify the QR vs the ID
              {gcashOverdue ? " · page paused (overdue)" : " · live for 3 days"}
            </p>
          )}
          {op.verification_status === "changes_requested" && op.verification_note && (
            <p className="mt-1 flex items-start gap-1.5 text-caption text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              You asked for: {op.verification_note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={toggleDocs}>
            <Eye className="size-4" /> {showDocs ? "Hide" : "View"} documents
          </Button>
          {gcashFlagged && (
            <Button size="sm" disabled={pending} onClick={confirmGcash}>
              Confirm GCash
            </Button>
          )}
          {op.verification_status !== "suspended" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const existing = op.verification_note ?? "";
                setNote(existing);
                setCustom(existing !== "" && !REASONS.includes(existing));
                setNoteOpen((v) => !v);
              }}
            >
              Request changes
            </Button>
          )}
          {op.verification_status !== "approved" && (
            <Button size="sm" disabled={pending} onClick={() => act("approved")}>
              Approve
            </Button>
          )}
          {op.verification_status !== "suspended" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => act("suspended")}
            >
              {op.verification_status === "approved" ? "Suspend" : "Reject"}
            </Button>
          )}
        </div>
      </div>

      {noteOpen && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-3">
          <label className="text-body-sm text-ink">What should they fix?</label>
          <select
            value={custom ? "__other__" : note}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__other__") {
                setCustom(true);
                setNote("");
              } else {
                setCustom(false);
                setNote(v);
              }
            }}
            className="w-full rounded-md border border-hairline bg-canvas p-2 text-body-sm text-ink outline-none focus-visible:border-primary"
          >
            <option value="">Choose a reason…</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__other__">Other (type your own)…</option>
          </select>
          {custom && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Tell them exactly what to fix."
              className="w-full rounded-md border border-hairline bg-canvas p-2 text-body-sm text-ink outline-none focus-visible:border-primary"
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={pending || !note.trim()} onClick={sendChanges}>
              Send to operator
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showDocs && (
        <div className="border-t border-hairline pt-3">
          {loadingDocs ? (
            <p className="flex items-center gap-2 text-body-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading documents…
            </p>
          ) : docs && docs.length > 0 ? (
            <>
              <p className="mb-3 flex items-start gap-1.5 text-caption text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Check the name on the ID matches the GCash QR — and the GCash name above.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {docs.map((d) => (
                  <a
                    key={d.kind}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-md border border-hairline bg-surface-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.url}
                        alt={DOC_LABEL[d.kind] ?? d.kind}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <span className="text-caption text-muted">{DOC_LABEL[d.kind] ?? d.kind}</span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="text-body-sm text-muted">No documents uploaded yet.</p>
          )}
        </div>
      )}
    </Card>
  );
}
