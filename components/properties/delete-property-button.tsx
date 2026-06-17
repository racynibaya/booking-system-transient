"use client";

import { toast } from "sonner";

import { deleteProperty } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";

export function DeletePropertyButton({ id }: { id: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        if (!confirm("Delete this property? This can't be undone.")) return;
        // Redirects to /properties on success; returns an error otherwise.
        const res = await deleteProperty(id);
        if (!res.ok) toast.error(res.error);
      }}
    >
      Delete property
    </Button>
  );
}
