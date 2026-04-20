/**
 * E2E: Banking Fees (FEE-01..05)
 *
 * Verifies banking fee configuration, reverse percentage calculation,
 * fee storage on payments, and fee aggregation in profit report and dashboard.
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
import { calcBankingFee } from "@/lib/money"

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
const uniq = () => `F-${Date.now()}-${++counter}`

async function createShift(storeId: string, userId: string, opts: { openingCash?: string } = {}) {
  return db.shift.create({
    data: {
      number: `SH-${uniq()}`,
      storeId,
      openedById: userId,
      status: "OPEN",
      openingCash: opts.openingCash ?? "0.00",
      openedAt: new Date(),
    },
  })
}

async function createSaleDirect(opts: {
  storeId: string
  sellerId: string
  shiftId: string
  totalAmount: string
  finalAmount: string
  items: Array<{
    productId?: string
    name: string
    quantity: number
    price: string
    costPrice: string
  }>
  payments: Array<{
    method: "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"
    amount: string
    feeAmount?: string
  }>
}) {
  const sale = await db.sale.create({
    data: {
      number: `S-${uniq()}`,
      storeId: opts.storeId,
      sellerId: opts.sellerId,
      shiftId: opts.shiftId,
      status: "COMPLETED",
      totalAmount: opts.totalAmount,
      discountAmount: "0",
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

  for (const p of opts.payments) {
    await db.payment.create({
      data: {
        saleId: sale.id,
        method: p.method,
        amount: p.amount,
        isExpense: false,
        feeAmount: p.feeAmount ?? null,
        shiftId: opts.shiftId,
        storeId: opts.storeId,
      },
    })
  }

  return sale
}

// ---- TESTS ----

describe("Banking Fees E2E", () => {
  beforeEach(() => {
    counter = 0
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  describe("FEE-01: Fee settings CRUD", () => {
    it("saveFeeSettings persists rates per store and getFeeSettings reads them back", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      const { saveFeeSettings, getFeeSettings } = await import("@/actions/fee-settings")

      await saveFeeSettings(store.id, [
        { method: "CASH", feeRate: "0" },
        { method: "CARD", feeRate: "0.02" },
        { method: "SBP", feeRate: "0.007" },
        { method: "TRANSFER", feeRate: "0.01" },
        { method: "CREDIT", feeRate: "0.03" },
      ])

      const settings = await getFeeSettings(store.id)

      const card = settings.find((s) => s.method === "CARD")
      const sbp = settings.find((s) => s.method === "SBP")
      const cash = settings.find((s) => s.method === "CASH")

      expect(Number(card!.feeRate)).toBe(0.02)
      expect(Number(sbp!.feeRate)).toBe(0.007)
      expect(Number(cash!.feeRate)).toBe(0)
    })

    it("getStoreFeeRates returns defaults for stores without config", async () => {
      const store = await createTestStore()

      const { getStoreFeeRates } = await import("@/actions/fee-settings")
      const rates = await getStoreFeeRates(store.id)

      expect(rates["CASH"]).toBe(0)
      expect(rates["CARD"]).toBe(0.02)
      expect(rates["SBP"]).toBe(0.007)
      expect(rates["TRANSFER"]).toBe(0.01)
      expect(rates["CREDIT"]).toBe(0.03)
    })
  })

  describe("FEE-02: Reverse percentage calculation", () => {
    it("calcBankingFee computes correct reverse percentage for CARD 2%", () => {
      const result = calcBankingFee(10000, 0.02)
      expect(Number(result.fee.toFixed(2))).toBe(204.08)
      expect(Number(result.total.toFixed(2))).toBe(10204.08)
    })

    it("calcBankingFee computes correct reverse percentage for SBP 0.7%", () => {
      const result = calcBankingFee(5000, 0.007)
      expect(Number(result.fee.toFixed(2))).toBe(35.25)
    })

    it("calcBankingFee returns zero for CASH (rate=0)", () => {
      const result = calcBankingFee(10000, 0)
      expect(Number(result.fee.toFixed(2))).toBe(0)
      expect(Number(result.total.toFixed(2))).toBe(10000)
    })

    it("calcBankingFee returns zero for zero amount", () => {
      const result = calcBankingFee(0, 0.02)
      expect(Number(result.fee.toFixed(2))).toBe(0)
    })
  })

  describe("FEE-04: Profit report banking fees", () => {
    it("getProfitReport includes sum of all feeAmount values", async () => {
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

      // Compute fees
      const cardFee = calcBankingFee(10000, 0.02)
      const sbpFee = calcBankingFee(5000, 0.007)

      // Sale with CARD payment + fee
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        totalAmount: "10000",
        finalAmount: "10000",
        items: [
          {
            name: "Item 1",
            quantity: 1,
            price: "10000",
            costPrice: "5000",
            productId: product.id,
          },
        ],
        payments: [
          {
            method: "CARD",
            amount: "10000",
            feeAmount: cardFee.fee.toFixed(2),
          },
        ],
      })

      // Sale with SBP payment + fee
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        totalAmount: "5000",
        finalAmount: "5000",
        items: [
          {
            name: "Item 2",
            quantity: 1,
            price: "5000",
            costPrice: "2500",
            productId: product.id,
          },
        ],
        payments: [
          {
            method: "SBP",
            amount: "5000",
            feeAmount: sbpFee.fee.toFixed(2),
          },
        ],
      })

      // Sale with CASH payment (no fee)
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        totalAmount: "3000",
        finalAmount: "3000",
        items: [
          {
            name: "Item 3",
            quantity: 1,
            price: "3000",
            costPrice: "1500",
            productId: product.id,
          },
        ],
        payments: [{ method: "CASH", amount: "3000" }],
      })

      const { getProfitReport } = await import("@/actions/reports")

      const today = new Date()
      const result = await getProfitReport({
        storeId: store.id,
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      })

      // revenue = 10000 + 5000 + 3000 = 18000
      expect(result.revenue).toBe(18000)
      // COGS = 5000 + 2500 + 1500 = 9000
      expect(result.cogs).toBe(9000)
      // bankingFees = cardFee + sbpFee
      const expectedFees = Number(cardFee.fee.toFixed(2)) + Number(sbpFee.fee.toFixed(2))
      expect(result.bankingFees).toBeCloseTo(expectedFees, 2)
      // netProfit = grossProfit - bankingFees - 0 (writeoffs) - 0 (tradeIn)
      expect(result.netProfit).toBeCloseTo(result.grossProfit - result.bankingFees, 2)
    })
  })

  describe("FEE-05: Dashboard gross vs net profit", () => {
    it("getDashboardData returns separate grossProfit and netProfit with banking fees", async () => {
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

      const cardFee = calcBankingFee(10000, 0.02)

      // CARD sale with fee
      await createSaleDirect({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        totalAmount: "10000",
        finalAmount: "10000",
        items: [
          {
            name: "Dashboard Item",
            quantity: 1,
            price: "10000",
            costPrice: "5000",
            productId: product.id,
          },
        ],
        payments: [
          {
            method: "CARD",
            amount: "10000",
            feeAmount: cardFee.fee.toFixed(2),
          },
        ],
      })

      const { getDashboardData } = await import("@/actions/dashboard")
      const data = await getDashboardData(store.id)

      // grossProfit = revenue(10000) - COGS(5000) = 5000
      expect(data.todayGrossProfit).toBe(5000)
      // bankingFees = 204.08
      expect(data.todayBankingFees).toBeCloseTo(Number(cardFee.fee.toFixed(2)), 2)
      // netProfit = grossProfit - bankingFees - tradeIn = 5000 - 204.08 - 0
      expect(data.todayNetProfit).toBeCloseTo(5000 - Number(cardFee.fee.toFixed(2)), 2)
      // grossMargin = 5000 / 10000 * 100 = 50%
      expect(data.todayGrossMargin).toBeCloseTo(50, 1)
    })
  })
})
