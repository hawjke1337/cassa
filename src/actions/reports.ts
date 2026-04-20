"use server"

import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getSerializedCounts } from "@/lib/stock-helpers"
import { toMskDateRange, mskStartOfDay, mskEndOfDay } from "@/lib/timezone"

type Decimal = Prisma.Decimal

// ---- Sales Report (SQL-optimized) ----

export async function getSalesReport(params: {
  storeId?: string
  dateFrom: string
  dateTo: string
  groupBy?: "day" | "month"
}) {
  if (params.storeId) {
    await requirePermission("reports.sales", params.storeId)
  } else {
    await requirePermission("reports.full")
  }

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const range = toMskDateRange(new Date(params.dateFrom), new Date(params.dateTo))
  const dateFrom = range.gte
  const dateTo = range.lte

  const where = {
    status: "COMPLETED" as const,
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(params.storeId ? { storeId: params.storeId } : {}),
  }

  const salePaymentWhere = {
    sale: { is: where },
  }

  // 1. Summary via aggregate (no findMany)
  const summary = await db.sale.aggregate({
    where,
    _count: true,
    _sum: {
      totalAmount: true,
      discountAmount: true,
      finalAmount: true,
    },
  })

  const salesCount = summary._count
  const totalRevenue = Number(summary._sum.totalAmount ?? 0)
  const totalDiscount = Number(summary._sum.discountAmount ?? 0)
  const netRevenue = Number(summary._sum.finalAmount ?? 0)
  const avgCheck = salesCount > 0 ? netRevenue / salesCount : 0

  // 2. Chart data via $queryRaw (group by day/month)
  const groupBy = params.groupBy || "day"
  const truncUnit = groupBy === "day" ? "day" : "month"
  const storeFilter = params.storeId
    ? Prisma.sql`AND s."storeId" = ${params.storeId}`
    : Prisma.empty

  const chartRaw = await db.$queryRaw<
    Array<{ label: string; count: bigint; revenue: Decimal }>
  >(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${Prisma.raw(`'${truncUnit}'`)}, s."createdAt"), ${Prisma.raw(groupBy === "day" ? "'YYYY-MM-DD'" : "'YYYY-MM'")}) AS label,
      COUNT(*)::bigint AS count,
      COALESCE(SUM(s."finalAmount"), 0) AS revenue
    FROM "Sale" s
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
    GROUP BY DATE_TRUNC(${Prisma.raw(`'${truncUnit}'`)}, s."createdAt")
    ORDER BY DATE_TRUNC(${Prisma.raw(`'${truncUnit}'`)}, s."createdAt") ASC
  `)

  const chartData = chartRaw.map((r) => ({
    label: r.label,
    count: Number(r.count),
    revenue: +Number(r.revenue).toFixed(2),
  }))

  // 3. Payment breakdown via groupBy
  const paymentRaw = await db.payment.groupBy({
    by: ["method"],
    where: salePaymentWhere,
    _sum: { amount: true },
  })

  const paymentData = paymentRaw.map((r) => ({
    method: r.method,
    amount: +Number(r._sum.amount ?? 0).toFixed(2),
  }))

  // 4. Top 10 products by quantity via $queryRaw
  const topByQty = await db.$queryRaw<
    Array<{ name: string; sku: string; quantity: bigint; revenue: Decimal }>
  >(Prisma.sql`
    SELECT
      COALESCE(p."name", si."name") AS name,
      COALESCE(p."sku", '') AS sku,
      SUM(si."quantity")::bigint AS quantity,
      COALESCE(SUM(si."total"), 0) AS revenue
    FROM "SaleItem" si
    JOIN "Sale" s ON s."id" = si."saleId"
    LEFT JOIN "Product" p ON p."id" = si."productId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
    GROUP BY COALESCE(p."id", si."id"), COALESCE(p."name", si."name"), COALESCE(p."sku", '')
    ORDER BY SUM(si."quantity") DESC
    LIMIT 10
  `)

  // 5. Top 10 products by revenue via $queryRaw
  const topByRevenue = await db.$queryRaw<
    Array<{ name: string; sku: string; quantity: bigint; revenue: Decimal }>
  >(Prisma.sql`
    SELECT
      COALESCE(p."name", si."name") AS name,
      COALESCE(p."sku", '') AS sku,
      SUM(si."quantity")::bigint AS quantity,
      COALESCE(SUM(si."total"), 0) AS revenue
    FROM "SaleItem" si
    JOIN "Sale" s ON s."id" = si."saleId"
    LEFT JOIN "Product" p ON p."id" = si."productId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
    GROUP BY COALESCE(p."id", si."id"), COALESCE(p."name", si."name"), COALESCE(p."sku", '')
    ORDER BY SUM(si."total") DESC
    LIMIT 10
  `)

  return {
    salesCount,
    totalRevenue: +totalRevenue.toFixed(2),
    totalDiscount: +totalDiscount.toFixed(2),
    netRevenue: +netRevenue.toFixed(2),
    avgCheck: +avgCheck.toFixed(2),
    chartData,
    paymentData,
    topByQty: topByQty.map((r) => ({
      name: r.name,
      sku: r.sku,
      quantity: Number(r.quantity),
      revenue: +Number(r.revenue).toFixed(2),
    })),
    topByRevenue: topByRevenue.map((r) => ({
      name: r.name,
      sku: r.sku,
      quantity: Number(r.quantity),
      revenue: +Number(r.revenue).toFixed(2),
    })),
  }
}

// ---- Profit Report (SQL-optimized) ----

export async function getProfitReport(params: {
  storeId?: string
  dateFrom: string
  dateTo: string
}) {
  if (params.storeId) {
    await requirePermission("reports.profit", params.storeId)
  } else {
    await requirePermission("reports.full")
  }

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const range = toMskDateRange(new Date(params.dateFrom), new Date(params.dateTo))
  const dateFrom = range.gte
  const dateTo = range.lte

  const storeFilter = params.storeId
    ? Prisma.sql`AND s."storeId" = ${params.storeId}`
    : Prisma.empty

  const storeFilterWO = params.storeId
    ? Prisma.sql`AND wo."storeId" = ${params.storeId}`
    : Prisma.empty

  // 1. Revenue via aggregate (only COMPLETED sales)
  const saleSummary = await db.sale.aggregate({
    where: {
      status: "COMPLETED" as const,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
    _sum: { finalAmount: true },
  })

  const revenue = Number(saleSummary._sum.finalAmount ?? 0)

  // 2. COGS via $queryRaw (SUM of costPrice * quantity for sold items)
  const cogsRaw = await db.$queryRaw<Array<{ cogs: Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(si."costPrice" * si."quantity"), 0) AS cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON s."id" = si."saleId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
  `)

  const cogs = Number(cogsRaw[0]?.cogs ?? 0)

  // 3. Returns deduction (REP-03)
  const returnsRaw = await db.$queryRaw<Array<{ total: Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(r."amount"), 0) AS total
    FROM "Return" r
    JOIN "Sale" s ON s."id" = r."saleId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
  `)
  const returnsTotal = Number(returnsRaw[0]?.total ?? 0)

  // 4. Trade-in expenses (REP-06)
  const storeFilterTI = params.storeId
    ? Prisma.sql`AND ti."storeId" = ${params.storeId}`
    : Prisma.empty
  const tradeInRaw = await db.$queryRaw<Array<{ total: Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(ti."agreedPrice"), 0) AS total
    FROM "TradeIn" ti
    WHERE ti."createdAt" >= ${dateFrom}
      AND ti."createdAt" <= ${dateTo}
      AND ti."status" != 'PENDING'
      ${storeFilterTI}
  `)
  const tradeInExpenses = Number(tradeInRaw[0]?.total ?? 0)

  // 5. Banking fees (FEE-04)
  const bankingFeesRaw = await db.$queryRaw<Array<{ total: Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(p."feeAmount"), 0) AS total
    FROM "Payment" p
    JOIN "Sale" s ON s."id" = p."saleId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      AND p."isExpense" = false
      ${storeFilter}
  `)
  const bankingFees = Number(bankingFeesRaw[0]?.total ?? 0)

  // 6. Category breakdown via $queryRaw
  const categoryRaw = await db.$queryRaw<
    Array<{ name: string; revenue: Decimal; cogs: Decimal }>
  >(Prisma.sql`
    SELECT
      COALESCE(c."name", 'Без категории') AS name,
      COALESCE(SUM(si."total"), 0) AS revenue,
      COALESCE(SUM(si."costPrice" * si."quantity"), 0) AS cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON s."id" = si."saleId"
    LEFT JOIN "Product" p ON p."id" = si."productId"
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    WHERE s."createdAt" >= ${dateFrom}
      AND s."createdAt" <= ${dateTo}
      AND s."status" = 'COMPLETED'
      ${storeFilter}
    GROUP BY COALESCE(c."id", '_no_category'), COALESCE(c."name", 'Без категории')
    ORDER BY SUM(si."total") DESC
  `)

  // 7. Write-offs total via $queryRaw
  const writeOffsRaw = await db.$queryRaw<Array<{ total: Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(woi."costPrice" * woi."quantity"), 0) AS total
    FROM "StockWriteOffItem" woi
    JOIN "StockWriteOff" wo ON wo."id" = woi."writeOffId"
    WHERE wo."createdAt" >= ${dateFrom}
      AND wo."createdAt" <= ${dateTo}
      ${storeFilterWO}
  `)

  const writeOffsTotal = Number(writeOffsRaw[0]?.total ?? 0)

  const adjustedRevenue = revenue - returnsTotal
  const grossProfit = adjustedRevenue - cogs
  const grossMargin = adjustedRevenue > 0 ? (grossProfit / adjustedRevenue) * 100 : 0
  const netProfit = grossProfit - writeOffsTotal - bankingFees - tradeInExpenses

  const categoryBreakdown = categoryRaw.map((c) => {
    const catRevenue = Number(c.revenue)
    const catCogs = Number(c.cogs)
    const profit = catRevenue - catCogs
    const margin = catRevenue > 0 ? (profit / catRevenue) * 100 : 0
    return {
      name: c.name,
      revenue: +catRevenue.toFixed(2),
      cogs: +catCogs.toFixed(2),
      profit: +profit.toFixed(2),
      margin: +margin.toFixed(1),
    }
  })

  return {
    revenue: +revenue.toFixed(2),
    returnsTotal: +returnsTotal.toFixed(2),
    adjustedRevenue: +adjustedRevenue.toFixed(2),
    cogs: +cogs.toFixed(2),
    grossProfit: +grossProfit.toFixed(2),
    grossMargin: +grossMargin.toFixed(1),
    writeOffsTotal: +writeOffsTotal.toFixed(2),
    bankingFees: +bankingFees.toFixed(2),
    tradeInExpenses: +tradeInExpenses.toFixed(2),
    netProfit: +netProfit.toFixed(2),
    categoryBreakdown,
  }
}

// ---- Inventory Report ----

export async function getInventoryReport(params: { storeId: string }) {
  await requirePermission("reports.inventory", params.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const storeProducts = await db.storeProduct.findMany({
    where: {
      storeId: params.storeId,
      product: { isActive: true, deletedAt: null },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: { select: { id: true, name: true, isSerialized: true } },
        },
      },
    },
  })

  // Get serial unit counts for serialized products
  const serializedIds = storeProducts
    .filter((sp) => sp.product.category.isSerialized)
    .map((sp) => sp.product.id)
  const serialCounts = await getSerializedCounts(params.storeId, serializedIds)

  let totalItems = 0
  let totalSellValue = 0
  let totalCostValue = 0

  const lowStock: Array<{
    name: string
    sku: string
    category: string
    quantity: number
    minQty: number
  }> = []

  const outOfStock: Array<{
    name: string
    sku: string
    category: string
  }> = []

  const categoryValueMap: Record<
    string,
    { name: string; sellValue: number; costValue: number; count: number }
  > = {}

  for (const sp of storeProducts) {
    const isSerialized = sp.product.category.isSerialized
    const qty = isSerialized ? (serialCounts[sp.product.id] ?? 0) : sp.quantity
    const sell = Number(sp.sellPrice)
    const cost = Number(sp.costPrice)

    totalItems += qty
    totalSellValue += qty * sell
    totalCostValue += qty * cost

    const catId = sp.product.category.id
    const catName = sp.product.category.name
    if (!categoryValueMap[catId]) {
      categoryValueMap[catId] = { name: catName, sellValue: 0, costValue: 0, count: 0 }
    }
    categoryValueMap[catId].sellValue += qty * sell
    categoryValueMap[catId].costValue += qty * cost
    categoryValueMap[catId].count += qty

    if (qty === 0) {
      outOfStock.push({
        name: sp.product.name,
        sku: sp.product.sku,
        category: catName,
      })
    } else if (sp.minQty > 0 && qty <= sp.minQty) {
      lowStock.push({
        name: sp.product.name,
        sku: sp.product.sku,
        category: catName,
        quantity: qty,
        minQty: sp.minQty,
      })
    }
  }

  const topCategories = Object.values(categoryValueMap)
    .sort((a, b) => b.costValue - a.costValue)
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      sellValue: +c.sellValue.toFixed(2),
      costValue: +c.costValue.toFixed(2),
      count: c.count,
    }))

  return {
    totalItems,
    totalSellValue: +totalSellValue.toFixed(2),
    totalCostValue: +totalCostValue.toFixed(2),
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStock: lowStock.sort((a, b) => a.quantity - b.quantity),
    outOfStock,
    topCategories,
  }
}

// ---- Seller Report ----

export async function getSellerReport(params: {
  storeId?: string
  dateFrom: string
  dateTo: string
}) {
  if (params.storeId) {
    await requirePermission("reports.sales", params.storeId)
  } else {
    await requirePermission("reports.full")
  }

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const range = toMskDateRange(new Date(params.dateFrom), new Date(params.dateTo))
  const dateFrom = range.gte
  const dateTo = range.lte

  const storeFilter = params.storeId ? { storeId: params.storeId } : {}

  const sales = await db.sale.findMany({
    where: {
      status: "COMPLETED" as const,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...storeFilter,
    },
    include: {
      seller: { select: { id: true, firstName: true, lastName: true } },
      returns: true,
    },
  })

  const sellerMap: Record<
    string,
    { name: string; salesCount: number; revenue: number; returnsCount: number }
  > = {}

  for (const sale of sales) {
    const sid = sale.sellerId
    if (!sellerMap[sid]) {
      sellerMap[sid] = {
        name: `${sale.seller.firstName} ${sale.seller.lastName}`,
        salesCount: 0,
        revenue: 0,
        returnsCount: 0,
      }
    }
    sellerMap[sid].salesCount++
    sellerMap[sid].revenue += Number(sale.finalAmount)
    // REP-04: Deduct returns from seller revenue
    for (const ret of sale.returns) {
      sellerMap[sid].revenue -= Number(ret.amount)
    }
    sellerMap[sid].returnsCount += sale.returns.length
  }

  const sellers = Object.values(sellerMap)
    .map((s) => ({
      name: s.name,
      salesCount: s.salesCount,
      revenue: +s.revenue.toFixed(2),
      avgCheck: +(s.revenue / s.salesCount).toFixed(2),
      returnsCount: s.returnsCount,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return { sellers }
}

// ---- Helper: check if user has financial permission ----

export async function hasFinancialAccess() {
  return checkPermission("reports.profit")
}

// ---- Fund Report ----

export async function getFundReport(params: {
  storeId?: string
  dateFrom: string
  dateTo: string
}) {
  if (params.storeId) {
    await requirePermission("shifts.view_all", params.storeId)
  } else {
    await requirePermission("reports.full")
  }

  const fundRange = toMskDateRange(new Date(params.dateFrom), new Date(params.dateTo))
  const where: Record<string, unknown> = {
    createdAt: {
      gte: fundRange.gte,
      lte: fundRange.lte,
    },
  }

  if (params.storeId) {
    where.shift = { storeId: params.storeId }
  }

  const operations = await db.cashOperation.findMany({
    where,
    include: {
      fund: { select: { id: true, name: true, storeId: true } },
      shift: { select: { store: { select: { name: true } } } },
    },
  })

  // Group by fund + store
  const fundMap = new Map<
    string,
    {
      fundName: string
      storeName: string
      deposits: number
      withdrawals: number
      count: number
    }
  >()

  for (const op of operations) {
    const fundKey = op.fundId ?? "no-fund"
    const storeKey = op.shift?.store.name ?? "Без магазина"
    const key = `${fundKey}::${storeKey}`
    const existing = fundMap.get(key) ?? {
      fundName: op.fund?.name ?? "Без фонда",
      storeName: storeKey,
      deposits: 0,
      withdrawals: 0,
      count: 0,
    }

    if (op.type === "DEPOSIT") {
      existing.deposits += Number(op.amount)
    } else {
      existing.withdrawals += Number(op.amount)
    }
    existing.count++
    fundMap.set(key, existing)
  }

  return Array.from(fundMap.values()).map((row) => ({
    ...row,
    deposits: +row.deposits.toFixed(2),
    withdrawals: +row.withdrawals.toFixed(2),
  }))
}

// ---- Cash Report (REP-07) ----

export async function getCashReport(params: { storeId: string; dateFrom: string; dateTo: string }) {
  await requirePermission("shifts.view_all", params.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const range = toMskDateRange(new Date(params.dateFrom), new Date(params.dateTo))
  const dateFrom = range.gte
  const dateTo = range.lte

  // 1. Get all shifts in period for this store
  const shifts = await db.shift.findMany({
    where: {
      storeId: params.storeId,
      openedAt: { lte: dateTo },
      OR: [
        { closedAt: { gte: dateFrom } },
        { closedAt: null }, // still open
      ],
    },
    include: {
      openedBy: { select: { firstName: true, lastName: true } },
      closedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { openedAt: "asc" },
  })

  if (shifts.length === 0) {
    return { shifts: [], totals: null }
  }

  const shiftIds = shifts.map((s) => s.id)

  // 2. Get all payments grouped by shift + method
  const paymentBreakdown = await db.$queryRaw<
    Array<{
      shiftId: string
      method: string
      txCount: bigint
      inflow: Decimal
      outflow: Decimal
    }>
  >(Prisma.sql`
    SELECT
      p."shiftId",
      p."method",
      COUNT(*)::bigint AS "txCount",
      COALESCE(SUM(CASE WHEN p."isExpense" = false THEN p."amount" ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN p."isExpense" = true THEN p."amount" ELSE 0 END), 0) AS outflow
    FROM "Payment" p
    WHERE p."shiftId" = ANY(${shiftIds})
    GROUP BY p."shiftId", p."method"
    ORDER BY p."shiftId", p."method"
  `)

  // 3. Get cash operations (DEPOSIT/WITHDRAW) per shift
  const cashOps = await db.$queryRaw<
    Array<{
      shiftId: string
      type: string
      total: Decimal
    }>
  >(Prisma.sql`
    SELECT
      co."shiftId",
      co."type",
      COALESCE(SUM(co."amount"), 0) AS total
    FROM "CashOperation" co
    WHERE co."shiftId" = ANY(${shiftIds})
    GROUP BY co."shiftId", co."type"
  `)

  // 4. Assemble per-shift data
  const METHODS = ["CASH", "CARD", "SBP", "TRANSFER", "CREDIT"] as const
  const shiftData = shifts.map((shift) => {
    const shiftPayments = paymentBreakdown.filter((p) => p.shiftId === shift.id)
    const shiftCashOps = cashOps.filter((co) => co.shiftId === shift.id)

    const methods = METHODS.map((method) => {
      const entry = shiftPayments.find((p) => p.method === method)
      return {
        method,
        txCount: entry ? Number(entry.txCount) : 0,
        inflow: entry ? +Number(entry.inflow).toFixed(2) : 0,
        outflow: entry ? +Number(entry.outflow).toFixed(2) : 0,
        net: entry ? +(Number(entry.inflow) - Number(entry.outflow)).toFixed(2) : 0,
      }
    })

    const cashDeposits = Number(shiftCashOps.find((co) => co.type === "DEPOSIT")?.total ?? 0)
    const cashWithdrawals = Number(shiftCashOps.find((co) => co.type === "WITHDRAW")?.total ?? 0)

    const cashInflow = methods.find((m) => m.method === "CASH")?.inflow ?? 0
    const cashOutflow = methods.find((m) => m.method === "CASH")?.outflow ?? 0

    const expectedCash =
      Number(shift.openingCash) + cashInflow - cashOutflow + cashDeposits - cashWithdrawals
    const actualCash = shift.closingCash ? Number(shift.closingCash) : null
    const discrepancy = actualCash !== null ? +(actualCash - expectedCash).toFixed(2) : null

    return {
      shiftId: shift.id,
      shiftNumber: shift.number,
      cashierName: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      status: shift.status,
      methods,
      reconciliation: {
        openingCash: +Number(shift.openingCash).toFixed(2),
        expectedCash: +expectedCash.toFixed(2),
        actualCash: actualCash !== null ? +actualCash.toFixed(2) : null,
        discrepancy: discrepancy !== null ? +discrepancy.toFixed(2) : null,
        cashDeposits: +cashDeposits.toFixed(2),
        cashWithdrawals: +cashWithdrawals.toFixed(2),
      },
    }
  })

  // 5. Period totals
  const totals = {
    methods: METHODS.map((method) => {
      const methodShifts = shiftData.flatMap((s) => s.methods.filter((m) => m.method === method))
      return {
        method,
        txCount: methodShifts.reduce((sum, m) => sum + m.txCount, 0),
        inflow: +methodShifts.reduce((sum, m) => sum + m.inflow, 0).toFixed(2),
        outflow: +methodShifts.reduce((sum, m) => sum + m.outflow, 0).toFixed(2),
        net: +methodShifts.reduce((sum, m) => sum + m.net, 0).toFixed(2),
      }
    }),
    totalDiscrepancy: +shiftData
      .reduce((sum, s) => sum + (s.reconciliation.discrepancy ?? 0), 0)
      .toFixed(2),
  }

  return { shifts: shiftData, totals }
}

// ---- Supplier Debts Report ----

export async function getSupplierDebtsReport(params: {
  storeId: string
  supplierId?: string
  isPaid?: boolean
  dateFrom?: string
  dateTo?: string
}) {
  await requirePermission("orders.costs", params.storeId)

  const where: {
    order: { storeId: string }
    supplierId?: string
    isPaid?: boolean
    createdAt?: { gte?: Date; lte?: Date }
  } = {
    order: { storeId: params.storeId },
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    ...(params.isPaid !== undefined ? { isPaid: params.isPaid } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: mskStartOfDay(new Date(params.dateFrom)) } : {}),
            ...(params.dateTo ? { lte: mskEndOfDay(new Date(params.dateTo)) } : {}),
          },
        }
      : {}),
  }

  const [debts, unpaidTotals, paidTotals] = await Promise.all([
    db.supplierDebt.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        order: {
          select: {
            number: true,
            totalAmount: true,
            purchasePrice: true,
            deliveryCost: true,
          },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.supplierDebt.aggregate({
      where: { ...where, isPaid: false },
      _sum: { amount: true },
      _count: true,
    }),
    db.supplierDebt.aggregate({
      where: { ...where, isPaid: true },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return {
    debts: debts.map((d) => {
      const totalPaid = d.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      return {
        id: d.id,
        supplierName: d.supplier.name,
        orderNumber: d.order.number,
        amount: Number(d.amount),
        totalPaid: +totalPaid.toFixed(2),
        isPaid: d.isPaid,
        paidAt: d.paidAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        comment: d.comment,
      }
    }),
    totalUnpaid: Number(unpaidTotals._sum.amount ?? 0),
    unpaidCount: unpaidTotals._count,
    totalPaid: Number(paidTotals._sum.amount ?? 0),
    paidCount: paidTotals._count,
  }
}
