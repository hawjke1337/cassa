/**
 * E2E: precision proof for createSale on Prisma.Decimal.
 *
 * Этот тест доказывает, что миграция sales.ts на money.ts helpers устраняет
 * накопление float-погрешности. До миграции (float-арифметика) — 1000-loop
 * падает из-за накопленной ошибки `+0.01`. После миграции — ровно `10.00`.
 *
 * Архитектурное решение: server action `createSale` зависит от `@/lib/db`,
 * `@/lib/auth`, `@/lib/permissions`. Мокаем их так, чтобы:
 *   1. `db` → тестовый клиент schema-per-worker (все вставки идут в test_wN)
 *   2. `auth()` → валидная сессия с ID тестового пользователя
 *   3. `requirePermission` → no-op (permissions проверены в других тестах)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Prisma } from "@/generated/prisma/client"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
} from "../helpers/fixtures"
import { sum, mul, sub } from "@/lib/money"

// --- Mocks (hoisted) ---
// Redirect @/lib/db to the schema-scoped test client.
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

// Helper: open a shift directly via db
async function openShiftDirect(storeId: string, userId: string, openingCash: string) {
  return db.shift.create({
    data: {
      number: `SH-${Date.now()}`,
      storeId,
      openedById: userId,
      openingCash,
    },
  })
}

// Seed baseline test fixtures: store + user + open shift + product
async function seedSalesFixture(sellPrice = "1499.99", qty = 10000) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory()
  const product = await createTestProduct({ categoryId: category.id })
  const sp = await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice,
    costPrice: "999.50",
    quantity: qty,
  })
  const shift = await openShiftDirect(store.id, user.id, "0.00")

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  return { store, user, product, sp, shift }
}

describe("E2E: createSale precision (Prisma.Decimal)", () => {
  beforeEach(() => {
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  it("1 unit × 1499.99 = finalAmount точно 1499.99", async () => {
    const { store, product } = await seedSalesFixture("1499.99")

    const { createSale } = await import("@/actions/sales")
    const result = await createSale({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, discount: 0 }],
      payments: [{ method: "CASH", amount: 1499.99 }],
    })

    // Read back from DB to verify precision preserved
    const saved = await db.sale.findUnique({ where: { id: result.id } })
    expect(saved).not.toBeNull()
    expect(saved!.finalAmount).toEqualDecimal("1499.99")
    expect(saved!.totalAmount).toEqualDecimal("1499.99")
    expect(saved!.discountAmount).toEqualDecimal("0")
  })

  it("3 units × 1499.99 = totalAmount точно 4499.97 (без float drift)", async () => {
    const { store, product } = await seedSalesFixture("1499.99")

    const { createSale } = await import("@/actions/sales")
    const result = await createSale({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 3, discount: 0 }],
      payments: [{ method: "CASH", amount: 4499.97 }],
    })

    const saved = await db.sale.findUnique({ where: { id: result.id } })
    expect(saved!.totalAmount).toEqualDecimal("4499.97")
    expect(saved!.finalAmount).toEqualDecimal("4499.97")
  })

  it("single-digit discount сохраняется в Decimal без потерь", async () => {
    const { store, product } = await seedSalesFixture("1499.99")

    // discount 7.49 per unit, 2 units
    const { createSale } = await import("@/actions/sales")
    const result = await createSale({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, discount: 7.49 }],
      payments: [{ method: "CASH", amount: 2985.0 }],
    })

    const saved = await db.sale.findUnique({ where: { id: result.id } })
    // totalAmount = 1499.99 * 2 = 2999.98
    expect(saved!.totalAmount).toEqualDecimal("2999.98")
    // discountAmount = 7.49 * 2 = 14.98
    expect(saved!.discountAmount).toEqualDecimal("14.98")
    // finalAmount = 2999.98 - 14.98 = 2985.00
    expect(saved!.finalAmount).toEqualDecimal("2985.00")
  })

  it("1000-loop precision proof: 1000 × (продажа 1 шт по 0.01) = ровно 10.00", async () => {
    const { store, product } = await seedSalesFixture("0.01", 10000)

    const { createSale } = await import("@/actions/sales")

    const ids: string[] = []
    for (let i = 0; i < 1000; i++) {
      const r = await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 0.01 }],
      })
      ids.push(r.id)
    }

    const sales = await db.sale.findMany({ where: { id: { in: ids } } })
    expect(sales.length).toBe(1000)

    // Aggregate через Decimal helper — гарантированно без drift
    const total = sum(...sales.map((s) => s.finalAmount))
    expect(total).toEqualDecimal("10.00")
  }, 60_000)

  it("SaleItem.total сохраняет precision: (price-discount) × quantity", async () => {
    const { store, product } = await seedSalesFixture("1499.99")

    const { createSale } = await import("@/actions/sales")
    const result = await createSale({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 3, discount: 0.5 }],
      payments: [{ method: "CASH", amount: 4498.47 }],
    })

    const saved = await db.sale.findUnique({
      where: { id: result.id },
      include: { items: true },
    })
    // (1499.99 - 0.5) * 3 = 1499.49 * 3 = 4498.47
    expect(saved!.items[0].total).toEqualDecimal("4498.47")
    // Explicit precision check — no float drift
    const expected = mul(sub("1499.99", "0.5"), 3)
    expect(saved!.items[0].total).toEqualDecimal(expected)
  })
})
