import { z } from "zod";
import { BOOKING_TYPES } from "../types/enums";

// ── HH:MM time string ──────────────────────────────────────────────────────────
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
  .optional();

// ── Type-specific detail schemas ───────────────────────────────────────────────
export const flightDetailsSchema = z.object({
  airline: z.string().max(100).optional(),
  flightNumber: z.string().max(20).optional(),
  departureAirport: z.string().max(10).optional(), // IATA code e.g. YVR
  arrivalAirport: z.string().max(10).optional(),
  departureTime: timeString,
  arrivalTime: timeString,
  confirmationNumber: z.string().max(50).optional(),
  cabinClass: z
    .enum(["economy", "premium_economy", "business", "first"])
    .optional(),
  terminal: z.string().max(20).optional(),
  seat: z.string().max(20).optional(),
});

export const hotelDetailsSchema = z.object({
  hotelName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  checkInTime: timeString,
  checkOutTime: timeString,
  confirmationNumber: z.string().max(50).optional(),
  roomType: z.string().max(100).optional(),
  bookingUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
});

export const carRentalDetailsSchema = z.object({
  company: z.string().max(100).optional(),
  pickupLocation: z.string().max(300).optional(),
  dropoffLocation: z.string().max(300).optional(),
  confirmationNumber: z.string().max(50).optional(),
  carType: z.string().max(100).optional(),
  pickupTime: timeString,
  dropoffTime: timeString,
  bookingUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export const trainDetailsSchema = z.object({
  carrier: z.string().max(100).optional(),
  trainNumber: z.string().max(20).optional(),
  departureStation: z.string().max(200).optional(),
  arrivalStation: z.string().max(200).optional(),
  departureTime: timeString,
  arrivalTime: timeString,
  confirmationNumber: z.string().max(50).optional(),
  carNumber: z.string().max(20).optional(),
  seatNumber: z.string().max(20).optional(),
});

export const activityDetailsSchema = z.object({
  venue: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  startTime: timeString,
  endTime: timeString,
  confirmationNumber: z.string().max(50).optional(),
  bookingUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
});

export const transferDetailsSchema = z.object({
  provider: z.string().max(100).optional(),
  pickupLocation: z.string().max(300).optional(),
  dropoffLocation: z.string().max(300).optional(),
  pickupTime: timeString,
  confirmationNumber: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
});

export const noteDetailsSchema = z.object({});

// ── Union for type narrowing in UI ─────────────────────────────────────────────
export type FlightDetails = z.infer<typeof flightDetailsSchema>;
export type HotelDetails = z.infer<typeof hotelDetailsSchema>;
export type CarRentalDetails = z.infer<typeof carRentalDetailsSchema>;
export type TrainDetails = z.infer<typeof trainDetailsSchema>;
export type ActivityDetails = z.infer<typeof activityDetailsSchema>;
export type TransferDetails = z.infer<typeof transferDetailsSchema>;
export type NoteDetails = z.infer<typeof noteDetailsSchema>;

export type ItemDetails =
  | FlightDetails
  | HotelDetails
  | CarRentalDetails
  | TrainDetails
  | ActivityDetails
  | TransferDetails
  | NoteDetails;

// Map from booking type to its details schema
export const detailsSchemaByType = {
  flight: flightDetailsSchema,
  hotel: hotelDetailsSchema,
  car_rental: carRentalDetailsSchema,
  train: trainDetailsSchema,
  activity: activityDetailsSchema,
  transfer: transferDetailsSchema,
  note: noteDetailsSchema,
} as const;

// ── Create / Update schemas ────────────────────────────────────────────────────
export const createItineraryItemSchema = z.object({
  tripId: z.string().min(1),
  type: z.enum(BOOKING_TYPES),
  title: z.string().min(1, "Title is required").max(200),
  notes: z.string().max(2000).optional(),
  dayIndex: z.number().int().min(0),
  sortOrder: z.number().int().min(0).optional(),
  startTime: timeString,
  endTime: timeString,
  details: z.record(z.unknown()).optional(),
});

export const updateItineraryItemSchema = createItineraryItemSchema
  .omit({ tripId: true })
  .partial()
  .extend({
    version: z.number().int().min(1), // required for optimistic locking
  });

export const reorderItemsSchema = z.object({
  tripId: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string(),
      dayIndex: z.number().int().min(0),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export type CreateItineraryItemInput = z.infer<typeof createItineraryItemSchema>;
export type UpdateItineraryItemInput = z.infer<typeof updateItineraryItemSchema>;
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
