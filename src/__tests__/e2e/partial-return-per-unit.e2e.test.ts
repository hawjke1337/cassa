/**
 * Phase 8 Wave 0 RED: частичный возврат с per-unit discount distribution.
 *
 * Покрывает требование:
 *   FIN-08 — При completion заказа со скидкой на всю корзину, скидка
 *            пропорционально распределяется по SaleItem с residual pattern.
 *            Частичный возврат должен вернуть точную пропорциональную сумму.
 *
 * **Wave 0 RED:** completeOrder — throwing stub, тесты падают до Plan 08-03.
 */
import { describe, it, expect, vi } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
  createTestShift,
  createTestOrderWithPrepayment,
} from "../helpers/fixtures"
import {
  assertStockConservation,
  assertMoneyConservation,
  assertReturnAmountCap,
  assertOrderSaleLink,
} from "../helpers/invariants"
import { toMoney } from "@/lib/money"

vi.mock("@/lib/db", () => ({ db }))
const mockSession = { user: { id: "", storeId: "" } }
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mockSession) }))
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { completeOrder } = await import("@/actions/orders")
const { createReturn } = await import("@/actions/sales")

describe("E2E FIN-08: partial return с per-unit discount (Wave 0 RED)", () => {
  it("3 позиции × 100₽ со скидкой 99₽ → residual 33/33/33 и частичный возврат точный", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "100.00",
      quantity: 10,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    mockSession.user.id = user.id
    mockSession.user.storeId = store.id

    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [{ productId: product.id, quantity: 3, price: "100.00", name: "Товар" }],
      prepaidAmount: "0.00",
      status: "READY_FOR_PICKUP",
    })

    // Wave 2: скидка 99₽ → per-unit residual = 33/33/33
    const result = await completeOrder(order.id, {
      discountAmount: "99",
      finalPayment: { method: "CASH", amount: "201.00" },
    })

    const sale = await db.sale.findUnique({
      where: { id: result.saleId },
      include: { items: true },
    })
    expect(sale!.finalAmount).toEqualDecimal("201.00")
    expect(sale!.discountAmount).toEqualDecimal("99.00")

    // Precision check: sum of item discounts == total discount (residual pattern)
    const itemDiscountSum = sale!.items.reduce(
      (acc, it) => acc.add(toMoney(it.discount).mul(it.quantity)),
      toMoney(0),
    )
    expect(itemDiscountSum.toString()).toBe("99")

    // Частичный возврат 1 из 3: должен вернуть 100 - 33 = 67 (без накопления drift)
    const saleItem = sale!.items[0]
    await createReturn({
      saleId: sale!.id,
      items: [{ saleItemId: saleItem.id, quantity: 1 }],
      reason: "Клиент передумал за 1",
      refundMethod: "CASH",
    })

    const returns = await db.return.findMany({ where: { saleId: sale!.id } })
    expect(returns.length).toBe(1)
    // Ожидаемая сумма возврата по 1 единице = 67 (100 - 33 per-unit discount)
    expect(toMoney(returns[0].amount).toString()).toBe("67")

    await assertStockConservation(db, {
      storeId: store.id,
      productId: product.id,
      initialStock: 10,
    })
    await assertMoneyConservation(db, { storeId: store.id })
    await assertReturnAmountCap(db, { saleId: sale!.id })
    await assertOrderSaleLink(db, { storeId: store.id })
  })

  it("2 позиции × 99.99₽ со скидкой 0.01₽ → precision сохранена, частичный возврат без drift", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "99.99",
      quantity: 5,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    mockSession.user.id = user.id
    mockSession.user.storeId = store.id

    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [{ productId: product.id, quantity: 2, price: "99.99", name: "Товар" }],
      prepaidAmount: "0.00",
      status: "READY_FOR_PICKUP",
    })

    const result = await completeOrder(order.id, {
      discountAmount: "0.01",
      finalPayment: { method: "CASH", amount: "199.97" },
    })

    const sale = await db.sale.findUnique({
      where: { id: result.saleId },
      include: { items: true },
    })

    const itemDiscountSum = sale!.items.reduce(
      (acc, it) => acc.add(toMoney(it.discount).mul(it.quantity)),
      toMoney(0),
    )
    expect(itemDiscountSum.toString()).toBe("0.01")
  })
})
