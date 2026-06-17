"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { setRoomPhotos } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "property-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 8;

// Multi-image manager for a room type. Mirrors cover-image-uploader's browser-side upload
// (storage RLS scopes writes to the operator's tenant folder), but keeps an array of paths
// and persists the whole list to room_types.photos after each add/remove.
export function RoomPhotosUploader({
  roomTypeId,
  propertyId,
  tenantId,
  currentPhotos,
}: {
  roomTypeId: string;
  propertyId: string;
  tenantId: string;
  currentPhotos: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>(currentPhotos);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();
  const urlFor = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  async function persist(next: string[]) {
    const res = await setRoomPhotos(roomTypeId, propertyId, next);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setPaths(next);
    return true;
  }

  async function onPick(files: FileList) {
    const room = MAX_PHOTOS - paths.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_PHOTOS} photos per room.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    setBusy(true);
    const uploaded: string[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} isn't an image — skipped.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5MB — skipped.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const rand = crypto.randomUUID().slice(0, 8);
      const objectPath = `${tenantId}/${propertyId}/rooms/${roomTypeId}/${rand}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, file, { cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        continue;
      }
      uploaded.push(objectPath);
    }
    if (uploaded.length > 0) {
      const ok = await persist([...paths, ...uploaded]);
      if (ok) toast.success(`Added ${uploaded.length} photo${uploaded.length > 1 ? "s" : ""}.`);
    }
    setBusy(false);
  }

  async function onRemove(path: string) {
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([path]);
    const ok = await persist(paths.filter((p) => p !== path));
    setBusy(false);
    if (ok) toast.success("Photo removed.");
  }

  return (
    <div className="flex flex-col gap-3">
      {paths.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {paths.map((path) => (
            <div
              key={path}
              className="group relative aspect-square overflow-hidden rounded-md border border-hairline bg-surface-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlFor(path)} alt="Room photo" className="size-full object-cover" />
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(path)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-canvas opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
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
          disabled={busy || paths.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="size-4" /> Add photos
        </Button>
        <span className="text-caption text-muted">
          {paths.length}/{MAX_PHOTOS}
        </span>
        {busy && <span className="text-body-sm text-muted">Uploading…</span>}
      </div>
    </div>
  );
}
