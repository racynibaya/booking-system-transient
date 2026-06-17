"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createRoomType, deleteRoomType, updateRoomType } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";

import { RoomPhotosUploader } from "./room-photos-uploader";
import { RoomTypeForm } from "./room-type-form";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
        {roomTypes.map((rt) =>
          editingId === rt.id ? (
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
                  toast.success("Room type updated");
                }
                return res;
              }}
            />
          ) : (
            <div key={rt.id} className="flex flex-col gap-4 rounded-md border border-hairline p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-title-md text-ink">{rt.name}</p>
                  <p className="text-body-sm text-muted">
                    {rt.capacity} guests · {rt.quantity} unit{rt.quantity > 1 ? "s" : ""} · ₱
                    {rt.base_price}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(rt.id)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = await deleteRoomType(rt.id, propertyId);
                      if (res.ok) toast.success("Room type removed");
                      else toast.error(res.error);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="border-t border-hairline pt-3">
                <p className="mb-2 text-caption text-muted">Photos</p>
                <RoomPhotosUploader
                  roomTypeId={rt.id}
                  propertyId={propertyId}
                  tenantId={tenantId}
                  currentPhotos={rt.photos ?? []}
                />
              </div>
            </div>
          ),
        )}
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
    </section>
  );
}
