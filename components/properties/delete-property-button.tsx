"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProperty } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeletePropertyButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(true)}>
        Delete property
      </Button>

      <ConfirmDialog
        open={open}
        title="Delete this property?"
        description="This removes the property and all its room types. You can't undo it."
        confirmLabel="Yes, delete"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            // Redirects to /properties on success (unmounts this); returns an error otherwise.
            const res = await deleteProperty(id);
            if (!res.ok) {
              toast.error(res.error);
              setOpen(false);
            }
          });
        }}
      />
    </>
  );
}
