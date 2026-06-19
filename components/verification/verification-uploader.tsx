"use client";

import { Check, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { recordVerificationDoc, type VerificationDocKind } from "@/app/(app)/verification/actions";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "verification-docs";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// One upload slot, reused for each document kind. Uploads to the PRIVATE verification-docs bucket
// under the operator's own tenant folder (storage RLS), then records the row. We don't preview the
// image back (private bucket) — an "Uploaded" state is enough; the admin reviews the actual file.
export function VerificationUploader({
  tenantId,
  kind,
  label,
  hint,
  uploaded: initialUploaded,
}: {
  tenantId: string;
  kind: VerificationDocKind;
  label: string;
  hint: string;
  uploaded: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState(initialUploaded);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function onPick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image (a clear photo or scan).");
      return;
    }
    setBusy(true);
    const upload = await compressImage(file, { maxDim: 2000, quality: 0.82 });
    if (upload.size > MAX_BYTES) {
      setBusy(false);
      toast.error("File must be under 5MB.");
      return;
    }
    // First folder = tenant id (storage RLS). One file per kind; upsert overwrites a re-upload.
    const ext = upload.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${tenantId}/${kind}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, upload, {
      upsert: true,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const res = await recordVerificationDoc(kind, objectPath);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUploaded(true);
    toast.success(`${label} uploaded.`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-canvas p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-title-md text-ink">{label}</p>
          {uploaded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-disabled px-2 py-0.5 text-caption-sm text-primary-active">
              <Check className="size-3" /> Uploaded
            </span>
          )}
        </div>
        <p className="mt-0.5 text-body-sm text-muted">{hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
        {uploaded ? "Replace" : "Upload"}
      </Button>
    </div>
  );
}
