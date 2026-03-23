import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Audit log for sensitive actions: trip deletions, participant changes,
 * document uploads, calendar token resets, trip merges, and sharing changes.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    /** The user who performed the action */
    userId: text("user_id").notNull(),
    /** Action category, e.g. "trip.delete", "participant.add", "token.reset" */
    action: text("action").notNull(),
    /** Resource type, e.g. "trip", "participant", "document", "calendar_token" */
    resourceType: text("resource_type").notNull(),
    /** ID of the affected resource (nullable for bulk actions) */
    resourceId: text("resource_id"),
    /** Additional context: old/new values, reason, etc. */
    metadata: jsonb("metadata"),
    /** Request IP for anomaly detection */
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
