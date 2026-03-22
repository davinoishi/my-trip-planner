"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ApiItineraryItem } from "./item-card";
import {
  BOOKING_TYPES,
  type BookingType,
  detailsSchemaByType,
} from "@trip/shared";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ItemTypeIcon, typeLabel } from "./item-type-icon";

// Combined form schema: base fields + details are both flat in the form, then split on submit
const formSchema = z.object({
  type: z.enum(BOOKING_TYPES),
  title: z.string().min(1, "Title is required").max(200),
  notes: z.string().max(2000).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
    .optional()
    .or(z.literal("")),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
    .optional()
    .or(z.literal("")),
  // Details fields — all optional, validated per-type on submit
  airline: z.string().max(100).optional(),
  flightNumber: z.string().max(20).optional(),
  departureAirport: z.string().max(10).optional(),
  arrivalAirport: z.string().max(10).optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  confirmationNumber: z.string().max(50).optional(),
  cabinClass: z
    .enum(["economy", "premium_economy", "business", "first"])
    .optional()
    .or(z.literal("")),
  terminal: z.string().max(20).optional(),
  seat: z.string().max(20).optional(),
  hotelName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  roomType: z.string().max(100).optional(),
  bookingUrl: z.string().optional(),
  phone: z.string().max(30).optional(),
  company: z.string().max(100).optional(),
  pickupLocation: z.string().max(300).optional(),
  dropoffLocation: z.string().max(300).optional(),
  pickupTime: z.string().optional(),
  dropoffTime: z.string().optional(),
  carType: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  trainNumber: z.string().max(20).optional(),
  departureStation: z.string().max(200).optional(),
  arrivalStation: z.string().max(200).optional(),
  carNumber: z.string().max(20).optional(),
  seatNumber: z.string().max(20).optional(),
  venue: z.string().max(200).optional(),
  provider: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ── Detail field components per type ──────────────────────────────────────────

function FlightFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Airline" error={errors.airline?.message}>
        <Input placeholder="Air Canada" {...register("airline")} />
      </Field>
      <Field label="Flight Number" error={errors.flightNumber?.message}>
        <Input placeholder="AC123" {...register("flightNumber")} />
      </Field>
      <Field label="From (IATA)" error={errors.departureAirport?.message}>
        <Input placeholder="YVR" {...register("departureAirport")} />
      </Field>
      <Field label="To (IATA)" error={errors.arrivalAirport?.message}>
        <Input placeholder="NRT" {...register("arrivalAirport")} />
      </Field>
      <Field label="Departs" error={errors.departureTime?.message}>
        <Input type="time" {...register("departureTime")} />
      </Field>
      <Field label="Arrives" error={errors.arrivalTime?.message}>
        <Input type="time" {...register("arrivalTime")} />
      </Field>
      <Field label="Cabin Class" error={errors.cabinClass?.message}>
        <Select {...register("cabinClass")}>
          <option value="">Select…</option>
          <option value="economy">Economy</option>
          <option value="premium_economy">Premium Economy</option>
          <option value="business">Business</option>
          <option value="first">First</option>
        </Select>
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="ABC123" {...register("confirmationNumber")} />
      </Field>
      <Field label="Terminal" error={errors.terminal?.message}>
        <Input placeholder="T1" {...register("terminal")} />
      </Field>
      <Field label="Seat" error={errors.seat?.message}>
        <Input placeholder="22A" {...register("seat")} />
      </Field>
    </div>
  );
}

function HotelFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Hotel Name" error={errors.hotelName?.message} className="col-span-2">
        <Input placeholder="Hilton Tokyo" {...register("hotelName")} />
      </Field>
      <Field label="Address" error={errors.address?.message} className="col-span-2">
        <Input placeholder="123 Main St, Tokyo" {...register("address")} />
      </Field>
      <Field label="Check-in Time" error={errors.checkInTime?.message}>
        <Input type="time" {...register("checkInTime")} />
      </Field>
      <Field label="Check-out Time" error={errors.checkOutTime?.message}>
        <Input type="time" {...register("checkOutTime")} />
      </Field>
      <Field label="Room Type" error={errors.roomType?.message}>
        <Input placeholder="Deluxe King" {...register("roomType")} />
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="HILTON123" {...register("confirmationNumber")} />
      </Field>
      <Field label="Booking URL" error={errors.bookingUrl?.message} className="col-span-2">
        <Input placeholder="https://…" {...register("bookingUrl")} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input placeholder="+1 555 000 0000" {...register("phone")} />
      </Field>
    </div>
  );
}

function CarRentalFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Company" error={errors.company?.message}>
        <Input placeholder="Hertz" {...register("company")} />
      </Field>
      <Field label="Car Type" error={errors.carType?.message}>
        <Input placeholder="Compact SUV" {...register("carType")} />
      </Field>
      <Field label="Pick-up Location" error={errors.pickupLocation?.message} className="col-span-2">
        <Input placeholder="Airport Terminal 2" {...register("pickupLocation")} />
      </Field>
      <Field label="Drop-off Location" error={errors.dropoffLocation?.message} className="col-span-2">
        <Input placeholder="Same as pick-up" {...register("dropoffLocation")} />
      </Field>
      <Field label="Pick-up Time" error={errors.pickupTime?.message}>
        <Input type="time" {...register("pickupTime")} />
      </Field>
      <Field label="Drop-off Time" error={errors.dropoffTime?.message}>
        <Input type="time" {...register("dropoffTime")} />
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="HERTZ456" {...register("confirmationNumber")} />
      </Field>
      <Field label="Booking URL" error={errors.bookingUrl?.message}>
        <Input placeholder="https://…" {...register("bookingUrl")} />
      </Field>
    </div>
  );
}

function TrainFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Carrier" error={errors.carrier?.message}>
        <Input placeholder="JR East" {...register("carrier")} />
      </Field>
      <Field label="Train Number" error={errors.trainNumber?.message}>
        <Input placeholder="Hikari 203" {...register("trainNumber")} />
      </Field>
      <Field label="Departure Station" error={errors.departureStation?.message}>
        <Input placeholder="Tokyo Station" {...register("departureStation")} />
      </Field>
      <Field label="Arrival Station" error={errors.arrivalStation?.message}>
        <Input placeholder="Osaka Station" {...register("arrivalStation")} />
      </Field>
      <Field label="Departs" error={errors.departureTime?.message}>
        <Input type="time" {...register("departureTime")} />
      </Field>
      <Field label="Arrives" error={errors.arrivalTime?.message}>
        <Input type="time" {...register("arrivalTime")} />
      </Field>
      <Field label="Car #" error={errors.carNumber?.message}>
        <Input placeholder="5" {...register("carNumber")} />
      </Field>
      <Field label="Seat #" error={errors.seatNumber?.message}>
        <Input placeholder="12A" {...register("seatNumber")} />
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="JR99999" {...register("confirmationNumber")} />
      </Field>
    </div>
  );
}

function ActivityFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Venue" error={errors.venue?.message} className="col-span-2">
        <Input placeholder="teamLab Planets" {...register("venue")} />
      </Field>
      <Field label="Address" error={errors.address?.message} className="col-span-2">
        <Input placeholder="6 Chome-1-1 Toyosu, Koto City" {...register("address")} />
      </Field>
      <Field label="Start Time" error={errors.startTime?.message}>
        <Input type="time" {...register("startTime")} />
      </Field>
      <Field label="End Time" error={errors.endTime?.message}>
        <Input type="time" {...register("endTime")} />
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="TL-00001" {...register("confirmationNumber")} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input placeholder="+81 3 0000 0000" {...register("phone")} />
      </Field>
      <Field label="Booking URL" error={errors.bookingUrl?.message} className="col-span-2">
        <Input placeholder="https://…" {...register("bookingUrl")} />
      </Field>
    </div>
  );
}

function TransferFields({ register, errors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Provider" error={errors.provider?.message}>
        <Input placeholder="Uber / Taxi / Shuttle" {...register("provider")} />
      </Field>
      <Field label="Pick-up Time" error={errors.pickupTime?.message}>
        <Input type="time" {...register("pickupTime")} />
      </Field>
      <Field label="From" error={errors.pickupLocation?.message} className="col-span-2">
        <Input placeholder="Hotel lobby" {...register("pickupLocation")} />
      </Field>
      <Field label="To" error={errors.dropoffLocation?.message} className="col-span-2">
        <Input placeholder="Narita Airport T1" {...register("dropoffLocation")} />
      </Field>
      <Field label="Confirmation #" error={errors.confirmationNumber?.message}>
        <Input placeholder="UBER-XYZ" {...register("confirmationNumber")} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input placeholder="+1 555 000 0000" {...register("phone")} />
      </Field>
    </div>
  );
}

// ── Detail field keys by type (for extracting from flat form values) ───────────
const detailKeysByType: Record<BookingType, string[]> = {
  flight: ["airline","flightNumber","departureAirport","arrivalAirport","departureTime","arrivalTime","confirmationNumber","cabinClass","terminal","seat"],
  hotel: ["hotelName","address","checkInTime","checkOutTime","confirmationNumber","roomType","bookingUrl","phone"],
  car_rental: ["company","pickupLocation","dropoffLocation","confirmationNumber","carType","pickupTime","dropoffTime","bookingUrl"],
  train: ["carrier","trainNumber","departureStation","arrivalStation","departureTime","arrivalTime","confirmationNumber","carNumber","seatNumber"],
  activity: ["venue","address","startTime","endTime","confirmationNumber","bookingUrl","phone"],
  transfer: ["provider","pickupLocation","dropoffLocation","pickupTime","confirmationNumber","phone"],
  note: [],
};

// ── Main form component ────────────────────────────────────────────────────────
interface ItemFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: BookingType;
    title: string;
    notes?: string;
    startTime?: string;
    endTime?: string;
    details: Record<string, unknown>;
  }) => void;
  defaultDayIndex: number;
  tripDurationDays: number;
  editingItem?: ApiItineraryItem | null;
  isLoading?: boolean;
}

function flattenItemToForm(item: ApiItineraryItem): Partial<FormValues> {
  const details = (item.details ?? {}) as Record<string, string>;
  return {
    type: item.type,
    title: item.title,
    notes: item.notes ?? "",
    startTime: item.startTime ?? "",
    endTime: item.endTime ?? "",
    ...details,
  };
}

export function ItemForm({
  open,
  onClose,
  onSubmit,
  editingItem,
  isLoading,
}: ItemFormProps) {
  const isEditing = !!editingItem;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editingItem
      ? flattenItemToForm(editingItem)
      : { type: "flight" },
  });

  // Reset form when the editing target changes
  useEffect(() => {
    if (open) {
      reset(editingItem ? flattenItemToForm(editingItem) : { type: "flight" });
    }
  }, [open, editingItem, reset]);

  const selectedType = watch("type");

  function handleFormSubmit(values: FormValues) {
    const detailKeys = detailKeysByType[values.type];
    const details: Record<string, unknown> = {};
    for (const key of detailKeys) {
      const val = (values as any)[key];
      if (val !== undefined && val !== "") details[key] = val;
    }
    onSubmit({
      type: values.type,
      title: values.title,
      notes: values.notes || undefined,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
      details,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Item" : "Add Item"}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Type selector */}
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {BOOKING_TYPES.map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center text-xs font-medium transition
                ${selectedType === type
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
            >
              <input type="radio" value={type} {...register("type")} className="sr-only" />
              <ItemTypeIcon type={type} size={18} />
              <span>{typeLabel[type]}</span>
            </label>
          ))}
        </div>

        {/* Title + time */}
        <Field label="Title" error={errors.title?.message} required>
          <Input placeholder="Add a title…" {...register("title")} />
        </Field>

        {selectedType !== "activity" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time" hint="HH:MM" error={errors.startTime?.message}>
              <Input type="time" {...register("startTime")} />
            </Field>
            <Field label="End Time" hint="HH:MM" error={errors.endTime?.message}>
              <Input type="time" {...register("endTime")} />
            </Field>
          </div>
        )}

        {/* Type-specific fields */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          {selectedType === "flight" && <FlightFields register={register} errors={errors} />}
          {selectedType === "hotel" && <HotelFields register={register} errors={errors} />}
          {selectedType === "car_rental" && <CarRentalFields register={register} errors={errors} />}
          {selectedType === "train" && <TrainFields register={register} errors={errors} />}
          {selectedType === "activity" && <ActivityFields register={register} errors={errors} />}
          {selectedType === "transfer" && <TransferFields register={register} errors={errors} />}
          {selectedType === "note" && (
            <p className="text-center text-xs text-gray-400">
              Use the notes field below to add details.
            </p>
          )}
        </div>

        {/* Notes */}
        <Field label="Notes" error={errors.notes?.message}>
          <Textarea
            rows={3}
            placeholder="Any extra notes…"
            {...register("notes")}
          />
        </Field>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : isEditing ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
