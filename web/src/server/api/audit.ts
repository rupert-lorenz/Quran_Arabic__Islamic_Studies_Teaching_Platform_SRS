import { auditLogs } from "@/db/schema";
import { db } from "@/db";
import type { ApiActor } from "./auth";

export async function writeAuditLog(input: {
  actor: ApiActor | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: input.actor?.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
    });
  } catch (error) {
    console.error("audit_write_failed", {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
