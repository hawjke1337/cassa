"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"

export async function createCashOperation(data: {
  shiftId: string
  type: "WITHDRAW" | "DEPOSIT"
  amount: number
  fundId?: string
  supplierId?: string
  reason: string
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (data.amount <= 0) throw new Error("Сумма должна быть положительной")
  if (!data.reason.trim()) throw new Error("Укажите причину")
  if (data.type === "WITHDRAW" && !data.fundId) {
    throw new Error("Для выемки укажите фонд")
  }

  // SEC2-05: Hard cap on cash operation amount
  const MAX_CASH_OPERATION = 500_000 // 500k rub hard cap
  if (Math.abs(data.amount) > MAX_CASH_OPERATION) {
    throw new Error(
      `Сумма кассовой операции не может превышать ${MAX_CASH_OPERATION.toLocaleString("ru-RU")} руб.`,
    )
  }

  // Verify shift is open and check store-scoped permission
  const shift = await db.shift.findUnique({ where: { id: data.shiftId } })
  if (!shift) throw new Error("Смена не найдена")
  if (shift.status !== "OPEN") throw new Error("Смена закрыта")

  await requirePermission("shifts.cash_ops", shift.storeId)

  // SEC2-06: Write rate limiting
  const rateCheck = checkWriteRateLimit(session.user.id, "cash.operation")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "cash.operation")

  const op = await db.cashOperation.create({
    data: {
      shiftId: data.shiftId,
      type: data.type,
      amount: data.amount,
      fundId: data.fundId || null,
      supplierId: data.supplierId || null,
      reason: data.reason.trim(),
      performedById: session.user.id,
    },
  })

  return { id: op.id }
}

export async function getCashOperations(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Permission check via shift's store
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    select: { storeId: true, openedById: true },
  })
  if (!shift) throw new Error("Смена не найдена")

  const canViewAll = await checkPermission("shifts.view_all", shift.storeId)
  const canView = await checkPermission("shifts.view", shift.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")
  if (!canViewAll && shift.openedById !== session.user.id) {
    throw new Error("Нет доступа к этой смене")
  }

  const operations = await db.cashOperation.findMany({
    where: { shiftId },
    include: {
      fund: { select: { name: true } },
      supplier: { select: { name: true } },
      performedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return operations.map((op) => ({
    id: op.id,
    type: op.type,
    amount: Number(op.amount),
    fundName: op.fund?.name ?? null,
    supplierName: op.supplier?.name ?? null,
    reason: op.reason,
    performedByName: `${op.performedBy.firstName} ${op.performedBy.lastName}`,
    createdAt: op.createdAt.toISOString(),
  }))
}
