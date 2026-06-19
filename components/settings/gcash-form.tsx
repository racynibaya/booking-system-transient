"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateGcash } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { gcashInput, type GcashInput } from "@/lib/validation";

export function GcashForm({
  defaultValues,
  children,
}: {
  defaultValues?: Partial<GcashInput>;
  children?: ReactNode;
}) {
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
      className="flex flex-col gap-6"
    >
      <div className="flex max-w-md flex-col gap-5">
        <Field label="GCash account name" error={errors.gcash_name?.message}>
          <Input {...register("gcash_name")} placeholder="Juan Dela Cruz" />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-caption text-muted">GCash number</span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
            <Input
              {...register("gcash_number")}
              className="sm:flex-1"
              placeholder="0917 123 4567"
              inputMode="numeric"
            />
            <Button type="submit" disabled={isSubmitting} className="h-14 shrink-0">
              {isSubmitting ? "Saving…" : "Save GCash details"}
            </Button>
          </div>
          {errors.gcash_number?.message && (
            <span className="text-body-sm text-error">{errors.gcash_number.message}</span>
          )}
        </div>

        {formError && <p className="text-body-sm text-error">{formError}</p>}
      </div>

      {children}
    </form>
  );
}
