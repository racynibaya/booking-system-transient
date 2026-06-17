"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SAN_JUAN_AREAS } from "@/lib/areas";
import { propertyInput, type PropertyInput } from "@/lib/validation";

import type { ActionResult } from "@/app/(app)/properties/actions";

export function PropertyForm({
  defaultValues,
  action,
  submitLabel,
}: {
  defaultValues?: Partial<PropertyInput>;
  action: (input: PropertyInput) => Promise<ActionResult>;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertyInput),
    defaultValues: { dot_accredited: false, ...defaultValues },
  });
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        // createProperty redirects on success (this never resolves); updateProperty returns ok.
        const res = await action(values);
        if (!res.ok) setFormError(res.error);
        else toast.success("Saved");
      })}
      className="flex max-w-xl flex-col gap-5"
    >
      <Field label="Property name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Kahuna Beach House" />
      </Field>

      <Field label="Area" error={errors.area?.message}>
        <Select {...register("area")} defaultValue="">
          <option value="">Select an area…</option>
          {SAN_JUAN_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Address" error={errors.address?.message}>
        <Input {...register("address")} placeholder="Brgy. Urbiztondo, San Juan, La Union" />
      </Field>

      <Field label="Description" error={errors.description?.message}>
        <Textarea {...register("description")} placeholder="A short description guests will see." />
      </Field>

      <label className="flex items-center gap-2">
        <input type="checkbox" {...register("dot_accredited")} className="size-4" />
        <span className="text-body-sm text-ink">DOT accredited</span>
      </label>

      {formError && <p className="text-body-sm text-error">{formError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
