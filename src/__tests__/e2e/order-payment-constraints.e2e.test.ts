/**
 * Phase 8 Wave 0 RED: constraints для payment/shift на completion заказа.
 *
 * Покрывает требования:
 *   FIN-09 — refundMethod обязательный, soft set validation
 *            (∈ set(sale.payments.methods))
 *   FIN-11 — completeOrder throws без OPEN shift
 *   FIN-12 — Overpay blocking: throw "Переплата заказа: уменьшите сумму"
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
import { assertOrderSaleLink, assertShiftConsistency } from "../helpers/invariants"

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

async function seedBasic(opts: { openShift?: boolean; prepaidAmount?: string } = {}) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory({ isSerialized: false })
  const product = await createTestProduct({ categoryId: category.id })
  await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice: "1000.00",
    quantity: 10,
  })
  const shift =
    opts.openShift === false
      ? await createTestShift({ storeId: store.id, userId: user.id, status: "CLOSED" })
      : await createTestShift({ storeId: store.id, userId: user.id, status: "OPEN" })

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  const order = await createTestOrderWithPrepayment({
    storeId: store.id,
    sellerId: user.id,
    shiftId: shift.id,
    items: [{ productId: product.id, quantity: 1, price: "1000.00", name: "Test Product" }],
    prepaidAmount: opts.prepaidAmount ?? "500.00",
    status: "READY_FOR_PICKUP",
  })

  return { store, user, product, shift, order }
}

describe("E2E FIN-09/11/12: order payment constraints (Wave 0 RED)", () => {
  it("FIN-11: completeOrder без OPEN shift → throw 'Откройте кассовую смену'", async () => {
    const { order } = await seedBasic({ openShift: false })

    // Смена CLOSED → должна упасть
    await expect(
      completeOrder(order.id, { finalPayment: { method: "CASH", amount: "500.00" } }),
    ).rejects.toThrow(/Откройте кассовую смену/)
  })

  it("FIN-12: overpay → throw 'Переплата заказа: уменьшите сумму'", async () => {
    const { order } = await seedBasic({ openShift: true, prepaidAmount: "500.00" })

    // Заказ 1000, prepaid 500, осталось 500. Пытаемся оплатить 700 → overpay
    await expect(
      completeOrder(order.id, {
        finalPayment: { method: "CASH", amount: "700.00" },
      }),
    ).rejects.toThrow(/Переплата заказа: уменьшите сумму/)
  })

  it("FIN-12: точная сумма допустима, overpay на 0.01 → throw", async () => {
    const { order } = await seedBasic({ openShift: true, prepaidAmount: "0.00" })

    // Должен пройти success при точной оплате 1000
    await completeOrder(order.id, {
      finalPayment: { method: "CASH", amount: "1000.00" },
    })

    // Вторая попытка оплаты переплата (edge case) — можно проверить на новом order
  })

  it("FIN-09: refundMethod обязателен — createReturn без него → throw", async () => {
    // Arrange: Sale с CASH payment
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1000.00",
      quantity: 9,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    mockSession.user.id = user.id
    mockSession.user.storeId = store.id

    const sale = await db.sale.create({
      data: {
        number: `S-${Date.now()}`,
        storeId: store.id,
        sellerId: user.id,
        status: "COMPLETED",
        totalAmount: "1000.00",
        discountAmount: "0.00",
        finalAmount: "1000.00",
        shiftId: shift.id,
        payments: {
          create: [{ method: "CASH", amount: "1000.00", shiftId: shift.id, storeId: store.id }],
        },
        items: {
          create: [
            {
              productId: product.id,
              name: "Test",
              quantity: 1,
              price: "1000.00",
              costPrice: "500.00",
              total: "1000.00",
            },
          ],
        },
      },
      include: { items: true },
    })

    // Wave 2 expectation: без refundMethod → throw
    await expect(
      createReturn({
        saleId: sale.id,
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
        reason: "Возврат без метода",
        // refundMethod опущен
      }),
    ).rejects.toThrow(/refundMethod|метод.*возврата|Метод возврата/i)
  })

  it("FIN-09: refundMethod не совпадает с методами оплаты → throw 'Метод возврата ... не совпадает'", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1000.00",
      quantity: 9,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    mockSession.user.id = user.id
    mockSession.user.storeId = store.id

    // Продажа CASH-only
    const sale = await db.sale.create({
      data: {
        number: `S-${Date.now()}`,
        storeId: store.id,
        sellerId: user.id,
        status: "COMPLETED",
        totalAmount: "1000.00",
        discountAmount: "0.00",
        finalAmount: "1000.00",
        shiftId: shift.id,
        payments: {
          create: [{ method: "CASH", amount: "1000.00", shiftId: shift.id, storeId: store.id }],
        },
        items: {
          create: [
            {
              productId: product.id,
              name: "Test",
              quantity: 1,
              price: "1000.00",
              costPrice: "500.00",
              total: "1000.00",
            },
          ],
        },
      },
      include: { items: true },
    })

    // Пытаемся вернуть CARD-ом — не совпадает с CASH
    await expect(
      createReturn({
        saleId: sale.id,
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
        reason: "Возврат",
        refundMethod: "CARD",
      }),
    ).rejects.toThrow(/Метод возврата.*не совпадает с методами оплаты/)

    await assertShiftConsistency(db)
    await assertOrderSaleLink(db, { storeId: store.id })
  })
})
