"use server"

import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { getAuditLogs, cleanupAuditLogs } from "@/lib/audit"
import { mskStartOfDay, mskEndOfDay } from "@/lib/timezone"

export async function fetchAuditLogs(filters: {
  entity?: string
  action?: string
  userId?: string
  storeId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Owner-only access to full audit log (settings.stores is owner/director permission)
  await requirePermission("settings.stores")

  return getAuditLogs({
    ...filters,
    dateFrom: filters.dateFrom ? mskStartOfDay(new Date(filters.dateFrom)) : undefined,
    dateTo: filters.dateTo ? mskEndOfDay(new Date(filters.dateTo)) : undefined,
  })
}

export async function fetchEntityAuditLogs(params: {
  entity: string
  entityId: string
  page?: number
  pageSize?: number
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Any authenticated user can see audit history for entities they can access
  return getAuditLogs({
    entity: params.entity,
    entityId: params.entityId,
    page: params.page,
    pageSize: params.pageSize ?? 10,
  })
}

export async function runAuditCleanup(retentionDays: number) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  await requirePermission("settings.stores")

  if (retentionDays < 30) throw new Error("Минимальный период хранения: 30 дней")
  if (retentionDays > 3650) throw new Error("Максимальный период хранения: 10 лет")

  const deleted = await cleanupAuditLogs(retentionDays)
  return { deleted }
}
