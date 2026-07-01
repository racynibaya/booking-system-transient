"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SocialField } from "@/components/properties/social-input";
import { AMENITY_GROUPS, AMENITY_OPTIONS } from "@/lib/amenities";
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
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertyInput),
    defaultValues: {
      dot_accredited: false,
      check_in_time: "14:00",
      check_out_time: "14:00",
      min_stay_nights: 2,
      amenities: [],
      facebook_url: "",
      instagram_url: "",
      tiktok_url: "",
      ...defaultValues,
    },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [customAmenity, setCustomAmenity] = useState("");

  // Amenities is a controlled array field (the rest of the form uses register).
  // useWatch (not watch()) so the React Compiler can memoize this component.
  const selectedAmenities = useWatch({ control, name: "amenities" }) ?? [];
  const area = useWatch({ control, name: "area" }) ?? "";
  const setAmenities = (next: string[]) =>
    setValue("amenities", next, { shouldDirty: true, shouldValidate: true });
  const toggleAmenity = (label: string) =>
    setAmenities(
      selectedAmenities.includes(label)
        ? selectedAmenities.filter((a) => a !== label)
        : [...selectedAmenities, label],
    );
  const addCustomAmenity = () => {
    const value = customAmenity.trim();
    if (value && !selectedAmenities.includes(value)) setAmenities([...selectedAmenities, value]);
    setCustomAmenity("");
  };
  // Operator's "Other" entries — anything selected that isn't a curated option.
  const customAmenities = selectedAmenities.filter((a) => !AMENITY_OPTIONS.includes(a));

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        // createProperty redirects on success (this never resolves); updateProperty returns ok.
        const res = await action(values);
        if (!res.ok) setFormError(res.error);
        else toast.success("Saved");
      })}
      className="flex flex-col gap-6"
    >
      {/* Short fields share a 2-column grid so the form fills the card instead of stacking down the
          left edge; description/amenities/socials below stay full width. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Property name" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Kahuna Beach House" />
          </Field>
        </div>

        {/* Barangay uses the searchable Combobox (41 options) instead of a native
            select. Rendered with an inline label, NOT <Field>, because wrapping a
            <button> trigger in a <label> double-fires its click and the panel
            toggles shut on open. */}
        <div className="flex flex-col gap-2">
          <span className="text-caption text-muted">Barangay</span>
          <Combobox
            options={SAN_JUAN_AREAS}
            value={area}
            onChange={(v) => setValue("area", v, { shouldDirty: true, shouldValidate: true })}
            placeholder="Select a barangay…"
            searchPlaceholder="Search barangays…"
            emptyLabel="No barangay matches"
            invalid={!!errors.area}
          />
          {errors.area?.message && (
            <span className="text-body-sm text-error">{errors.area.message}</span>
          )}
        </div>

        <Field label="Address" error={errors.address?.message}>
          <Input {...register("address")} placeholder="Brgy. Urbiztondo, San Juan, La Union" />
        </Field>

        {/* Native time pickers are NOT wrapped in <label> here: on iOS Safari a
            label-wrapped date/time input forwards the tap and the picker opens then
            instantly closes (reads as "unresponsive"). Associate via htmlFor instead. */}
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

        <Field label="Minimum nights" error={errors.min_stay_nights?.message}>
          <Input
            type="number"
            min={1}
            max={30}
            className="max-w-28"
            {...register("min_stay_nights", { valueAsNumber: true })}
          />
          <span className="text-body-sm text-muted">
            Shortest stay guests can book online. Walk-ins you record manually aren&apos;t affected.
          </span>
        </Field>

        <label className="flex items-center gap-2 self-end pb-3">
          <input type="checkbox" {...register("dot_accredited")} className="size-4" />
          <span className="text-body-sm text-ink">DOT accredited</span>
        </label>

        <div className="sm:col-span-2">
          <Field label="Description" error={errors.description?.message}>
            <Textarea
              {...register("description")}
              placeholder="A short description guests will see."
            />
          </Field>
        </div>
      </div>

      <Field label="Amenities" error={errors.amenities?.message}>
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-muted">
            Tap the ones your place offers. Can&apos;t find it? Add your own below.
          </p>

          <div className="flex flex-col gap-4">
            {AMENITY_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <h3 className="text-caption font-medium tracking-wide text-muted uppercase">
                  {group.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((label) => {
                    const on = selectedAmenities.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAmenity(label)}
                        className={`rounded-full px-3.5 py-1.5 text-body-sm transition-[background-color,border-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] ${
                          on
                            ? "bg-primary-disabled font-medium text-primary-active"
                            : "border border-hairline text-body hover:border-border-strong hover:bg-surface-soft"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {customAmenities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customAmenities.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-disabled py-1.5 pr-2 pl-3.5 text-body-sm font-medium text-primary-active"
                >
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => toggleAmenity(label)}
                    className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomAmenity();
                }
              }}
              placeholder="Other amenity…"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addCustomAmenity}
              disabled={customAmenity.trim() === ""}
              className="shrink-0"
            >
              Add
            </Button>
          </div>
        </div>
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted">
          Socials — shown on your booking page so guests can follow your place. Just your handle, no
          link needed.
        </p>
        <SocialField
          platform="facebook"
          defaultUrl={defaultValues?.facebook_url}
          onUrlChange={(url) => setValue("facebook_url", url, { shouldDirty: true })}
          error={errors.facebook_url?.message}
        />
        <SocialField
          platform="instagram"
          defaultUrl={defaultValues?.instagram_url}
          onUrlChange={(url) => setValue("instagram_url", url, { shouldDirty: true })}
          error={errors.instagram_url?.message}
        />
        <SocialField
          platform="tiktok"
          defaultUrl={defaultValues?.tiktok_url}
          onUrlChange={(url) => setValue("tiktok_url", url, { shouldDirty: true })}
          error={errors.tiktok_url?.message}
        />
      </div>

      {formError && <p className="text-body-sm text-error">{formError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
