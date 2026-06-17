"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateGcash } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { gcashInput, type GcashInput } from "@/lib/validation";

export function GcashForm({ defaultValues }: { defaultValues?: Partial<GcashInput> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GcashInput>({
    resolver: zodResolver(gcashInput),
    defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        const res = await updateGcash(values);
        if (!res.ok) setFormError(res.error);
        else toast.success("GCash details saved");
      })}
      className="flex max-w-md flex-col gap-5"
    >
      <Field label="GCash account name" error={errors.gcash_name?.message}>
        <Input {...register("gcash_name")} placeholder="Juan Dela Cruz" />
      </Field>

      <Field label="GCash number" error={errors.gcash_number?.message}>
        <Input {...register("gcash_number")} placeholder="0917 123 4567" inputMode="numeric" />
      </Field>

      {formError && <p className="text-body-sm text-error">{formError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : "Save GCash details"}
      </Button>
    </form>
  );
}
