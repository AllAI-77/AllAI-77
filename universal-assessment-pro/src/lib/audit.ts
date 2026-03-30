import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

interface AuditParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Creates an immutable audit log entry.
 * Fire-and-forget safe — errors are swallowed so auditing never breaks
 * the main request path.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId:     params.userId     ?? undefined,
        action:     params.action,
        entityType: params.entityType,
        entityId:   params.entityId   ?? undefined,
        oldValues:  params.oldValues  as Prisma.InputJsonValue ?? undefined,
        newValues:  params.newValues  as Prisma.InputJsonValue ?? undefined,
        ipAddress:  params.ipAddress  ?? undefined,
        userAgent:  params.userAgent  ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
