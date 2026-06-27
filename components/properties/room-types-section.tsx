"use client";

import { BedDouble, ChevronDown, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createRoomType, deleteRoomType, updateRoomType } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { RoomPhotosUploader } from "./room-photos-uploader";
import { RoomTypeForm } from "./room-type-form";

const BUCKET = "property-images";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

// "12" or "8–24" — a min–max range that collapses when both ends are equal.
function range(values: number[], fmt: (n: number) => string): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
}

// Search appears once a property has enough room types that scanning gets slow.
const SEARCH_THRESHOLD = 6;

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
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const supabase = createClient();
  const urlFor = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // Summary reassures a hotel that "320 rooms across 8 types" is normal — rooms are tracked as
  // types × quantity, never one row per room.
  const totalRooms = roomTypes.reduce((n, r) => n + r.quantity, 0);
  const summary =
    roomTypes.length > 0
      ? [
          { label: "Rooms", value: String(totalRooms) },
          {
            label: roomTypes.length === 1 ? "Room type" : "Room types",
            value: String(roomTypes.length),
          },
          {
            label: "Sleeps",
            value: `${range(
              roomTypes.map((r) => r.capacity),
              String,
            )} guests`,
          },
          {
            label: "Price / night",
            value: range(
              roomTypes.map((r) => r.base_price),
              peso,
            ),
          },
        ]
      : [];

  const showSearch = roomTypes.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const filtered = q ? roomTypes.filter((rt) => rt.name.toLowerCase().includes(q)) : roomTypes;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconChip icon={BedDouble} tone="primary" />
          <h2 className="text-display-sm text-ink">Room types</h2>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add room type
          </Button>
        )}
      </div>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-md border border-hairline bg-linear-to-br from-primary/6 to-canvas p-4">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="text-caption-sm text-muted">{s.label}</span>
              <span className="text-title-md text-ink">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms by name"
            className="h-11 pl-9"
          />
        </div>
      )}

      {roomTypes.length === 0 && !adding && (
        <p className="text-body-sm text-muted">No room types yet — add one so guests can book.</p>
      )}

      {showSearch && q && filtered.length === 0 && (
        <p className="text-body-sm text-muted">No rooms match &ldquo;{query.trim()}&rdquo;.</p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((rt) => {
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
                className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-soft"
              >
                {cover ? (
                  <span className="size-9 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlFor(cover)} alt="" className="size-full object-cover" />
                  </span>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-strong text-muted">
                    <BedDouble className="size-4.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-sm text-ink">{rt.name}</p>
                  <p className="mt-0.5 truncate text-caption-sm text-muted">
                    {rt.capacity} guest{rt.capacity > 1 ? "s" : ""} · {rt.quantity} unit
                    {rt.quantity > 1 ? "s" : ""} · {peso(rt.base_price)}
                    {photos.length > 0
                      ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}`
                      : ""}
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
            }
            return res;
          }}
        />
      )}

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
