"use client";

import { BadgeCheck, Ban, Check, Eye, Home, Info, Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isOlderThanHours } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";

import {
  getOperatorDocs,
  getOperatorListing,
  requestChanges,
  setVerification,
  type OperatorDoc,
  type OperatorListing,
} from "../actions";

export type AdminOperator = {
  tenant_id: string;
  name: string | null;
  email: string;
  verification_status: "pending" | "approved" | "suspended" | "changes_requested";
  verification_note: string | null;
  gcash_changed_at: string | null;
  payment_methods: {
    type: "gcash" | "maya" | "bank" | "grabpay";
    account_name: string | null;
    account_number: string | null;
    bank_name: string | null;
  }[];
  xendit_kyc_status:
    | "INVITED"
    | "REGISTERED"
    | "AWAITING_DOCS"
    | "PENDING_VERIFICATION"
    | "LIVE"
    | "SUSPENDED"
    | null;
  created_at: string;
};

// Xendit onboarding state → a compact "Online pay" chip beside the verification badge. Only LIVE
// operators can take online payments; the mid-states collapse to one neutral "onboarding" label.
const KYC_CHIP: Record<
  NonNullable<AdminOperator["xendit_kyc_status"]>,
  { label: string; tone: "success" | "danger" | "neutral" }
> = {
  INVITED: { label: "Online pay: onboarding", tone: "neutral" },
  REGISTERED: { label: "Online pay: onboarding", tone: "neutral" },
  AWAITING_DOCS: { label: "Online pay: onboarding", tone: "neutral" },
  PENDING_VERIFICATION: { label: "Online pay: onboarding", tone: "neutral" },
  LIVE: { label: "Online pay: live", tone: "success" },
  SUSPENDED: { label: "Online pay: suspended", tone: "danger" },
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
  const [listing, setListing] = useState<OperatorListing | null>(null);
  const [listingLoaded, setListingLoaded] = useState(false);
  const [loadingListing, setLoadingListing] = useState(false);
  const [showListing, setShowListing] = useState(false);
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

  async function toggleListing() {
    if (showListing) {
      setShowListing(false);
      return;
    }
    setShowListing(true);
    if (!listingLoaded) {
      setLoadingListing(true);
      const res = await getOperatorListing(op.tenant_id);
      setLoadingListing(false);
      if (res.ok) {
        setListing(res.listing);
        setListingLoaded(true);
      } else {
        toast.error(res.error);
        setShowListing(false);
      }
    }
  }

  const s = STATUS[op.verification_status];

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-title-md text-ink">{op.name ?? "(unnamed)"}</p>
            <Badge tone={s.tone}>{s.label}</Badge>
            {op.xendit_kyc_status && (
              <Badge tone={KYC_CHIP[op.xendit_kyc_status].tone}>
                {KYC_CHIP[op.xendit_kyc_status].label}
              </Badge>
            )}
          </div>
          <p className="text-body-sm text-muted">{op.email}</p>
          {op.payment_methods.length === 0 ? (
            <p className="mt-1 text-caption text-muted">No payout method</p>
          ) : (
            <div className="mt-1 flex flex-col gap-0.5">
              {op.payment_methods.map((m, i) => (
                <p key={i} className="text-caption text-muted">
                  {PAYMENT_METHOD_LABELS[m.type]}: {m.account_name ?? "—"}
                  {m.account_number ? ` · ${m.account_number}` : ""}
                  {m.bank_name ? ` (${m.bank_name})` : ""}
                </p>
              ))}
            </div>
          )}
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
        <div className="grid grid-cols-2 gap-2 *:w-full lg:flex lg:shrink-0 lg:flex-wrap lg:*:w-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleDocs}
            aria-label={`${showDocs ? "Hide" : "View"} documents`}
          >
            <Eye className="size-4" />
            <span>{showDocs ? "Hide" : "View"} documents</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleListing}
            aria-label={`${showListing ? "Hide" : "View"} listing`}
          >
            <Home className="size-4" />
            <span>{showListing ? "Hide" : "View"} listing</span>
          </Button>
          {gcashFlagged && (
            <Button size="sm" disabled={pending} onClick={confirmGcash} aria-label="Confirm GCash">
              <BadgeCheck className="size-4" />
              <span>Confirm GCash</span>
            </Button>
          )}
          {op.verification_status !== "suspended" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              aria-label="Request changes"
              onClick={() => {
                const existing = op.verification_note ?? "";
                setNote(existing);
                setCustom(existing !== "" && !REASONS.includes(existing));
                setNoteOpen((v) => !v);
              }}
            >
              <Undo2 className="size-4" />
              <span>Request changes</span>
            </Button>
          )}
          {op.verification_status !== "approved" && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => act("approved")}
              aria-label="Approve"
            >
              <Check className="size-4" />
              <span>Approve</span>
            </Button>
          )}
          {op.verification_status !== "suspended" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => act("suspended")}
              aria-label={op.verification_status === "approved" ? "Suspend" : "Reject"}
            >
              <Ban className="size-4" />
              <span>{op.verification_status === "approved" ? "Suspend" : "Reject"}</span>
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

      {showListing && (
        <div className="border-t border-hairline pt-3">
          {loadingListing ? (
            <p className="flex items-center gap-2 text-body-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading listing…
            </p>
          ) : !listing ? (
            <p className="text-body-sm text-muted">No property created yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-1.5 text-caption text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                What guests would see — check the text and photos for anything fake, abusive, or
                off-platform before approving.
              </p>

              <div className="flex flex-col gap-4 rounded-md border border-hairline bg-surface-soft p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-display-sm text-ink">{listing.name}</p>
                    <p className="text-caption text-muted">
                      /{listing.slug}
                      {listing.area ? ` · ${listing.area}` : ""}
                      {listing.address ? ` · ${listing.address}` : ""}
                    </p>
                  </div>
                  <a
                    href={`/preview/${listing.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-caption text-primary underline"
                  >
                    Open customer view ↗
                  </a>
                </div>

                {(listing.facebook_url || listing.instagram_url || listing.tiktok_url) && (
                  <div className="flex flex-wrap gap-3">
                    {listing.facebook_url && (
                      <a
                        href={listing.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption text-primary underline"
                      >
                        Facebook
                      </a>
                    )}
                    {listing.instagram_url && (
                      <a
                        href={listing.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption text-primary underline"
                      >
                        Instagram
                      </a>
                    )}
                    {listing.tiktok_url && (
                      <a
                        href={listing.tiktok_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption text-primary underline"
                      >
                        TikTok
                      </a>
                    )}
                  </div>
                )}

                {listing.description && (
                  <p className="text-body-sm whitespace-pre-wrap text-body">
                    {listing.description}
                  </p>
                )}
                {listing.about && (
                  <p className="text-body-sm whitespace-pre-wrap text-body">{listing.about}</p>
                )}

                {listing.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {listing.amenities.map((a, i) => (
                      <Badge key={i} tone="neutral">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}

                {(listing.cover_url || listing.photo_urls.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[...(listing.cover_url ? [listing.cover_url] : []), ...listing.photo_urls].map(
                      (url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <div className="aspect-[4/3] overflow-hidden rounded-md border border-hairline bg-surface-soft">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${listing.name} photo ${i + 1}`}
                              className="size-full object-cover transition-transform hover:scale-105"
                            />
                          </div>
                        </a>
                      ),
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {listing.rooms.length === 0 ? (
                    <p className="text-caption text-muted">No rooms added yet.</p>
                  ) : (
                    listing.rooms.map((r) => (
                      <div key={r.id} className="rounded-md border border-hairline bg-canvas p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-body-sm font-medium text-ink">{r.name}</p>
                          <p className="text-caption text-muted">
                            ₱{r.base_price} · {r.capacity} pax · {r.quantity} room
                            {r.quantity === 1 ? "" : "s"}
                          </p>
                        </div>
                        {r.description && (
                          <p className="mt-1 text-caption whitespace-pre-wrap text-muted">
                            {r.description}
                          </p>
                        )}
                        {r.photo_urls.length > 0 && (
                          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {r.photo_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <div className="aspect-[4/3] overflow-hidden rounded-md border border-hairline bg-surface-soft">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`${r.name} photo ${i + 1}`}
                                    className="size-full object-cover transition-transform hover:scale-105"
                                  />
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
