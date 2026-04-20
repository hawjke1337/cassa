/**
 * E2E: precision proof для motivation-calculation.ts.
 *
 * Мотивационные расчёты используют `rate × sellPrice × quantity` — критичная
 * точка накопления float-погрешности на многих продажах (BUG-078).
 *
 * Тесты создают N Sale records и проверяют что calculateEarnings возвращает
 * ровно ожидаемую сумму бонусов (без drift).
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
import { mul, toMoney } from "@/lib/money"
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

async function seedBase(sellPrice = "1499.99", costPrice = "999.50") {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory()
  const product = await createTestProduct({ categoryId: category.id })
  await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice,
    costPrice,
    quantity: 100000,
  })
  await db.shift.create({
    data: {
      number: `SH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      storeId: store.id,
      openedById: user.id,
      openingCash: "0.00",
    },
  })

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  return { store, user, product }
}

function makeFormula(rate: number): MotivationFormula {
  return {
    dailyRate: 0,
    commissionRules: [],
    defaultCommission: { type: "PERCENT", rate, basis: "RETAIL_PRICE" },
    crossSellBonuses: [],
    repairBonus: 0,
  }
}

describe("E2E: motivation-calculation precision", () => {
  beforeEach(() => {
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  it("100 продаж × (1499.99 × 0.5%) = ровно 749.995", async () => {
    const { store, user, product } = await seedBase("1499.99", "999.50")

    const { createSale } = await import("@/actions/sales")
    for (let i = 0; i < 100; i++) {
      await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1499.99 }],
      })
    }

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.005),
    )

    // Expected: 100 × 1499.99 × 0.005 = 749.995
    const expected = mul(mul("1499.99", 100), "0.005")
    expect(toMoney(result.totals.commissions)).toEqualDecimal(expected)
  }, 60_000)

  it("rate 0.0033 × 50 продаж — precise без drift", async () => {
    const { store, user, product } = await seedBase("1000.00", "500.00")

    const { createSale } = await import("@/actions/sales")
    for (let i = 0; i < 50; i++) {
      await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })
    }

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      0,
      makeFormula(0.0033),
    )

    // Expected: 50 × 1000 × 0.0033 = 165.00
    const expected = mul(mul("1000", 50), "0.0033")
    expect(toMoney(result.totals.commissions)).toEqualDecimal(expected)
  }, 60_000)

  it("dailyRate fixed + empty sales: точная сумма daily × shiftsCount", async () => {
    const { store, user } = await seedBase()

    const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
    const periodStart = new Date(Date.now() - 86_400_000)
    const periodEnd = new Date(Date.now() + 86_400_000)

    const formula: MotivationFormula = {
      dailyRate: 1499.99,
      commissionRules: [],
      defaultCommission: { type: "PERCENT", rate: 0, basis: "RETAIL_PRICE" },
      crossSellBonuses: [],
      repairBonus: 0,
    }

    const result = await calculateEarningsWithFormula(
      user.id,
      store.id,
      periodStart,
      periodEnd,
      7, // 7 shifts
      formula,
    )

    // 7 × 1499.99 = 10499.93
    expect(toMoney(result.totals.daily)).toEqualDecimal("10499.93")
  })
})
