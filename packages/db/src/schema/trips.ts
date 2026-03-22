import {
  pgTable,
  text,
  timestamp,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const tripStatusEnum = pgEnum("trip_status", [
  "planning",
  "confirmed",
  "completed",
  "archived",
  "canceled",
]);

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    status: tripStatusEnum("status").notNull().default("planning"),
    coverImageUrl: text("cover_image_url"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trips_owner_id_idx").on(table.ownerId),
    index("trips_status_idx").on(table.status),
    index("trips_start_date_idx").on(table.startDate),
  ]
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
