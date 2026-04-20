/**
 * E2E: Reports Correctness (REP-01..07)
 *
 * Verifies that financial reports produce correct numbers with:
 * - Status filtering: only COMPLETED sales in reports (REP-01, REP-02)
 * - Returns deducted from revenue (REP-03)
 * - Seller report returns deduction (REP-04)
 * - Inventory filtering: isActive + deletedAt (REP-05)
 * - Trade-in as expense (REP-06)
 * - Cash report per-shift breakdown + reconciliation (REP-07)
 *
 * All tests run on real PostgreSQL, schema-per-worker isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
} from "../helpers/fixtures"

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))

const mockSession = { user: { id: "", storeId: "", name: "Test Seller" } }
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession),
}))

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Helpers
let counter = 0
const uniq = () => `R-${Date.now()}-${++counter}`

async function createShift(
  storeId: string,
  userId: string,
  opts: {
    openingCash?: string
    status?: "OPEN" | "CLOSED"
    closingCash?: string
  } = {},
) {
  return db.shift.create({
    data: {
      number: `SH-${uniq()}`,
      storeId,
      openedById: userId,
      status: opts.status ?? "OPEN",
      openingCash: opts.openingCash ?? "0.00",
      openedAt: new Date(),
      closedAt: opts.status === "CLOSED" ? new Date() : null,
      closingCash: opts.closingCash ?? null,
    },
  })
}

async function createSaleDirect(opts: {
  storeId: string
  sellerId: string
  shiftId: string
  status: "COMPLETED" | "RETURNED" | "PARTIALLY_RETURNED"
  totalAmount: string
  finalAmount: string
  discountAmount?: string
  items: Array<{
    productId?: string
    name: string
    quantity: number
    price: string
    costPrice: string
  }>
  payments?: Array<{
    method: "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"
    amount: string
    isExpense?: boolean
    feeAmount?: string
  }>
}) {
  const sale = await db.sale.create({
    data: {
      number: `S-${uniq()}`,
      storeId: opts.storeId,
      sellerId: opts.sellerId,
      shiftId: opts.shiftId,
      status: opts.status,
      totalAmount: opts.totalAmount,
      discountAmount: opts.discountAmount ?? "0",
      finalAmount: opts.finalAmount,
      items: {
        create: opts.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          costPrice: it.costPrice,
          discount: "0",
          total: (Number(it.price) * it.quantity).toFixed(2),
        })),
      },
    },
  })

  // Create payments
  if (opts.payments) {
    for (const p of opts.payments) {
      await db.payment.create({
        data: {
          saleId: sale.id,
          method: p.method,
          amount: p.amount,
          isExpense: p.isExpense ?? false,
          feeAmount: p.feeAmount ?? null,
          shiftId: opts.shiftId,
          storeId: opts.storeId,
        },
      })
    }
  }

  return sale
}

async function createReturnDirect(opts: {
  saleId: string
  userId: string
  shiftId: string
  amount: string
}) {
  return db.return.create({
    data: {
      number: `RET-${uniq()}`,
      saleId: opts.saleId,
      userId: opts.userId,
      amount: opts.amount,
      reason: "Test return",
      refundMethod: "CASH",
      shiftId: opts.shiftId,
    },
  })
}

async function createCustomer() {
  return db.customer.create({
    data: {
      name: `Customer ${uniq()}`,
      phone: "+7 (999) 000-00-00",
    },
  })
}

// ---- TESTS ----

describe("Reports Correctness E2E", () => {
  beforeEach(() => {
    counter = 0
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  describe("REP-01 + REP-02: Status filtering", () => {
    it("getSalesReport excludes RETURNED and PARTIALLY_RETURNED sales", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id)
      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "10000",
        costPrice: "5000",
        quantity: 100,
      })

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // Sale A: COMPLETED, 10000
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "10000",
        finalAmount: "10000",
        items: [
          { name: "Item A1", quantity: 1, price: "7000", costPrice: "3000", productId: product.id },
        ],
        payments: [{ method: "CASH", amount: "10000" }],
      })

      // Sale B: COMPLETED, 5000
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "5000",
        finalAmount: "5000",
        items: [
          { name: "Item B1", quantity: 1, price: "5000", costPrice: "1500", productId: product.id },
        ],
        payments: [{ method: "CASH", amount: "5000" }],
      })

      // Sale C: RETURNED, 8000 (should be excluded)
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "RETURNED",
        totalAmount: "8000",
        finalAmount: "8000",
        items: [{ name: "Item C1", quantity: 1, price: "8000", costPrice: "4000" }],
      })

      // Sale D: PARTIALLY_RETURNED, 12000 (should be excluded)
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "PARTIALLY_RETURNED",
        totalAmount: "12000",
        finalAmount: "12000",
        items: [{ name: "Item D1", quantity: 1, price: "12000", costPrice: "6000" }],
      })

      const { getSalesReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getSalesReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      // Only 2 COMPLETED sales
      expect(result.salesCount).toBe(2)
      // 10000 + 5000 = 15000
      expect(result.netRevenue).toBe(15000)
    })

    it("getProfitReport excludes non-COMPLETED sales from revenue and COGS", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id)
      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "10000",
        costPrice: "3000",
        quantity: 100,
      })

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // COMPLETED sale: finalAmount=10000, COGS: 3000 + 2000 = 5000
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "10000",
        finalAmount: "10000",
        items: [
          { name: "Item 1", quantity: 1, price: "7000", costPrice: "3000", productId: product.id },
          { name: "Item 2", quantity: 1, price: "3000", costPrice: "2000", productId: product.id },
        ],
        payments: [{ method: "CASH", amount: "10000" }],
      })

      // COMPLETED sale: finalAmount=5000, COGS: 1500
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "5000",
        finalAmount: "5000",
        items: [
          { name: "Item 3", quantity: 1, price: "5000", costPrice: "1500", productId: product.id },
        ],
        payments: [{ method: "CASH", amount: "5000" }],
      })

      // RETURNED sale (should be excluded from everything)
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "RETURNED",
        totalAmount: "8000",
        finalAmount: "8000",
        items: [{ name: "Excluded item", quantity: 1, price: "8000", costPrice: "4000" }],
      })

      const { getProfitReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getProfitReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      expect(result.revenue).toBe(15000)
      expect(result.cogs).toBe(6500) // 3000 + 2000 + 1500
    })
  })

  describe("REP-03: Returns deduction from revenue", () => {
    it("getProfitReport deducts returns from adjusted revenue", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id)

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // Sale A: COMPLETED, 10000 (COGS: 3000+2000=5000)
      const saleA = await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "10000",
        finalAmount: "10000",
        items: [
          { name: "A1", quantity: 1, price: "7000", costPrice: "3000" },
          { name: "A2", quantity: 1, price: "3000", costPrice: "2000" },
        ],
        payments: [{ method: "CASH", amount: "10000" }],
      })

      // Sale B: COMPLETED, 5000 (COGS: 1500)
      const saleB = await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "5000",
        finalAmount: "5000",
        items: [{ name: "B1", quantity: 1, price: "5000", costPrice: "1500" }],
        payments: [{ method: "CASH", amount: "5000" }],
      })

      // Return for Sale A: 3000 (partial return)
      await createReturnDirect({
        saleId: saleA.id,
        userId: user.id,
        shiftId: shift.id,
        amount: "3000",
      })

      // Return for Sale B: 5000 (full return but sale still COMPLETED)
      await createReturnDirect({
        saleId: saleB.id,
        userId: user.id,
        shiftId: shift.id,
        amount: "5000",
      })

      const { getProfitReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getProfitReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      // revenue = 10000 + 5000 = 15000
      expect(result.revenue).toBe(15000)
      // returnsTotal = 3000 + 5000 = 8000
      expect(result.returnsTotal).toBe(8000)
      // adjustedRevenue = 15000 - 8000 = 7000
      expect(result.adjustedRevenue).toBe(7000)
      // COGS = 5000 + 1500 = 6500
      expect(result.cogs).toBe(6500)
      // grossProfit = 7000 - 6500 = 500
      expect(result.grossProfit).toBe(500)
    })
  })

  describe("REP-04: Seller report returns", () => {
    it("getSellerReport deducts returns from seller revenue", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id)

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // Sale: COMPLETED, 10000
      const sale = await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "10000",
        finalAmount: "10000",
        items: [{ name: "Item", quantity: 1, price: "10000", costPrice: "5000" }],
        payments: [{ method: "CASH", amount: "10000" }],
      })

      // Return: 3000
      await createReturnDirect({
        saleId: sale.id,
        userId: user.id,
        shiftId: shift.id,
        amount: "3000",
      })

      const { getSellerReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getSellerReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      expect(result.sellers).toHaveLength(1)
      // revenue = 10000 - 3000 = 7000
      expect(result.sellers[0].revenue).toBe(7000)
      expect(result.sellers[0].salesCount).toBe(1)
      // avgCheck = 7000 / 1 = 7000
      expect(result.sellers[0].avgCheck).toBe(7000)
      expect(result.sellers[0].returnsCount).toBe(1)
    })
  })

  describe("REP-05: Inventory filtering", () => {
    it("getInventoryReport excludes inactive and deleted products", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const category = await createTestCategory()

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // Active product
      const activeProduct = await createTestProduct({
        categoryId: category.id,
        name: "Active Product",
      })
      await createTestStoreProduct({
        productId: activeProduct.id,
        storeId: store.id,
        sellPrice: "1000",
        costPrice: "500",
        quantity: 10,
      })

      // Inactive product (isActive=false)
      const inactiveProduct = await db.product.create({
        data: {
          name: "Inactive Product",
          sku: `SKU-INACTIVE-${uniq()}`,
          categoryId: category.id,
          isActive: false,
        },
      })
      await createTestStoreProduct({
        productId: inactiveProduct.id,
        storeId: store.id,
        sellPrice: "2000",
        costPrice: "1000",
        quantity: 5,
      })

      // Deleted product (deletedAt set)
      const deletedProduct = await db.product.create({
        data: {
          name: "Deleted Product",
          sku: `SKU-DELETED-${uniq()}`,
          categoryId: category.id,
          isActive: true,
          deletedAt: new Date(),
        },
      })
      await createTestStoreProduct({
        productId: deletedProduct.id,
        storeId: store.id,
        sellPrice: "3000",
        costPrice: "1500",
        quantity: 3,
      })

      const { getInventoryReport } = await import("@/actions/reports")
      const result = await getInventoryReport({ storeId: store.id })

      // Only the active product should be counted
      expect(result.totalItems).toBe(10)
      expect(result.totalSellValue).toBe(10000) // 10 * 1000
      expect(result.totalCostValue).toBe(5000) // 10 * 500
    })
  })

  describe("REP-06: Trade-in expenses", () => {
    it("getProfitReport includes trade-in expenses", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id)
      const customer = await createCustomer()

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // COMPLETED sale: finalAmount=10000, COGS: 5000
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "10000",
        finalAmount: "10000",
        items: [{ name: "Item", quantity: 1, price: "10000", costPrice: "5000" }],
        payments: [{ method: "CASH", amount: "10000" }],
      })

      // Trade-in with agreedPrice=2000, status=IN_STOCK (not PENDING)
      await db.tradeIn.create({
        data: {
          number: `TI-${uniq()}`,
          type: "TRADE_IN",
          status: "IN_STOCK",
          storeId: store.id,
          acceptedById: user.id,
          customerId: customer.id,
          deviceType: "Smartphone",
          deviceCondition: "Good",
          estimatedPrice: "2500",
          agreedPrice: "2000",
        },
      })

      const { getProfitReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getProfitReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      // revenue=10000, cogs=5000, grossProfit=5000
      expect(result.revenue).toBe(10000)
      expect(result.cogs).toBe(5000)
      expect(result.tradeInExpenses).toBe(2000)
      // netProfit = 5000 - 0 (writeoffs) - 0 (bankingFees) - 2000 (tradeIn) = 3000
      expect(result.netProfit).toBe(3000)
    })
  })

  describe("REP-07: Cash report", () => {
    it("getCashReport returns correct shift breakdown with method totals", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id, {
        openingCash: "5000",
        status: "CLOSED",
        closingCash: "12000",
      })

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // Create sale with CASH payment
      const sale1 = await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "8000",
        finalAmount: "8000",
        items: [{ name: "Item 1", quantity: 1, price: "8000", costPrice: "4000" }],
        payments: [{ method: "CASH", amount: "8000" }],
      })

      // Create sale with CARD payment
      const sale2 = await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "3000",
        finalAmount: "3000",
        items: [{ name: "Item 2", quantity: 1, price: "3000", costPrice: "1500" }],
        payments: [{ method: "CARD", amount: "3000" }],
      })

      // Cash deposit
      await db.cashOperation.create({
        data: {
          shiftId: shift.id,
          type: "DEPOSIT",
          amount: "1000",
          reason: "Morning deposit",
          performedById: user.id,
        },
      })

      // Cash withdrawal
      await db.cashOperation.create({
        data: {
          shiftId: shift.id,
          type: "WITHDRAW",
          amount: "500",
          reason: "Expense",
          performedById: user.id,
        },
      })

      const { getCashReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getCashReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      expect(result.shifts).toHaveLength(1)

      const shiftData = result.shifts[0]
      const cashMethod = shiftData.methods.find((m: { method: string }) => m.method === "CASH")
      const cardMethod = shiftData.methods.find((m: { method: string }) => m.method === "CARD")

      // CASH: inflow=8000, outflow=0
      expect(cashMethod!.inflow).toBe(8000)
      expect(cashMethod!.outflow).toBe(0)
      expect(cashMethod!.txCount).toBe(1)

      // CARD: inflow=3000, outflow=0
      expect(cardMethod!.inflow).toBe(3000)
      expect(cardMethod!.outflow).toBe(0)
      expect(cardMethod!.txCount).toBe(1)
    })

    it("getCashReport reconciliation matches shift data", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createShift(store.id, user.id, {
        openingCash: "5000",
        status: "CLOSED",
        closingCash: "13500",
      })

      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      // CASH sale: 8000
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        status: "COMPLETED",
        totalAmount: "8000",
        finalAmount: "8000",
        items: [{ name: "Item", quantity: 1, price: "8000", costPrice: "4000" }],
        payments: [{ method: "CASH", amount: "8000" }],
      })

      // Deposit: 1000
      await db.cashOperation.create({
        data: {
          shiftId: shift.id,
          type: "DEPOSIT",
          amount: "1000",
          reason: "Deposit",
          performedById: user.id,
        },
      })

      // Withdrawal: 500
      await db.cashOperation.create({
        data: {
          shiftId: shift.id,
          type: "WITHDRAW",
          amount: "500",
          reason: "Withdraw",
          performedById: user.id,
        },
      })

      const { getCashReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getCashReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      const recon = result.shifts[0].reconciliation
      // expectedCash = openingCash(5000) + cashInflow(8000) - cashOutflow(0) + deposits(1000) - withdrawals(500) = 13500
      expect(recon.openingCash).toBe(5000)
      expect(recon.expectedCash).toBe(13500)
      expect(recon.actualCash).toBe(13500)
      expect(recon.discrepancy).toBe(0)
      expect(recon.cashDeposits).toBe(1000)
      expect(recon.cashWithdrawals).toBe(500)
    })
  })
})
