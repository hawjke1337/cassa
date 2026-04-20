/**
 * E2E: PAYROLL-01 — per-item commission for order-based sales.
 *
 * Bug: orderItemCommissionDec uses whole-order netProfit for EVERY item,
 * inflating commission by N items. Fix: use itemCommissionDec (same as
 * regular sales) since SaleItem.costPrice is already populated from
 * CustomOrderItem.costPrice via completeOrder.
 *
 * Expected: commission = sum of (sellPrice_i - costPrice_i) * qty_i * rate
 * Bug gives: commission = N * calculateNetProfit(total, discount, purchasePrice, deliveryCost) * rate
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
import type { MotivationFormula } from "@/lib/validations/motivation"

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

function makeFormula(rate: number, basis: "PROFIT" | "RETAIL_PRICE" = "PROFIT"): MotivationFormula {
  return {
    dailyRate: 0,
    commissionRules: [],
    defaultCommission: { type: "PERCENT", rate, basis },
    crossSellBonuses: [],
    repairBonus: 0,
  }
}

async function seedOrderSale(opts: {
  items: Array<{ name: string; sellPrice: string; costPrice: string; quantity: number }>
  purchasePrice: string
  deliveryCost: string
}) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory()

  // Create products + store products for each item
  const productData: Array<{
    productId: string
    name: string
    sellPrice: string
    costPrice: string
    quantity: number
  }> = []
  for (const item of opts.items) {
    const product = await createTestProduct({ categoryId: category.id, name: item.name })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: item.sellPrice,
      costPrice: item.costPrice,
      quantity: 100,
    })
    productData.push({
      productId: product.id,
      name: item.name,
      sellPrice: item.sellPrice,
      costPrice: item.costPrice,
      quantity: item.quantity,
    })
  }

  // Create shift
  const shift = await db.shift.create({
    data: {
      number: `SH-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      storeId: store.id,
      openedById: user.id,
      openingCash: "0.00",
    },
  })

  // Create CustomOrder with purchasePrice and deliveryCost
  const totalAmount = opts.items
    .reduce((acc, it) => acc + Number(it.sellPrice) * it.quantity, 0)
    .toFixed(2)

  const order = await db.customOrder.create({
    data: {
      number: `O-${Date.now()}`,
      storeId: store.id,
      sellerId: user.id,
      status: "COMPLETED",
      clientName: "Test Client",
      clientPhone: "+7 (999) 111-11-11",
      totalAmount,
      prepaidAmount: "0",
      purchasePrice: opts.purchasePrice,
      deliveryCost: opts.deliveryCost,
      items: {
        create: productData.map((pd) => ({
          productId: pd.productId,
          name: pd.name,
          quantity: pd.quantity,
          price: pd.sellPrice,
          costPrice: pd.costPrice,
        })),
      },
    },
  })

  // Create Sale linked to CustomOrder, with SaleItem.costPrice from order items
  const sale = await db.sale.create({
    data: {
      number: `S-${Date.now()}`,
      storeId: store.id,
      sellerId: user.id,
      totalAmount,
      discountAmount: "0",
      finalAmount: totalAmount,
      shiftId: shift.id,
      customOrder: { connect: { id: order.id } },
      items: {
        create: productData.map((pd) => ({
          productId: pd.productId,
          name: pd.name,
          quantity: pd.quantity,
          price: pd.sellPrice,
          costPrice: pd.costPrice,
          discount: "0",
          total: (Number(pd.sellPrice) * pd.quantity).toFixed(2),
        })),
      },
    },
  })

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  return { store, user, sale, order, shift }
}

describe("PAYROLL-01: per-item commission for order-based sales", () => {
  beforeEach(() => {
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  it("3 items: commission = sum of per-item (sellPrice - costPrice) * qty * rate, not 3x netProfit * rate", async () => {
    // phone: sell=15000, cost=10000
    // case: sell=2000, cost=800
    // charger: sell=1500, cost=600
    // purchasePrice=11400 (sum of costPrices), deliveryCost=500, totalAmount=18500
    const { store, user } = await seedOrderSale({
      items: [
        { name: "Phone", sellPrice: "15000", costPrice: "10000", quantity: 1 },
        { name: "Case", sellPrice: "2000", costPrice: "800", quantity: 1 },
        { name: "Charger", sellPrice: "1500", costPrice: "600", quantity: 1 },
      ],
      purchasePrice: "11400",
      deliveryCost: "500",
    })

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.1, "PROFIT"),
    )

    // Expected per-item commissions:
    // phone: (15000 - 10000) * 1 * 0.1 = 500
    // case: (2000 - 800) * 1 * 0.1 = 120
    // charger: (1500 - 600) * 1 * 0.1 = 90
    // total = 710
    //
    // Bug gives: netProfit = 18500 - 0 - 11400 - 500 = 6600
    // each item gets 6600 * 0.1 = 660, total = 1980 (WRONG)
    expect(result.totals.commissions).toBe(710)

    // Verify individual item commissions
    expect(result.commissions).toHaveLength(1) // one sale
    const items = result.commissions[0].items
    expect(items).toHaveLength(3)

    // Sort by commission descending for stable assertions
    const sorted = [...items].sort((a, b) => b.commission - a.commission)
    expect(sorted[0].commission).toBeCloseTo(500, 2)
    expect(sorted[1].commission).toBeCloseTo(120, 2)
    expect(sorted[2].commission).toBeCloseTo(90, 2)
  }, 30_000)

  it("1 item: order commission matches itemCommissionDec(sellPrice, costPrice, qty, rate, PROFIT)", async () => {
    const { store, user } = await seedOrderSale({
      items: [{ name: "Laptop", sellPrice: "50000", costPrice: "35000", quantity: 1 }],
      purchasePrice: "35000",
      deliveryCost: "1000",
    })

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.1, "PROFIT"),
    )

    // Expected: (50000 - 35000) * 1 * 0.1 = 1500
    // Bug gives: netProfit = 50000 - 0 - 35000 - 1000 = 14000, commission = 14000 * 0.1 = 1400
    expect(result.totals.commissions).toBe(1500)
  }, 30_000)

  it("order item with costPrice=0 (null fallback): commission = sellPrice * qty * rate for PROFIT basis", async () => {
    const { store, user } = await seedOrderSale({
      items: [{ name: "Accessory", sellPrice: "3000", costPrice: "0", quantity: 2 }],
      purchasePrice: "0",
      deliveryCost: "0",
    })

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.1, "PROFIT"),
    )

    // costPrice=0, so profit = sellPrice - 0 = sellPrice
    // Expected: (3000 - 0) * 2 * 0.1 = 600
    expect(result.totals.commissions).toBe(600)
  }, 30_000)

  it("mixed regular sale + order sale in same period: totals are correct", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id, name: "Mixed Product" })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "10000",
      costPrice: "6000",
      quantity: 100,
    })

    const shift = await db.shift.create({
      data: {
        number: `SH-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        storeId: store.id,
        openedById: user.id,
        openingCash: "0.00",
      },
    })

    mockSession.user.id = user.id
    mockSession.user.storeId = store.id

    // 1. Regular sale (no order)
    const { createSale } = await import("@/actions/sales")
    await createSale({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, discount: 0 }],
      payments: [{ method: "CASH", amount: 10000 }],
    })

    // 2. Order-based sale
    const order = await db.customOrder.create({
      data: {
        number: `O-mix-${Date.now()}`,
        storeId: store.id,
        sellerId: user.id,
        status: "COMPLETED",
        clientName: "Mix Client",
        clientPhone: "+7 (999) 222-22-22",
        totalAmount: "10000",
        prepaidAmount: "0",
        purchasePrice: "7000",
        deliveryCost: "500",
        items: {
          create: [
            {
              productId: product.id,
              name: "Mixed Product",
              quantity: 1,
              price: "10000",
              costPrice: "7000",
            },
          ],
        },
      },
    })

    await db.sale.create({
      data: {
        number: `S-mix-${Date.now()}`,
        storeId: store.id,
        sellerId: user.id,
        totalAmount: "10000",
        discountAmount: "0",
        finalAmount: "10000",
        shiftId: shift.id,
        customOrder: { connect: { id: order.id } },
        items: {
          create: [
            {
              productId: product.id,
              name: "Mixed Product",
              quantity: 1,
              price: "10000",
              costPrice: "7000",
              discount: "0",
              total: "10000",
            },
          ],
        },
      },
    })

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.1, "PROFIT"),
    )

    // Regular sale: (10000 - 6000) * 1 * 0.1 = 400
    // Order sale: (10000 - 7000) * 1 * 0.1 = 300  (per-item, using SaleItem.costPrice=7000)
    // Bug gives order sale: netProfit = 10000 - 0 - 7000 - 500 = 2500, commission = 2500 * 0.1 = 250
    // Total expected: 400 + 300 = 700
    expect(result.totals.commissions).toBe(700)

    expect(result.commissions).toHaveLength(2) // two sales
  }, 30_000)
})
