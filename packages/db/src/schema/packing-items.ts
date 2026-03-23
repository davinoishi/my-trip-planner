import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { trips } from "./trips";
import { users } from "./users";

export const packingItems = pgTable("packing_items", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  isChecked: integer("is_checked").notNull().default(0),
  isCustom: integer("is_custom").notNull().default(0), // 1 = user-added
  sortOrder: integer("sort_order").notNull().default(999),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PackingItem = typeof packingItems.$inferSelect;
export type NewPackingItem = typeof packingItems.$inferInsert;
