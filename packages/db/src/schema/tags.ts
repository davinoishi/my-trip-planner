import { pgTable, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { itineraryItems } from "./itinerary-items";

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    isPreset: integer("is_preset").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tags_name_idx").on(table.name)]
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.tagId] })]
);

export type Tag = typeof tags.$inferSelect;
export type ItemTag = typeof itemTags.$inferInsert;
