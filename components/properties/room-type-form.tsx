"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { roomTypeInput, type RoomTypeInput } from "@/lib/validation";

import type { ActionResult } from "@/app/(app)/properties/actions";

export function RoomTypeForm({
  defaultValues,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  defaultValues?: Partial<RoomTypeInput>;
  onSubmit: (values: RoomTypeInput) => Promise<ActionResult>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoomTypeInput>({
    resolver: zodResolver(roomTypeInput),
    defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        const res = await onSubmit(values);
        if (!res.ok) setFormError(res.error);
      })}
      className="flex flex-col gap-4 rounded-md border border-hairline p-4"
    >
      <Field label="Room name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Deluxe Double" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Capacity" error={errors.capacity?.message}>
          <Input type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
        </Field>
        <Field label="Quantity" error={errors.quantity?.message}>
          <Input type="number" min={1} {...register("quantity", { valueAsNumber: true })} />
        </Field>
        <Field label="Price (₱/night)" error={errors.base_price?.message}>
          <Input
            type="number"
            min={0}
            step="0.01"
            {...register("base_price", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field label="Description" error={errors.description?.message}>
        <Textarea {...register("description")} />
      </Field>

      {formError && <p className="text-body-sm text-error">{formError}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
