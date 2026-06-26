"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { setPropertyPhotos } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "property-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 12;
const MAX_CAPTION = 80;

type SpacePhoto = { path: string; caption: string };

// Captioned gallery of the property's shared spaces (kitchen, common areas, view) — distinct from
// the per-room photos. Mirrors room-photos-uploader's browser-side upload (storage RLS scopes
// writes to the operator's tenant folder), but each photo carries an optional caption and the
// whole list is persisted to properties.photos after each add/remove/caption edit.
export function SpacePhotosUploader({
  propertyId,
  tenantId,
  currentPhotos,
}: {
  propertyId: string;
  tenantId: string;
  currentPhotos: SpacePhoto[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SpacePhoto[]>(currentPhotos);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();
  const urlFor = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  async function persist(next: SpacePhoto[]) {
    const res = await setPropertyPhotos(propertyId, next);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setPhotos(next);
    return true;
  }

  async function onPick(files: FileList) {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    setBusy(true);
    const uploaded: SpacePhoto[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} isn't an image — skipped.`);
        continue;
      }
      // Downscale/re-encode before upload to cut storage + public-page egress.
      const img = await compressImage(file, { maxDim: 1600, quality: 0.8 });
      if (img.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5MB — skipped.`);
        continue;
      }
      const ext = img.name.split(".").pop()?.toLowerCase() || "jpg";
      const rand = crypto.randomUUID().slice(0, 8);
      const objectPath = `${tenantId}/${propertyId}/space/${rand}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, img, { cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        continue;
      }
      uploaded.push({ path: objectPath, caption: "" });
    }
    if (uploaded.length > 0) {
      const ok = await persist([...photos, ...uploaded]);
      if (ok) toast.success(`Added ${uploaded.length} photo${uploaded.length > 1 ? "s" : ""}.`);
    }
    setBusy(false);
  }

  async function onRemove(path: string) {
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([path]);
    const ok = await persist(photos.filter((p) => p.path !== path));
    setBusy(false);
    if (ok) toast.success("Photo removed.");
  }

  // Save a caption on blur only when it actually changed, re-persisting the whole list.
  async function onCaptionBlur(path: string, caption: string) {
    const current = photos.find((p) => p.path === path)?.caption ?? "";
    const trimmed = caption.trim();
    if (trimmed === current) return;
    await persist(photos.map((p) => (p.path === path ? { ...p, caption: trimmed } : p)));
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.path} className="flex flex-col gap-1.5">
              <div className="group relative aspect-square overflow-hidden rounded-md border border-hairline bg-surface-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFor(photo.path)}
                  alt={photo.caption || "Space photo"}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(photo.path)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-canvas transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <input
                type="text"
                defaultValue={photo.caption}
                maxLength={MAX_CAPTION}
                placeholder="e.g. Kitchen"
                disabled={busy}
                aria-label="Photo caption"
                onBlur={(e) => onCaptionBlur(photo.path, e.target.value)}
                className="w-full rounded-md border border-hairline bg-canvas px-2 py-1.5 text-caption text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              />
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || photos.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="size-4" /> Add photos
        </Button>
        <span className="text-caption text-muted">
          {photos.length}/{MAX_PHOTOS}
        </span>
        {busy && <span className="text-body-sm text-muted">Uploading…</span>}
      </div>
    </div>
  );
}
