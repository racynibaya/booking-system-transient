"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { setCoverImage } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "property-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function CoverImageUploader({
  propertyId,
  tenantId,
  currentPath,
}: {
  propertyId: string;
  tenantId: string;
  currentPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(currentPath);
  const [busy, setBusy] = useState(false);
  // Cache-buster so a replaced image (same storage path) actually re-renders.
  const [version, setVersion] = useState(0);

  const supabase = createClient();
  const previewUrl = path
    ? `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${version}`
    : null;

  async function onPick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    // Downscale/re-encode before upload (hero image) to cut storage + public-page egress.
    const upload = await compressImage(file, { maxDim: 2000, quality: 0.82 });
    if (upload.size > MAX_BYTES) {
      setBusy(false);
      toast.error("Image must be under 5MB.");
      return;
    }
    // Path's first folder is the tenant id — storage RLS only allows the operator
    // to write under their own tenant. One cover per property (upsert overwrites).
    const ext = upload.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${tenantId}/${propertyId}-cover.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, upload, { upsert: true, cacheControl: "3600" });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const res = await setCoverImage(propertyId, objectPath);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPath(objectPath);
    setVersion((v) => v + 1);
    toast.success("Cover photo updated.");
  }

  async function onRemove() {
    if (!path) return;
    if (!confirm("Remove the cover photo?")) return;
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([path]);
    const res = await setCoverImage(propertyId, "");
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPath(null);
    toast.success("Cover photo removed.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-hairline bg-surface-soft">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Booking page cover" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted">
            <ImageUp className="size-6" />
            <span className="text-body-sm">No cover photo yet</span>
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
          <ImageUp className="size-4" /> {path ? "Replace photo" : "Upload photo"}
        </Button>
        {path && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
        {busy && <span className="text-body-sm text-muted">Uploading…</span>}
      </div>
    </div>
  );
}
