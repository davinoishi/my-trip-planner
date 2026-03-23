import { db, auditLogs } from "@trip/db";
import { nanoid } from "../utils/id";

export type AuditAction =
  | "trip.create"
  | "trip.update"
  | "trip.delete"
  | "trip.archive"
  | "trip.duplicate"
  | "trip.merge"
  | "participant.add"
  | "participant.remove"
  | "participant.update"
  | "document.upload"
  | "document.delete"
  | "calendar_token.reset"
  | "calendar_token.revoke"
  | "gmail.import"
  | "sharing.change";

export interface AuditContext {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but never thrown,
 * so a logging failure never blocks the operation being audited.
 */
export async function writeAuditLog(ctx: AuditContext): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.insert(auditLogs) as any).values({
      id: nanoid(),
      userId: ctx.userId,
      action: ctx.action,
      resourceType: ctx.resourceType,
      resourceId: ctx.resourceId ?? null,
      metadata: ctx.metadata ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}
