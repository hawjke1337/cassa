"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import type { MotivationFormula } from "@/lib/validations/motivation"

import { Prisma } from "@/generated/prisma/client"
import { sum, sub, mul, toMoney } from "@/lib/money"

/**
 * Decimal-версия calculateItemCommission — precision-safe.
 * Заменяет helper из motivation-utils.ts (который принимал/возвращал number).
 */
function itemCommissionDec(
  sellPrice: Prisma.Decimal | number | string,
  costPrice: Prisma.Decimal | number | string,
  quantity: number,
  rate: number,
  basis: "PROFIT" | "RETAIL_PRICE",
  type: "PERCENT" | "FIXED" = "PERCENT",
): Prisma.Decimal {
  if (type === "FIXED") {
    return mul(rate, quantity)
  }
  if (basis === "PROFIT") {
    return mul(mul(sub(sellPrice, costPrice), quantity), rate)
  }
  return mul(mul(sellPrice, quantity), rate)
}

interface EarningsResult {
  dailyRate: { shiftsCount: number; ratePerShift: number; total: number }
  commissions: SaleCommission[]
  crossSellBonuses: CrossSellBonusResult[]
  repairBonuses: RepairBonusResult[]
  returnDeductions: ReturnDeduction[]
  totals: {
    daily: number
    commissions: number
    crossBonuses: number
    repairBonuses: number
    returns: number
    total: number
  }
}

interface SaleCommission {
  saleId: string
  saleNumber: string
  date: string
  shiftId: string | null
  shiftDate: string | null
  shiftNumber: string | null
  items: {
    productName: string
    groupCode: string | null
    sellPrice: number
    costPrice: number
    type: "PERCENT" | "FIXED"
    rate: number
    basis: "PROFIT" | "RETAIL_PRICE"
    commission: number
  }[]
  totalCommission: number
}

interface CrossSellBonusResult {
  saleId: string
  saleNumber: string
  itemCount: number
  bonus: number
}

interface RepairBonusResult {
  repairId: string
  repairNumber: string
  date: string
  bonus: number
}

interface ReturnDeduction {
  returnId: string
  saleNumber: string
  productName: string
  commission: number
}

async function getProductGroupMap(productIds: string[]) {
  const mappings = await db.motivationGroupProduct.findMany({
    where: { productId: { in: productIds } },
    include: { group: { select: { id: true, code: true } } },
  })

  const map = new Map<string, { groupId: string; groupCode: string }>()
  for (const m of mappings) {
    map.set(m.productId, { groupId: m.group.id, groupCode: m.group.code })
  }
  return map
}

function findCommissionRule(
  formula: MotivationFormula,
  groupId: string | undefined,
): { type: "PERCENT" | "FIXED"; rate: number; basis: "PROFIT" | "RETAIL_PRICE" } {
  if (groupId) {
    const rule = formula.commissionRules.find((r) => r.groupId === groupId)
    if (rule) return { type: rule.type ?? "PERCENT", rate: rule.rate, basis: rule.basis }
  }
  return {
    type: formula.defaultCommission.type ?? "PERCENT",
    rate: formula.defaultCommission.rate,
    basis: formula.defaultCommission.basis,
  }
}

// calculateItemCommission imported from @/lib/motivation-utils

function findCrossSellBonus(formula: MotivationFormula, itemCount: number): number {
  const sorted = [...formula.crossSellBonuses].sort((a, b) => b.minItems - a.minItems)
  for (const rule of sorted) {
    if (itemCount >= rule.minItems) return rule.bonus
  }
  return 0
}

export async function calculateEarnings(
  userId: string,
  storeId: string,
  periodStart: Date,
  periodEnd: Date,
  shiftsCount: number,
): Promise<EarningsResult | null> {
  const assignment = await db.motivationAssignment.findFirst({
    where: {
      userId,
      storeId,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      scheme: { status: "ACTIVE" },
    },
    include: { scheme: true },
  })

  if (!assignment) return null

  const formula = assignment.scheme.formula as unknown as MotivationFormula

  return calculateEarningsWithFormula(userId, storeId, periodStart, periodEnd, shiftsCount, formula)
}

export async function calculateEarningsWithFormula(
  userId: string,
  storeId: string,
  periodStart: Date,
  periodEnd: Date,
  shiftsCount: number,
  formula: MotivationFormula,
): Promise<EarningsResult> {
  const sales = await db.sale.findMany({
    where: {
      sellerId: userId,
      storeId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true } },
          returnItems: {
            include: {
              return_: { select: { id: true, createdAt: true } },
            },
          },
        },
      },
      returns: {
        include: {
          items: {
            include: {
              saleItem: {
                include: {
                  product: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      shift: { select: { id: true, number: true, openedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const allProductIds = new Set<string>()
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId) allProductIds.add(item.productId)
    }
  }

  const groupMap = await getProductGroupMap([...allProductIds])

  const returnedQuantityMap = new Map<string, number>()
  const returnDeductions: ReturnDeduction[] = []

  // 1. Returns nested in period sales
  for (const sale of sales) {
    for (const ret of sale.returns) {
      for (const retItem of ret.items) {
        const prev = returnedQuantityMap.get(retItem.saleItemId) ?? 0
        returnedQuantityMap.set(retItem.saleItemId, prev + retItem.quantity)

        const si = retItem.saleItem
        const productId = si.productId
        const group = productId ? groupMap.get(productId) : undefined
        const rule = findCommissionRule(formula, group?.groupId)
        const commissionDec = itemCommissionDec(
          si.price,
          si.costPrice,
          retItem.quantity,
          rule.rate,
          rule.basis,
          rule.type,
        )

        returnDeductions.push({
          returnId: ret.id,
          saleNumber: sale.number,
          productName: si.product?.name ?? si.name,
          commission: commissionDec.neg().toNumber(),
        })
      }
    }
  }

  // 2. Returns in this period for sales from OTHER periods (cross-period returns)
  const crossPeriodReturns = await db.return.findMany({
    where: {
      createdAt: { gte: periodStart, lte: periodEnd },
      sale: {
        sellerId: userId,
        storeId,
        createdAt: { lt: periodStart },
      },
    },
    include: {
      sale: { select: { number: true } },
      items: {
        include: {
          saleItem: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  // Collect only NEW product IDs from cross-period returns
  const newProductIds: string[] = []
  for (const ret of crossPeriodReturns) {
    for (const retItem of ret.items) {
      const productId = retItem.saleItem.productId
      if (productId && !groupMap.has(productId)) newProductIds.push(productId)
    }
  }

  if (newProductIds.length > 0) {
    const extra = await getProductGroupMap(newProductIds)
    extra.forEach((v, k) => groupMap.set(k, v))
  }

  for (const ret of crossPeriodReturns) {
    for (const retItem of ret.items) {
      const prev = returnedQuantityMap.get(retItem.saleItemId) ?? 0
      returnedQuantityMap.set(retItem.saleItemId, prev + retItem.quantity)

      const si = retItem.saleItem
      const productId = si.productId
      const group = productId ? groupMap.get(productId) : undefined
      const rule = findCommissionRule(formula, group?.groupId)
      const commissionDec = itemCommissionDec(
        si.price,
        si.costPrice,
        retItem.quantity,
        rule.rate,
        rule.basis,
      )

      returnDeductions.push({
        returnId: ret.id,
        saleNumber: ret.sale.number,
        productName: si.product?.name ?? si.name,
        commission: commissionDec.neg().toNumber(),
      })
    }
  }

  // Calculate commissions per sale
  const commissions: SaleCommission[] = []
  // Parallel Decimal накопитель per-sale totalCommission — для precision-safe
  // финальной агрегации без number round-trip.
  const commissionTotalsDec: Prisma.Decimal[] = []
  const crossSellBonuses: CrossSellBonusResult[] = []

  for (const sale of sales) {
    const saleItems = sale.items
      .map((item) => {
        const returnedQty = returnedQuantityMap.get(item.id) ?? 0
        const effectiveQty = item.quantity - returnedQty
        return { ...item, quantity: effectiveQty }
      })
      .filter((item) => item.quantity > 0)

    // Накопитель totalCommission через Decimal — precision-safe.
    const itemCommissionsDec: Prisma.Decimal[] = []

    const items = saleItems.map((item) => {
      const productId = item.productId
      const group = productId ? groupMap.get(productId) : undefined
      const rule = findCommissionRule(formula, group?.groupId)

      // Per-item commission for ALL sales (regular and order-based).
      // SaleItem.costPrice is already populated:
      //   - Regular sales: from StoreProduct.costPrice
      //   - Order sales: from CustomOrderItem.costPrice (via completeOrder)
      // PAYROLL-01: removed orderItemCommissionDec which used whole-order netProfit.
      const commissionDec = itemCommissionDec(
        item.price,
        item.costPrice,
        item.quantity,
        rule.rate,
        rule.basis,
        rule.type,
      )

      itemCommissionsDec.push(commissionDec)

      return {
        productName: item.product?.name ?? item.name,
        groupCode: group?.groupCode ?? null,
        sellPrice: item.price.toNumber(),
        costPrice: item.costPrice.toNumber(),
        type: rule.type,
        rate: rule.rate,
        basis: rule.basis,
        commission: commissionDec.toNumber(),
      }
    })

    if (items.length > 0) {
      const saleTotalDec = sum(...itemCommissionsDec)
      commissionTotalsDec.push(saleTotalDec)
      commissions.push({
        saleId: sale.id,
        saleNumber: sale.number,
        date: sale.createdAt.toISOString(),
        shiftId: sale.shiftId ?? null,
        shiftDate: sale.shift?.openedAt?.toISOString() ?? null,
        shiftNumber: sale.shift?.number ?? null,
        items,
        totalCommission: saleTotalDec.toNumber(),
      })
    }

    const remainingItemCount = saleItems.length
    if (remainingItemCount < 2) continue
    const crossBonus = findCrossSellBonus(formula, remainingItemCount)
    if (crossBonus > 0) {
      crossSellBonuses.push({
        saleId: sale.id,
        saleNumber: sale.number,
        itemCount: remainingItemCount,
        bonus: crossBonus,
      })
    }
  }

  // Fetch completed repairs (DELIVERED in period, user is master)
  // Repair model has no deliveredAt field, so we use RepairStatusHistory
  // to find when the repair was marked as DELIVERED
  const deliveredStatusEntries = await db.repairStatusHistory.findMany({
    where: {
      status: "DELIVERED",
      createdAt: { gte: periodStart, lte: periodEnd },
      repair: {
        masterId: userId,
      },
    },
    include: {
      repair: { select: { id: true, number: true } },
    },
  })

  // Deduplicate by repair ID (in case of multiple DELIVERED status entries)
  const uniqueRepairs = new Map<string, (typeof deliveredStatusEntries)[0]>()
  for (const entry of deliveredStatusEntries) {
    if (!uniqueRepairs.has(entry.repair.id)) {
      uniqueRepairs.set(entry.repair.id, entry)
    }
  }

  const repairBonuses: RepairBonusResult[] = [...uniqueRepairs.values()].map((entry) => ({
    repairId: entry.repair.id,
    repairNumber: entry.repair.number,
    date: entry.createdAt.toISOString(),
    bonus: formula.repairBonus,
  }))

  // Все totals — через Decimal, финальный .toNumber() только на возврате.
  const totalDailyDec = mul(shiftsCount, formula.dailyRate)
  const totalCommissionsDec = sum(...commissionTotalsDec)
  const totalCrossDec = sum(...crossSellBonuses.map((c) => toMoney(c.bonus)))
  const totalRepairsDec = sum(...repairBonuses.map((r) => toMoney(r.bonus)))
  const totalReturnsDec = sum(...returnDeductions.map((r) => toMoney(r.commission)))
  const grandTotalDec = sum(
    totalDailyDec,
    totalCommissionsDec,
    totalCrossDec,
    totalRepairsDec,
    totalReturnsDec,
  )

  return {
    dailyRate: {
      shiftsCount,
      ratePerShift: formula.dailyRate,
      total: totalDailyDec.toNumber(),
    },
    commissions,
    crossSellBonuses,
    repairBonuses,
    returnDeductions,
    totals: {
      daily: totalDailyDec.toNumber(),
      commissions: totalCommissionsDec.toNumber(),
      crossBonuses: totalCrossDec.toNumber(),
      repairBonuses: totalRepairsDec.toNumber(),
      returns: totalReturnsDec.toNumber(),
      total: grandTotalDec.toNumber(),
    },
  }
}

export async function getMyEarnings(storeId: string, periodStart: string, periodEnd: string) {
  await requirePermission("motivation.payroll.own")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  const existingPayroll = await db.payroll.findFirst({
    where: {
      userId: session.user.id,
      storeId,
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
    select: { shiftsCount: true },
  })
  const shiftsCount = existingPayroll?.shiftsCount ?? 0

  return calculateEarnings(session.user.id, storeId, start, end, shiftsCount)
}

export async function getStoreEarnings(storeId: string, periodStart: string, periodEnd: string) {
  await requirePermission("motivation.payroll.view")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  const assignments = await db.motivationAssignment.findMany({
    where: {
      storeId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
      scheme: { status: "ACTIVE" },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // BUILD-01: отбрасываем assignments с удалённым user (userId=null / user=null
  // через onDelete: SetNull) — удалённый сотрудник не должен попадать в расчёт.
  const withUser = assignments.filter((a) => a.user !== null && a.userId !== null)

  // Batch payroll lookups to avoid N+1
  const payrolls = await db.payroll.findMany({
    where: {
      storeId,
      userId: { in: withUser.map((a) => a.userId!) },
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
    select: { userId: true, shiftsCount: true },
  })
  const payrollMap = new Map(payrolls.map((p) => [p.userId, p.shiftsCount]))

  const results = await Promise.all(
    withUser.map(async (assignment) => {
      const earnings = await calculateEarnings(
        assignment.userId!,
        storeId,
        start,
        end,
        payrollMap.get(assignment.userId!) ?? 0,
      )

      if (!earnings) return null

      return {
        userId: assignment.user!.id,
        userName: `${assignment.user!.firstName} ${assignment.user!.lastName}`,
        ...earnings.totals,
        shiftsCount: earnings.dailyRate.shiftsCount,
      }
    }),
  )

  return results.filter((r) => r !== null)
}
