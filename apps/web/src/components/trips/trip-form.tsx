"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTripSchema, type CreateTripInput, TRIP_STATUSES } from "@trip/shared";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Common IANA timezones for the selector
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

interface TripFormProps {
  defaultValues?: Partial<CreateTripInput>;
  onSubmit: (data: CreateTripInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export function TripForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Create Trip",
  isLoading,
}: TripFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      status: "planning",
      timezone: "UTC",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Trip Name */}
      <Field label="Trip Name" htmlFor="name" error={errors.name?.message} required>
        <Input
          id="name"
          placeholder="e.g. Tokyo Adventure"
          error={errors.name?.message}
          {...register("name")}
        />
      </Field>

      {/* Description */}
      <Field label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea
          id="description"
          rows={3}
          placeholder="Add a short description (optional)"
          error={errors.description?.message}
          {...register("description")}
        />
      </Field>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date" htmlFor="startDate" error={errors.startDate?.message} required>
          <Input
            id="startDate"
            type="date"
            error={errors.startDate?.message}
            {...register("startDate")}
          />
        </Field>
        <Field label="End Date" htmlFor="endDate" error={errors.endDate?.message} required>
          <Input
            id="endDate"
            type="date"
            error={errors.endDate?.message}
            {...register("endDate")}
          />
        </Field>
      </div>

      {/* Timezone */}
      <Field label="Timezone" htmlFor="timezone" hint="Used to display all times correctly" error={errors.timezone?.message}>
        <Select id="timezone" {...register("timezone")}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </Select>
      </Field>

      {/* Status */}
      <Field label="Status" htmlFor="status" error={errors.status?.message}>
        <Select id="status" {...register("status")}>
          {TRIP_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
