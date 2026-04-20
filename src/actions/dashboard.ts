"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkPermission } from "@/lib/permissions"
import { Prisma } from "@/generated/prisma/client"
import { mskToday } from "@/lib/timezone"

export async function getDashboardData(storeId: string) {
  const session = await auth()
  if (!session?.user) throw new Error("Не авторизован")

  // MSK timezone boundaries for "today" and "yesterday"
  const todayRange = mskToday()
  const today = todayRange.gte
  const endOfDay = todayRange.lte

  // Yesterday = shift today's MSK boundaries back by 24 hours
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const endOfYesterday = new Date(endOfDay.getTime() - 24 * 60 * 60 * 1000)

  // 1. Today's sales
  const todaySales = await db.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: today, lte: endOfDay },
      status: "COMPLETED",
    },
    select: { finalAmount: true },
  })

  const todayCount = todaySales.length
  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.finalAmount), 0)
  const todayAvgCheck = todayCount > 0 ? todayRevenue / todayCount : 0

  // 2. Yesterday's sales (for comparison)
  const yesterdaySales = await db.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: yesterday, lte: endOfYesterday },
      status: "COMPLETED",
    },
    select: { finalAmount: true },
  })

  const yesterdayCount = yesterdaySales.length
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + Number(s.finalAmount), 0)
  const yesterdayAvgCheck = yesterdayCount > 0 ? yesterdayRevenue / yesterdayCount : 0

  // Percentage changes (null if yesterday was 0)
  const salesCountChange =
    yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : null
  const revenueChange =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : null
  const avgCheckChange =
    yesterdayAvgCheck > 0
      ? Math.round(((todayAvgCheck - yesterdayAvgCheck) / yesterdayAvgCheck) * 100)
      : null

  // 2b. Today's profit (COGS from SaleItem)
  const cogsRaw = await db.$queryRaw<[{ cogs: Prisma.Decimal }]>(Prisma.sql`
    SELECT COALESCE(SUM(si."costPrice" * si."quantity"), 0) AS cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON s."id" = si."saleId"
    WHERE s."createdAt" >= ${today}
      AND s."createdAt" <= ${endOfDay}
      AND s."storeId" = ${storeId}
      AND s."status" = 'COMPLETED'
  `)
  const todayCogs = Number(cogsRaw[0]?.cogs ?? 0)

  // 2c. Returns deduction (REP-03)
  const returnsRaw = await db.$queryRaw<[{ total: Prisma.Decimal }]>(Prisma.sql`
    SELECT COALESCE(SUM(r."amount"), 0) AS total
    FROM "Return" r
    JOIN "Sale" s ON s."id" = r."saleId"
    WHERE s."createdAt" >= ${today}
      AND s."createdAt" <= ${endOfDay}
      AND s."storeId" = ${storeId}
      AND s."status" = 'COMPLETED'
  `)
  const todayReturns = Number(returnsRaw[0]?.total ?? 0)

  // 2d. Banking fees (FEE-05)
  const feesRaw = await db.$queryRaw<[{ total: Prisma.Decimal }]>(Prisma.sql`
    SELECT COALESCE(SUM(p."feeAmount"), 0) AS total
    FROM "Payment" p
    JOIN "Sale" s ON s."id" = p."saleId"
    WHERE s."createdAt" >= ${today}
      AND s."createdAt" <= ${endOfDay}
      AND s."storeId" = ${storeId}
      AND s."status" = 'COMPLETED'
      AND p."isExpense" = false
  `)
  const todayBankingFees = Number(feesRaw[0]?.total ?? 0)

  // 2e. Trade-in expenses (REP-06)
  const tradeInRaw = await db.$queryRaw<[{ total: Prisma.Decimal }]>(Prisma.sql`
    SELECT COALESCE(SUM(ti."agreedPrice"), 0) AS total
    FROM "TradeIn" ti
    WHERE ti."createdAt" >= ${today}
      AND ti."createdAt" <= ${endOfDay}
      AND ti."storeId" = ${storeId}
      AND ti."status" != 'PENDING'
  `)
  const todayTradeInExpenses = Number(tradeInRaw[0]?.total ?? 0)

  // 2f. Compute gross and net profit
  const todayAdjustedRevenue = todayRevenue - todayReturns
  const todayGrossProfit = todayAdjustedRevenue - todayCogs
  const todayGrossMargin =
    todayAdjustedRevenue > 0 ? (todayGrossProfit / todayAdjustedRevenue) * 100 : 0
  const todayNetProfit = todayGrossProfit - todayBankingFees - todayTradeInExpenses

  // Backward compat aliases (consumed by dashboard-content.tsx)
  const todayProfit = todayGrossProfit
  const todayMargin = todayGrossMargin

  // 3. Active repairs
  const activeRepairsCount = await db.repair.count({
    where: {
      storeId,
      status: { in: ["RECEIVED", "DIAGNOSING", "WAITING_APPROVAL", "APPROVED", "IN_PROGRESS"] },
    },
  })

  const readyRepairsCount = await db.repair.count({
    where: {
      storeId,
      status: { in: ["COMPLETED", "READY_FOR_PICKUP"] },
    },
  })

  // 4. Active custom orders
  const activeOrdersCount = await db.customOrder.count({
    where: {
      storeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  })

  // 4. Low stock count (quantity > 0 AND quantity <= minQty)
  // Exclude serialized products (their StoreProduct.quantity is always 0)
  const [{ count: lowStockRaw }] = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "StoreProduct" sp
    JOIN "Product" p ON p."id" = sp."productId"
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE sp."storeId" = ${storeId}
    AND c."isSerialized" = false
    AND sp."quantity" > 0
    AND sp."minQty" > 0
    AND sp."quantity" <= sp."minQty"
  `
  const lowStock = Number(lowStockRaw)

  // 5. Out of stock count (quantity = 0, product isActive)
  // For non-serialized: quantity = 0
  // For serialized: no IN_STOCK serial units
  const nonSerializedOos = await db.storeProduct.count({
    where: {
      storeId,
      quantity: 0,
      product: { isActive: true, category: { isSerialized: false } },
    },
  })
  const [{ count: serializedOosRaw }] = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "StoreProduct" sp
    JOIN "Product" p ON p."id" = sp."productId"
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE sp."storeId" = ${storeId}
    AND p."isActive" = true
    AND c."isSerialized" = true
    AND NOT EXISTS (
      SELECT 1 FROM "SerialUnit" su
      WHERE su."productId" = p."id" AND su."storeId" = sp."storeId" AND su."status" = 'IN_STOCK'
    )
  `
  const outOfStockCount = nonSerializedOos + Number(serializedOosRaw)

  // 6. Recent sales (last 5)
  const recentSales = await db.sale.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      number: true,
      createdAt: true,
      finalAmount: true,
      seller: { select: { firstName: true, lastName: true } },
    },
  })

  // 7. Recent custom orders (last 5)
  const recentOrders = await db.customOrder.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      number: true,
      clientName: true,
      status: true,
      totalAmount: true,
      createdAt: true,
    },
  })

  // 8. Supplier debts aggregate (SUP-08) — only for users with orders.costs
  const canSeeCosts = await checkPermission("orders.costs", storeId)
  let supplierDebtsTotal = 0
  let supplierDebtsCount = 0
  if (canSeeCosts) {
    const supplierDebts = await db.supplierDebt.aggregate({
      where: { isPaid: false, order: { storeId } },
      _sum: { amount: true },
      _count: true,
    })
    supplierDebtsTotal = Number(supplierDebts._sum.amount ?? 0)
    supplierDebtsCount = supplierDebts._count
  }

  // 9. Pending actions
  const incomingTransfers = await db.stockTransfer.count({
    where: { toStoreId: storeId, status: "IN_TRANSIT" },
  })

  const draftReceives = await db.stockReceive.count({
    where: { storeId, status: "DRAFT" },
  })

  const arrivedOrders = await db.customOrder.count({
    where: { storeId, status: "ARRIVED" },
  })

  return {
    activeRepairsCount,
    readyRepairsCount,
    sales: {
      todayCount,
      todayRevenue,
      todayAvgCheck,
      salesCountChange,
      revenueChange,
      avgCheckChange,
    },
    profit: +todayProfit.toFixed(2),
    margin: +todayMargin.toFixed(1),
    todayGrossProfit: +todayGrossProfit.toFixed(2),
    todayGrossMargin: +todayGrossMargin.toFixed(1),
    todayNetProfit: +todayNetProfit.toFixed(2),
    todayBankingFees: +todayBankingFees.toFixed(2),
    todayTradeInExpenses: +todayTradeInExpenses.toFixed(2),
    todayReturns: +todayReturns.toFixed(2),
    activeOrdersCount,
    stock: {
      lowStock,
      outOfStock: outOfStockCount,
    },
    recentSales: recentSales.map((s) => ({
      id: s.id,
      number: s.number,
      createdAt: s.createdAt.toISOString(),
      finalAmount: Number(s.finalAmount),
      sellerName: `${s.seller.firstName} ${s.seller.lastName}`,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      clientName: o.clientName,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
    })),
    pendingActions: {
      incomingTransfers,
      draftReceives,
      arrivedOrders,
    },
    supplierDebtsTotal,
    supplierDebtsCount,
  }
}
