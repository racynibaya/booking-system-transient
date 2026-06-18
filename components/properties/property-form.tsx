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
    defaultValues: {
      dot_accredited: false,
      check_in_time: "14:00",
      check_out_time: "14:00",
      ...defaultValues,
    },
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

      <Field label="Barangay" error={errors.area?.message}>
        <Select {...register("area")} defaultValue="">
          <option value="">Select a barangay…</option>
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

      {/* Native time pickers are NOT wrapped in <label> here: on iOS Safari a
          label-wrapped date/time input forwards the tap and the picker opens then
          instantly closes (reads as "unresponsive"). Associate via htmlFor instead,
          and stack full-width on phones so the native control isn't cramped. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="check_in_time" className="text-caption text-muted">
            Check-in time
          </label>
          <Input id="check_in_time" type="time" {...register("check_in_time")} />
          {errors.check_in_time?.message && (
            <span className="text-body-sm text-error">{errors.check_in_time.message}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="check_out_time" className="text-caption text-muted">
            Check-out time
          </label>
          <Input id="check_out_time" type="time" {...register("check_out_time")} />
          {errors.check_out_time?.message && (
            <span className="text-body-sm text-error">{errors.check_out_time.message}</span>
          )}
        </div>
      </div>

      <Field label="Description" error={errors.description?.message}>
        <Textarea {...register("description")} placeholder="A short description guests will see." />
      </Field>

      <Field label="About this place" error={errors.about?.message}>
        <Textarea
          {...register("about")}
          placeholder="Tell guests what makes your place special — the vibe, the location, what's nearby, why they'll love it."
        />
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
