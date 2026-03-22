import {
  pgTable,
  text,
  real,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { trips } from "./trips";
import { itineraryItems } from "./itinerary-items";

export const emailImportStatusEnum = pgEnum("email_import_status", [
  "matched",    // parsed and linked to a trip item
  "unmatched",  // parsed but no trip matched the dates
  "rejected",   // user dismissed it
  "failed",     // parse error
]);

export const emailImports = pgTable(
  "email_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Gmail deduplication key
    messageId: text("message_id").notNull().unique(),
    subject: text("subject").notNull(),
    fromAddress: text("from_address").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    status: emailImportStatusEnum("status").notNull(),
    // Claude-parsed output (stored even if unmatched, so user can re-assign later)
    parsedData: jsonb("parsed_data"), // full extraction result
    confidenceScore: real("confidence_score"),
    // Trip / item assignment (set when matched)
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    itemId: text("item_id").references(() => itineraryItems.id, {
      onDelete: "set null",
    }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("email_imports_user_id_idx").on(table.userId),
    index("email_imports_status_idx").on(table.status),
  ]
);

export type EmailImport = typeof emailImports.$inferSelect;
export type NewEmailImport = typeof emailImports.$inferInsert;
