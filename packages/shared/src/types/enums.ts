export const BOOKING_TYPES = [
  "flight",
  "hotel",
  "car_rental",
  "train",
  "activity",
  "transfer",
  "note",
] as const;

export type BookingType = (typeof BOOKING_TYPES)[number];

export const TRIP_STATUSES = [
  "planning",
  "confirmed",
  "completed",
  "archived",
  "canceled",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const PARTICIPANT_ROLES = ["owner", "editor", "viewer"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const ITEM_SOURCES = ["manual", "email_import", "imap_poll"] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

