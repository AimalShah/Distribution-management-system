import prisma from "@dms/db";

export interface RecordAuditLogInput {
  organizationId: string;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

export async function recordAuditLog(
  input: RecordAuditLogInput,
  client: { auditLog?: { create?: typeof prisma.auditLog.create } } = prisma
) {
  if (typeof client.auditLog?.create !== "function") {
    return null;
  }

  const detailsStr =
    typeof input.details === "object" && input.details !== null
      ? JSON.stringify(input.details)
      : (input.details ?? null);

  return client.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      details: detailsStr,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export interface ListAuditLogsOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(
  organizationId: string,
  options: ListAuditLogsOptions = {}
) {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const where: {
    organizationId: string;
    entityType?: string;
    entityId?: string;
  } = { organizationId };

  if (options.entityType) {
    where.entityType = options.entityType;
  }

  if (options.entityId) {
    where.entityId = options.entityId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
  };
}
