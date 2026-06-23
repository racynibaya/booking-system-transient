"use client";

import { BedDouble, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createRoomType, deleteRoomType, updateRoomType } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

import { RoomPhotosUploader } from "./room-photos-uploader";
import { RoomTypeForm } from "./room-type-form";

const BUCKET = "property-images";

type Room = {
  id: string;
  name: string;
  capacity: number;
  quantity: number;
  base_price: number;
  description: string | null;
  photos: string[];
};

export function RoomTypesSection({
  propertyId,
  tenantId,
  roomTypes,
}: {
  propertyId: string;
  tenantId: string;
  roomTypes: Room[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Over-cap block (upgrade:true from createRoomType) → upgrade modal; holds the plan/cap/count body.
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const supabase = createClient();
  const urlFor = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-display-sm text-ink">Room types</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add room type
          </Button>
        )}
      </div>

      {roomTypes.length === 0 && !adding && (
        <p className="text-body-sm text-muted">No room types yet — add one so guests can book.</p>
      )}

      <div className="flex flex-col gap-3">
        {roomTypes.map((rt) => {
          if (editingId === rt.id) {
            return (
              <RoomTypeForm
                key={rt.id}
                defaultValues={{
                  name: rt.name,
                  capacity: rt.capacity,
                  quantity: rt.quantity,
                  base_price: rt.base_price,
                  description: rt.description ?? "",
                }}
                submitLabel="Save"
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  const res = await updateRoomType(rt.id, propertyId, values);
                  if (res.ok) {
                    setEditingId(null);
                    setExpandedId(null);
                    toast.success("Room type updated");
                    if (res.notice) toast.warning(res.notice, { duration: 8000 });
                  }
                  return res;
                }}
              />
            );
          }

          const open = expandedId === rt.id;
          const photos = rt.photos ?? [];
          const cover = photos[0];

          return (
            <div key={rt.id} className="rounded-md border border-hairline">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpandedId(open ? null : rt.id)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-soft"
              >
                {cover ? (
                  <span className="size-10 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlFor(cover)} alt="" className="size-full object-cover" />
                  </span>
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-strong text-muted">
                    <BedDouble className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-md text-ink">{rt.name}</p>
                  <p className="mt-0.5 truncate text-body-sm text-muted">
                    {rt.capacity} guests · {rt.quantity} unit{rt.quantity > 1 ? "s" : ""} · ₱
                    {rt.base_price}
                  </p>
                  <p className="mt-1 truncate text-caption-sm text-muted-soft">
                    {photos.length === 0
                      ? "No photos yet"
                      : `${photos.length} photo${photos.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <ChevronDown
                  className={`size-5 shrink-0 text-muted-soft transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="flex flex-col gap-4 border-t border-hairline p-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(rt.id)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDeletingId(rt.id)}>
                      Delete
                    </Button>
                  </div>
                  <div className="border-t border-hairline pt-3">
                    <p className="mb-2 text-caption text-muted">Photos</p>
                    <RoomPhotosUploader
                      roomTypeId={rt.id}
                      propertyId={propertyId}
                      tenantId={tenantId}
                      currentPhotos={photos}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <RoomTypeForm
          submitLabel="Add room type"
          onCancel={() => setAdding(false)}
          onSubmit={async (values) => {
            const res = await createRoomType(propertyId, values);
            if (res.ok) {
              setAdding(false);
              toast.success("Room type added");
              if (res.notice) toast.warning(res.notice, { duration: 8000 });
            } else if (res.upgrade) {
              setUpgradeMsg(res.error);
            }
            return res;
          }}
        />
      )}

      <ConfirmDialog
        open={upgradeMsg !== null}
        title="Upgrade to add more rooms"
        description={upgradeMsg ?? undefined}
        confirmLabel="Upgrade your plan"
        cancelLabel="Cancel"
        onCancel={() => setUpgradeMsg(null)}
        onConfirm={() => {
          setUpgradeMsg(null);
          router.push("/settings");
        }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this room type?"
        description={`This removes "${
          roomTypes.find((rt) => rt.id === deletingId)?.name ?? "this room type"
        }" and its photos. You can't undo it.`}
        confirmLabel="Yes, delete"
        pending={pending}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => {
          startTransition(async () => {
            if (!deletingId) return;
            const res = await deleteRoomType(deletingId, propertyId);
            if (res.ok) toast.success("Room type removed");
            else toast.error(res.error);
            setDeletingId(null);
          });
        }}
      />
    </section>
  );
}
