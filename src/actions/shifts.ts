"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber, type PrismaTx } from "@/lib/counters"
import { Prisma } from "@/generated/prisma/client"
import { sum, sub, toMoney } from "@/lib/money"
import { mskStartOfDay, mskEndOfDay } from "@/lib/timezone"

/**
 * Вычисляет ожидаемую сумму наличных в кассе на конец смены.
 *
 * Формула (precision-safe через money.ts helpers):
 *   expectedCash = openingCash
 *                + cashIncome  (CASH payments, non-expense)
 *                + deposits    (cash operations DEPOSIT)
 *                − cashExpenses (CASH payments, isExpense)
 *                − withdrawals  (cash operations WITHDRAW)
 *                − cashRefunds  (returns refunded by CASH)
 *
 * Возвращает `Prisma.Decimal` вместо number — вызывающий код сохраняет
 * результат в `Shift.expectedCash` (Decimal(12,2)) напрямую.
 */
export async function calculateExpectedCash(
  shiftId: string,
  openingCash: Prisma.Decimal | number | string,
  tx: PrismaTx,
): Promise<Prisma.Decimal> {
  const cashIncome = await tx.payment.aggregate({
    where: { shiftId, method: "CASH", isExpense: false },
    _sum: { amount: true },
  })
  const cashExpenses = await tx.payment.aggregate({
    where: { shiftId, method: "CASH", isExpense: true },
    _sum: { amount: true },
  })
  const deposits = await tx.cashOperation.aggregate({
    where: { shiftId, type: "DEPOSIT" },
    _sum: { amount: true },
  })
  const withdrawals = await tx.cashOperation.aggregate({
    where: { shiftId, type: "WITHDRAW" },
    _sum: { amount: true },
  })
  const cashRefunds = await tx.return.aggregate({
    where: { shiftId, refundMethod: "CASH" },
    _sum: { amount: true },
  })

  const positives = sum(openingCash, cashIncome._sum.amount ?? 0, deposits._sum.amount ?? 0)
  const negatives = sum(
    cashExpenses._sum.amount ?? 0,
    withdrawals._sum.amount ?? 0,
    cashRefunds._sum.amount ?? 0,
  )
  return sub(positives, negatives)
}

export async function getCurrentShift(storeId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  await requirePermission("shifts.view", storeId)

  const shift = await db.shift.findFirst({
    where: { storeId, status: "OPEN" },
    include: {
      openedBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!shift) return null

  return {
    id: shift.id,
    number: shift.number,
    openedAt: shift.openedAt.toISOString(),
    openingCash: shift.openingCash.toNumber(),
    openedByName: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
  }
}

export async function openShift(data: { storeId: string; openingCash: number }) {
  await requirePermission("shifts.open", data.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const result = await db.$transaction(async (tx) => {
    const number = await getNextNumber("SH", tx)

    // Auto-close any open shift for this store
    const existingOpen = await tx.shift.findFirst({
      where: { storeId: data.storeId, status: "OPEN" },
    })

    let hadPreviousOpen = false
    if (existingOpen) {
      const expectedCash = await calculateExpectedCash(
        existingOpen.id,
        existingOpen.openingCash,
        tx,
      )
      await tx.shift.update({
        where: { id: existingOpen.id },
        data: {
          status: "AUTO_CLOSED",
          closedAt: new Date(),
          closedById: session.user!.id,
          expectedCash,
          discrepancy: null, // нет actualCash при авто-закрытии
        },
      })
      hadPreviousOpen = true
    }

    // Create new shift
    const shift = await tx.shift.create({
      data: {
        number,
        storeId: data.storeId,
        openedById: session.user!.id,
        openingCash: data.openingCash,
      },
    })

    return { id: shift.id, number: shift.number, hadPreviousOpen }
  })

  return result
}

export async function getShiftSummary(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findUnique({
    where: { id: shiftId },
  })
  if (!shift) throw new Error("Смена не найдена")

  // Permission check
  const canViewAll = await checkPermission("shifts.view_all", shift.storeId)
  const canView = await checkPermission("shifts.view", shift.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")
  if (!canViewAll && shift.openedById !== session.user.id) {
    throw new Error("Нет доступа к этой смене")
  }

  const [
    cashIncome,
    cashExpenses,
    deposits,
    withdrawals,
    cashRefunds,
    paymentsByMethod,
    salesCount,
    returnsAgg,
  ] = await Promise.all([
    db.payment.aggregate({
      where: { shiftId, method: "CASH", isExpense: false },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { shiftId, method: "CASH", isExpense: true },
      _sum: { amount: true },
    }),
    db.cashOperation.aggregate({
      where: { shiftId, type: "DEPOSIT" },
      _sum: { amount: true },
    }),
    db.cashOperation.aggregate({
      where: { shiftId, type: "WITHDRAW" },
      _sum: { amount: true },
    }),
    db.return.aggregate({
      where: { shiftId, refundMethod: "CASH" },
      _sum: { amount: true },
    }),
    db.payment.groupBy({
      by: ["method"],
      where: { shiftId, isExpense: false },
      _sum: { amount: true },
    }),
    db.sale.count({ where: { shiftId } }),
    db.return.aggregate({
      where: { shiftId },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  // Precision-safe формула через Decimal helpers.
  const positives = sum(shift.openingCash, cashIncome._sum.amount ?? 0, deposits._sum.amount ?? 0)
  const negatives = sum(
    cashExpenses._sum.amount ?? 0,
    withdrawals._sum.amount ?? 0,
    cashRefunds._sum.amount ?? 0,
  )
  const expectedCashDec = sub(positives, negatives)

  return {
    openingCash: shift.openingCash.toNumber(),
    cashIncome: toMoney(cashIncome._sum.amount ?? 0).toNumber(),
    cashExpenses: toMoney(cashExpenses._sum.amount ?? 0).toNumber(),
    deposits: toMoney(deposits._sum.amount ?? 0).toNumber(),
    withdrawals: toMoney(withdrawals._sum.amount ?? 0).toNumber(),
    cashRefunds: toMoney(cashRefunds._sum.amount ?? 0).toNumber(),
    expectedCash: expectedCashDec.toNumber(),
    salesCount,
    returnsCount: returnsAgg._count,
    returnsTotal: toMoney(returnsAgg._sum.amount ?? 0).toNumber(),
    paymentsByMethod: paymentsByMethod.map((p) => ({
      method: p.method,
      total: toMoney(p._sum.amount ?? 0).toNumber(),
    })),
  }
}

export async function closeShift(data: { shiftId: string; closingCash: number; note?: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Fetch shift first to get storeId for permission check
  const shiftCheck = await db.shift.findUnique({ where: { id: data.shiftId } })
  if (!shiftCheck) throw new Error("Смена не найдена")
  await requirePermission("shifts.close", shiftCheck.storeId)

  const result = await db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: data.shiftId } })
    if (!shift) throw new Error("Смена не найдена")
    if (shift.status !== "OPEN") throw new Error("Смена уже закрыта")

    // Calculate expectedCash using shared function (DRY) — Decimal-safe.
    const expectedCash = await calculateExpectedCash(data.shiftId, shift.openingCash, tx)

    // discrepancy = closingCash − expectedCash (Decimal)
    const discrepancy = sub(data.closingCash, expectedCash)

    // SEC2-07: Large discrepancy requires shifts.override_discrepancy permission
    const DISCREPANCY_THRESHOLD = 1000 // rub
    if (Math.abs(discrepancy.toNumber()) > DISCREPANCY_THRESHOLD) {
      const canOverride = await checkPermission("shifts.override_discrepancy", shift.storeId)
      if (!canOverride) {
        throw new Error(
          `Расхождение ${Math.abs(discrepancy.toNumber())} руб. превышает допустимое (${DISCREPANCY_THRESHOLD} руб.). Требуется подтверждение старшего.`,
        )
      }
    }

    if (!discrepancy.equals(0) && !data.note?.trim()) {
      throw new Error("При расхождении необходимо указать комментарий")
    }

    return tx.shift.update({
      where: { id: data.shiftId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: session.user!.id,
        closingCash: data.closingCash,
        expectedCash,
        discrepancy,
        note: data.note?.trim() || null,
      },
    })
  })

  return { id: result.id, number: result.number }
}

export async function getShifts(params: {
  storeId: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  perPage?: number
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const canViewAll = await checkPermission("shifts.view_all", params.storeId)
  const canView = await checkPermission("shifts.view", params.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")

  const page = params.page ?? 1
  const perPage = params.perPage ?? 20

  const where: Record<string, unknown> = {
    storeId: params.storeId,
  }

  // If user can only view own shifts
  if (!canViewAll) {
    where.openedById = session.user.id
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status
  }

  if (params.dateFrom || params.dateTo) {
    where.openedAt = {
      ...(params.dateFrom && { gte: mskStartOfDay(new Date(params.dateFrom)) }),
      ...(params.dateTo && { lte: mskEndOfDay(new Date(params.dateTo)) }),
    }
  }

  const [shifts, total] = await Promise.all([
    db.shift.findMany({
      where,
      include: {
        openedBy: { select: { firstName: true, lastName: true } },
        closedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.shift.count({ where }),
  ])

  return {
    shifts: shifts.map((s) => ({
      id: s.id,
      number: s.number,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openedByName: `${s.openedBy.firstName} ${s.openedBy.lastName}`,
      closedByName: s.closedBy ? `${s.closedBy.firstName} ${s.closedBy.lastName}` : null,
      openingCash: s.openingCash.toNumber(),
      closingCash: s.closingCash ? s.closingCash.toNumber() : null,
      expectedCash: s.expectedCash ? s.expectedCash.toNumber() : null,
      discrepancy: s.discrepancy ? s.discrepancy.toNumber() : null,
    })),
    total,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function getShift(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: {
      store: { select: { id: true, name: true } },
      openedBy: { select: { firstName: true, lastName: true } },
      closedBy: { select: { firstName: true, lastName: true } },
      sales: {
        select: {
          id: true,
          number: true,
          finalAmount: true,
          createdAt: true,
          payments: { select: { method: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      returns: {
        select: {
          id: true,
          number: true,
          amount: true,
          refundMethod: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      cashOperations: {
        include: {
          fund: { select: { name: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!shift) throw new Error("Смена не найдена")

  // Permission check — user must have view or view_all
  const canViewAll = await checkPermission("shifts.view_all", shift.storeId)
  const canView = await checkPermission("shifts.view", shift.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")
  if (!canViewAll && shift.openedById !== session.user.id) {
    throw new Error("Нет доступа к этой смене")
  }

  return {
    id: shift.id,
    number: shift.number,
    status: shift.status,
    storeId: shift.store.id,
    storeName: shift.store.name,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openedByName: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
    closedByName: shift.closedBy ? `${shift.closedBy.firstName} ${shift.closedBy.lastName}` : null,
    openingCash: shift.openingCash.toNumber(),
    closingCash: shift.closingCash ? shift.closingCash.toNumber() : null,
    expectedCash: shift.expectedCash ? shift.expectedCash.toNumber() : null,
    discrepancy: shift.discrepancy ? shift.discrepancy.toNumber() : null,
    note: shift.note,
    sales: shift.sales.map((s) => ({
      id: s.id,
      number: s.number,
      amount: s.finalAmount.toNumber(),
      createdAt: s.createdAt.toISOString(),
      payments: s.payments.map((p) => ({
        method: p.method,
        amount: p.amount.toNumber(),
      })),
    })),
    returns: shift.returns.map((r) => ({
      id: r.id,
      number: r.number,
      amount: r.amount.toNumber(),
      refundMethod: r.refundMethod,
      createdAt: r.createdAt.toISOString(),
    })),
    cashOperations: shift.cashOperations.map((co) => ({
      id: co.id,
      type: co.type,
      amount: co.amount.toNumber(),
      fundName: co.fund?.name ?? null,
      reason: co.reason,
      performedByName: `${co.performedBy.firstName} ${co.performedBy.lastName}`,
      createdAt: co.createdAt.toISOString(),
    })),
  }
}

export async function checkOpenShift(storeId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  await requirePermission("shifts.view", storeId)

  const shift = await db.shift.findFirst({
    where: { storeId, status: "OPEN" },
    select: { id: true, number: true, openedAt: true },
  })
  return shift
    ? {
        id: shift.id,
        number: shift.number,
        openedAt: shift.openedAt.toISOString(),
      }
    : null
}
