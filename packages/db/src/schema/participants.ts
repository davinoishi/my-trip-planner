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
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(), // stored for pending invites
    role: participantRoleEnum("role").notNull().default("viewer"),
    /** 1 = this person is physically going on the trip — counts toward their travel stats */
    isGoingOnTrip: integer("is_going_on_trip").notNull().default(0),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [
    index("participants_trip_id_idx").on(table.tripId),
    index("participants_user_id_idx").on(table.userId),
    index("participants_email_idx").on(table.email),
    unique("participants_trip_user_unique").on(table.tripId, table.email),
  ]
);

/**
 * Account-level sharing: owner grants access to ALL their current and future trips.
 * Trip-level participants entries override this for individual trips.
 */
export const accountShares = pgTable(
  "account_shares",
  {
    id: text("id").primaryKey(),
    /** The user whose trips are being shared */
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedWithEmail: text("shared_with_email").notNull(),
    /** Resolved once the recipient has an account */
    sharedWithUserId: text("shared_with_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    role: participantRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("account_shares_owner_idx").on(table.ownerId),
    index("account_shares_user_idx").on(table.sharedWithUserId),
    index("account_shares_email_idx").on(table.sharedWithEmail),
    unique("account_shares_owner_email_unique").on(table.ownerId, table.sharedWithEmail),
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
export type AccountShare = typeof accountShares.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;

