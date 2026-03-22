import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { trips } from "./trips";

export const bookingTypeEnum = pgEnum("booking_type", [
  "flight",
  "hotel",
  "car_rental",
  "train",
  "activity",
  "transfer",
  "note",
]);

export const itemSourceEnum = pgEnum("item_source", [
  "manual",
  "email_import",
  "imap_poll",
]);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    type: bookingTypeEnum("type").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    dayIndex: integer("day_index").notNull(), // 0-based day within the trip
    sortOrder: integer("sort_order").notNull().default(0),
    source: itemSourceEnum("source").notNull().default("manual"),
    confidenceScore: real("confidence_score"), // 0.0–1.0 for imported items
    isDraft: integer("is_draft").notNull().default(0), // 1 = pending review
    version: integer("version").notNull().default(1), // optimistic locking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("itinerary_items_trip_id_idx").on(table.tripId),
    index("itinerary_items_day_idx").on(table.tripId, table.dayIndex),
  ]
);

export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type NewItineraryItem = typeof itineraryItems.$inferInsert;
