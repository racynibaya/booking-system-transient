"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { setGcashQr } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "property-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// GCash QR image manager. Mirrors cover-image-uploader: browser-side upload (storage RLS
// scopes the write to the operator's tenant folder), one QR per tenant (upsert overwrites).
export function GcashQrUploader({
  tenantId,
  currentPath,
}: {
  tenantId: string;
  currentPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(currentPath);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const supabase = createClient();
  const previewUrl = path
    ? `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${version}`
    : null;

  async function onPick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${tenantId}/gcash-qr.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const res = await setGcashQr(objectPath);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPath(objectPath);
    setVersion((v) => v + 1);
    toast.success("GCash QR updated.");
  }

  async function onRemove() {
    if (!path) return;
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([path]);
    const res = await setGcashQr("");
    setBusy(false);
    setConfirmOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPath(null);
    toast.success("GCash QR removed.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative size-40 overflow-hidden rounded-md border border-hairline bg-surface-soft">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="GCash QR" className="size-full object-contain p-1" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted">
            <ImageUp className="size-6" />
            <span className="text-body-sm">No QR yet</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="size-4" /> {path ? "Replace QR" : "Upload QR"}
        </Button>
        {path && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
        {busy && <span className="text-body-sm text-muted">Uploading…</span>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove GCash QR?"
        description="Guests won't be able to scan to pay until you upload a new one."
        confirmLabel="Remove"
        pending={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onRemove}
      />
    </div>
  );
}
