import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"

type PrismaTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ROLE_CHANGE" | "PERMISSION_CHANGE"

export interface AuditEntryParams {
  action: AuditAction
  entity: string
  entityId: string
  userId: string
  storeId?: string | null
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
  tx?: PrismaTransaction
}

export async function createAuditEntry(params: AuditEntryParams): Promise<void> {
  const client = params.tx ?? db
  await (client as any).auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      userId: params.userId,
      storeId: params.storeId ?? undefined,
      changes: params.changes ?? Prisma.JsonNull,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
  })
}

export async function getAuditLogs(filters: {
  entity?: string
  entityId?: string
  action?: string
  userId?: string
  storeId?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}) {
  const where: Record<string, unknown> = {}

  if (filters.entity) where.entity = filters.entity
  if (filters.entityId) where.entityId = filters.entityId
  if (filters.action) where.action = filters.action
  if (filters.userId) where.userId = filters.userId
  if (filters.storeId) where.storeId = filters.storeId
  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Record<string, Date> = {}
    if (filters.dateFrom) createdAt.gte = filters.dateFrom
    if (filters.dateTo) createdAt.lte = filters.dateTo
    where.createdAt = createdAt
  }

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, login: true } } },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    db.auditLog.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function cleanupAuditLogs(retentionDays: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return result.count
}
