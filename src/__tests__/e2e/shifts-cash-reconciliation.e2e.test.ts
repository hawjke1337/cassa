/**
 * E2E: precision proof для cash reconciliation в shifts.ts.
 *
 * Формула expectedCash:
 *   openingCash + cashSales + deposits − cashExpenses − withdrawals − cashRefunds
 *
 * До миграции: расчёт через Number() → накопление float-погрешности на 100+
 * операциях (± 0.01..0.03 ₽).
 * После миграции: через sum/sub из money.ts → ровно 0 расхождения.
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

async function seedShiftFixture(openingCash = "1000.00") {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory()
  const product = await createTestProduct({ categoryId: category.id })
  const sp = await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice: "0.01",
    costPrice: "0.00",
    quantity: 10000,
  })

  const shift = await db.shift.create({
    data: {
      number: `SH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      storeId: store.id,
      openedById: user.id,
      openingCash,
    },
  })

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  return { store, user, product, sp, shift }
}

describe("E2E: shifts cash reconciliation precision", () => {
  beforeEach(() => {
    mockSession.user.id = ""
    mockSession.user.storeId = ""
  })

  it("closeShift с openingCash=1000.00 и нулевым потоком → expectedCash=1000.00, discrepancy=0", async () => {
    const { shift } = await seedShiftFixture("1000.00")

    const { closeShift } = await import("@/actions/shifts")
    const result = await closeShift({
      shiftId: shift.id,
      closingCash: 1000.0,
    })

    const closed = await db.shift.findUnique({ where: { id: result.id } })
    expect(closed!.expectedCash).toEqualDecimal("1000.00")
    expect(closed!.discrepancy).toEqualDecimal("0.00")
  })

  it("100 × 0.01 cashSales + openingCash=1000 → expectedCash=1001.00 точно", async () => {
    const { store, product, shift } = await seedShiftFixture("1000.00")

    const { createSale } = await import("@/actions/sales")
    for (let i = 0; i < 100; i++) {
      await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 0.01 }],
      })
    }

    const { closeShift } = await import("@/actions/shifts")
    const result = await closeShift({
      shiftId: shift.id,
      closingCash: 1001.0,
    })

    const closed = await db.shift.findUnique({ where: { id: result.id } })
    expect(closed!.expectedCash).toEqualDecimal("1001.00")
    expect(closed!.discrepancy).toEqualDecimal("0.00")
  }, 60_000)

  it("cashOperations смешанные: deposit 200.25 + withdrawal 500.50 → expectedCash точно", async () => {
    const { user, shift } = await seedShiftFixture("1000.00")

    await db.cashOperation.create({
      data: {
        shiftId: shift.id,
        type: "DEPOSIT",
        amount: "200.25",
        reason: "test deposit",
        performedById: user.id,
      },
    })
    await db.cashOperation.create({
      data: {
        shiftId: shift.id,
        type: "WITHDRAW",
        amount: "500.50",
        reason: "test withdrawal",
        performedById: user.id,
      },
    })

    // expected = 1000 + 200.25 − 500.50 = 699.75
    const { closeShift } = await import("@/actions/shifts")
    const result = await closeShift({
      shiftId: shift.id,
      closingCash: 699.75,
    })

    const closed = await db.shift.findUnique({ where: { id: result.id } })
    expect(closed!.expectedCash).toEqualDecimal("699.75")
    expect(closed!.discrepancy).toEqualDecimal("0.00")
  })
})
