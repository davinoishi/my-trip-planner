import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { trips } from "./trips";
import { users } from "./users";

export const participantRoleEnum = pgEnum("participant_role", [
  "owner",
  "editor",
  "viewer",
]);

export const participants = pgTable(
  "participants",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // stored for pending invites
    role: participantRoleEnum("role").notNull().default("viewer"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [
    index("participants_trip_id_idx").on(table.tripId),
    index("participants_user_id_idx").on(table.userId),
    unique("participants_trip_user_unique").on(table.tripId, table.email),
  ]
);

export const shareLinks = pgTable("share_links", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: participantRoleEnum("role").notNull().default("viewer"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});


export type Participant = typeof participants.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
