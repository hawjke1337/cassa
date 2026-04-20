"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { generatePayrollSchema } from "@/lib/validations/motivation"
import { calculateEarnings } from "@/actions/motivation-calculation"
import type { MotivationFormula } from "@/lib/validations/motivation"
import type { Prisma } from "@/generated/prisma/client"

export async function getPayrolls(storeId: string, periodStart: string, periodEnd: string) {
  await requirePermission("motivation.payroll.view")

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const payrolls = await db.payroll.findMany({
    where: {
      storeId,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      scheme: { select: { name: true } },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  })

  return payrolls.map((p) => ({
    id: p.id,
    userName: `${p.user.firstName} ${p.user.lastName}`,
    userId: p.user.id,
    schemeName: p.scheme.name,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    shiftsCount: p.shiftsCount,
    dailyTotal: Number(p.dailyTotal),
    commissions: Number(p.commissions),
    crossBonuses: Number(p.crossBonuses),
    repairBonuses: Number(p.repairBonuses),
    returns: Number(p.returns),
    totalAmount: Number(p.totalAmount),
    isAdvance: p.isAdvance,
    status: p.status,
    breakdown: p.breakdown,
    createdAt: p.createdAt.toISOString(),
  }))
}

export async function generatePayroll(data: unknown) {
  await requirePermission("motivation.payroll.manage")

  const validated = generatePayrollSchema.parse(data)

  // Check if DRAFT payroll already exists for this period
  const existing = await db.payroll.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      isAdvance: validated.isAdvance,
      status: "DRAFT",
    },
  })

  if (existing) {
    await db.payroll.delete({ where: { id: existing.id } })
  }

  // Check no CONFIRMED/PAID exists
  const confirmed = await db.payroll.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      isAdvance: validated.isAdvance,
      status: { in: ["CONFIRMED", "PAID"] },
    },
  })

  if (confirmed) {
    throw new Error("Расчёт за этот период уже подтверждён или выплачен")
  }

  // Auto-calculate shifts count from actual shift records
  let shiftsCount = validated.shiftsCount
  if (!shiftsCount || shiftsCount === 0) {
    shiftsCount = await db.shift.count({
      where: {
        openedById: validated.userId,
        storeId: validated.storeId,
        status: { in: ["CLOSED", "AUTO_CLOSED"] },
        openedAt: {
          gte: validated.periodStart,
          lte: validated.periodEnd,
        },
      },
    })
  }

  // Find assignment to get scheme and formula
  const assignment = await db.motivationAssignment.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: { lte: validated.periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: validated.periodStart } }],
      scheme: { status: "ACTIVE" },
    },
    include: { scheme: true },
  })

  if (!assignment) throw new Error("У сотрудника нет назначенной схемы мотивации на этот период")

  // For advance: only daily rate × shifts (no commissions)
  // For settlement: full calculation
  let earnings
  if (validated.isAdvance) {
    const formula = assignment.scheme.formula as unknown as MotivationFormula
    const dailyTotal = shiftsCount * formula.dailyRate
    earnings = {
      dailyRate: { shiftsCount: shiftsCount, ratePerShift: formula.dailyRate, total: dailyTotal },
      commissions: [],
      crossSellBonuses: [],
      repairBonuses: [],
      returnDeductions: [],
      totals: {
        daily: dailyTotal,
        commissions: 0,
        crossBonuses: 0,
        repairBonuses: 0,
        returns: 0,
        total: dailyTotal,
      },
    }
  } else {
    const result = await calculateEarnings(
      validated.userId,
      validated.storeId,
      validated.periodStart,
      validated.periodEnd,
      shiftsCount,
    )
    if (!result) throw new Error("Ошибка расчёта")
    earnings = result
  }

  // For month-end: subtract advance
  // Advance period (1st-15th) differs from settlement period (1st-31st),
  // so find any advance whose period falls WITHIN the settlement period
  let advanceAmount = 0
  if (!validated.isAdvance) {
    const advance = await db.payroll.findFirst({
      where: {
        userId: validated.userId,
        storeId: validated.storeId,
        periodStart: { gte: validated.periodStart },
        periodEnd: { lte: validated.periodEnd },
        isAdvance: true,
        status: { in: ["CONFIRMED", "PAID"] },
      },
    })
    if (advance) {
      advanceAmount = Number(advance.totalAmount)
    }
  }

  const totalAmount = earnings.totals.total - advanceAmount

  const payroll = await db.payroll.create({
    data: {
      userId: validated.userId,
      storeId: validated.storeId,
      schemeId: assignment.schemeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      shiftsCount: shiftsCount,
      dailyTotal: earnings.totals.daily,
      commissions: earnings.totals.commissions,
      crossBonuses: earnings.totals.crossBonuses,
      repairBonuses: earnings.totals.repairBonuses,
      returns: earnings.totals.returns,
      totalAmount,
      isAdvance: validated.isAdvance,
      status: "DRAFT",
      breakdown: {
        daily: earnings.dailyRate,
        commissions: earnings.commissions,
        crossSellBonuses: earnings.crossSellBonuses,
        repairBonuses: earnings.repairBonuses,
        returnDeductions: earnings.returnDeductions,
        advance: advanceAmount,
      } as unknown as Prisma.InputJsonValue,
    },
  })

  return { id: payroll.id }
}

export async function confirmPayroll(id: string) {
  await requirePermission("motivation.payroll.confirm")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "DRAFT") throw new Error("Можно подтвердить только черновик")

  await db.payroll.update({
    where: { id },
    data: { status: "CONFIRMED" },
  })
}

export async function markPayrollPaid(id: string) {
  await requirePermission("motivation.payroll.pay")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "CONFIRMED") throw new Error("Сначала подтвердите расчёт")

  await db.payroll.update({
    where: { id },
    data: { status: "PAID" },
  })
}

export async function deletePayroll(id: string) {
  await requirePermission("motivation.payroll.manage")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "DRAFT") throw new Error("Можно удалить только черновик")

  await db.payroll.delete({ where: { id } })
}

export async function getPayrollPdfData(payrollId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const permissions = session.user.permissions ?? []
  const canViewAll = permissions.includes("motivation.payroll.view")
  const canViewOwn = permissions.includes("motivation.payroll.own")

  if (!canViewAll && !canViewOwn) throw new Error("Нет доступа")

  const payroll = await db.payroll.findUnique({
    where: { id: payrollId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      store: { select: { name: true } },
    },
  })

  if (!payroll) throw new Error("Расчётный лист не найден")

  if (!canViewAll && payroll.userId !== session.user.id) {
    throw new Error("Нет доступа")
  }

  let advanceAmount: number | undefined
  if (!payroll.isAdvance) {
    const advance = await db.payroll.findFirst({
      where: {
        userId: payroll.userId,
        storeId: payroll.storeId,
        isAdvance: true,
        status: { in: ["CONFIRMED", "PAID"] },
        periodStart: { gte: payroll.periodStart },
        periodEnd: { lte: payroll.periodEnd },
      },
      select: { totalAmount: true },
    })
    if (advance) {
      advanceAmount = Number(advance.totalAmount)
    }
  }

  return {
    userName: `${payroll.user.firstName} ${payroll.user.lastName}`,
    storeName: payroll.store.name,
    periodStart: payroll.periodStart.toISOString(),
    periodEnd: payroll.periodEnd.toISOString(),
    isAdvance: payroll.isAdvance,
    totalAmount: Number(payroll.totalAmount),
    breakdown: payroll.breakdown,
    advanceAmount,
  }
}

export async function getMyPayrolls(storeId: string) {
  await requirePermission("motivation.payroll.own")
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const payrolls = await db.payroll.findMany({
    where: {
      userId: session.user.id,
      storeId,
    },
    include: {
      scheme: { select: { name: true } },
    },
    orderBy: { periodStart: "desc" },
  })

  return payrolls.map((p) => ({
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    isAdvance: p.isAdvance,
    shiftsCount: p.shiftsCount,
    dailyTotal: Number(p.dailyTotal),
    commissions: Number(p.commissions),
    crossBonuses: Number(p.crossBonuses),
    repairBonuses: Number(p.repairBonuses),
    returns: Number(p.returns),
    totalAmount: Number(p.totalAmount),
    status: p.status,
    schemeName: p.scheme.name,
    breakdown: p.breakdown,
    createdAt: p.createdAt.toISOString(),
  }))
}
