import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { trips } from "./trips";
import { itineraryItems } from "./itinerary-items";
import { users } from "./users";

export const documentCategoryEnum = pgEnum("document_category", [
  "boarding_pass",
  "insurance",
  "ticket",
  "visa",
  "passport",
  "hotel_booking",
  "car_rental",
  "train_ticket",
  "other",
]);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => itineraryItems.id, {
      onDelete: "set null",
    }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // File metadata
    originalName: text("original_name").notNull(),
    storageKey: text("storage_key").notNull().unique(), // MinIO object key
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(), // bytes
    category: documentCategoryEnum("category").notNull().default("other"),
    // Scan result
    scanPassed: integer("scan_passed").notNull().default(1), // 1 = clean / skipped
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("documents_trip_id_idx").on(table.tripId),
    index("documents_item_id_idx").on(table.itemId),
  ]
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

