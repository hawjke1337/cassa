/**
 * Phase 8 Wave 0 RED: E2E для завершения заказа (completeOrder).
 *
 * Покрывает требования:
 *   FIN-01 — Sale.finalAmount = totalAmount − discount − prepaidAmount
 *   FIN-02 — stock decrement на completion (пессимистичный lock)
 *   FIN-03 — SerialUnit IN_STOCK → SOLD атомарно
 *
 * **Wave 0 RED semantic:** тесты пишут позитивные Wave 2 assertions (Sale создан,
 * stock списан, SerialUnit=SOLD). Stub `completeOrder` бросает "not implemented — Wave 2",
 * поэтому ВСЕ тесты падают RED до Plan 08-03 (где stub заменяется реальной имплементацией).
 *
 * Инварианты (из helpers/invariants.ts) вызываются после ACT — это часть контракта.
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
  assertSerialConsistency,
  assertMoneyConservation,
  assertShiftConsistency,
  assertOrderSaleLink,
} from "../helpers/invariants"
import { toMoney } from "@/lib/money"

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user", storeId: "test-store" } })),
}))
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { completeOrder } = await import("@/actions/orders")

describe("E2E FIN-01/02/03: completeOrder (Wave 0 RED)", () => {
  it("FIN-01: finalAmount = total − discount − prepaidAmount (полная предоплата)", async () => {
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
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [{ productId: product.id, quantity: 2, price: "1000.00", name: "Test Product" }],
      prepaidAmount: "2000.00",
      status: "READY_FOR_PICKUP",
    })

    // ACT — Wave 2 положительный контракт (сейчас падает из stub)
    const result = await completeOrder(order.id, { discountAmount: "0" })

    // ASSERT — Sale создан с правильным finalAmount = 2000 - 0 - 2000 = 0
    const sale = await db.sale.findUnique({ where: { id: result.saleId } })
    expect(sale).not.toBeNull()
    expect(sale!.finalAmount).toEqualDecimal("0.00")
    expect(sale!.totalAmount).toEqualDecimal("2000.00")

    await assertStockConservation(db, {
      storeId: store.id,
      productId: product.id,
      initialStock: 10,
    })
    await assertMoneyConservation(db, { storeId: store.id })
    await assertOrderSaleLink(db, { storeId: store.id })
    await assertShiftConsistency(db)
  })

  it("FIN-01: finalAmount с discount и partial prepayment", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "500.00",
      quantity: 10,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [{ productId: product.id, quantity: 4, price: "500.00", name: "Test Product" }],
      prepaidAmount: "1000.00", // partial
      status: "READY_FOR_PICKUP",
    })

    // totalAmount = 2000, discount = 100, prepaid = 1000 → finalAmount = 900
    const result = await completeOrder(order.id, {
      discountAmount: "100",
      finalPayment: { method: "CASH", amount: "900.00" },
    })

    const sale = await db.sale.findUnique({ where: { id: result.saleId } })
    expect(sale!.finalAmount).toEqualDecimal("900.00")
    expect(sale!.discountAmount).toEqualDecimal("100.00")

    await assertShiftConsistency(db)
    await assertOrderSaleLink(db, { storeId: store.id })
    await assertMoneyConservation(db, { storeId: store.id })
  })

  it("FIN-02 + FIN-03: stock decrement + SerialUnit → SOLD (микс)", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const catNonSerial = await createTestCategory({ isSerialized: false })
    const catSerial = await createTestCategory({ isSerialized: true })

    const productA = await createTestProduct({ categoryId: catNonSerial.id, name: "Кабель USB" })
    const productB = await createTestProduct({ categoryId: catSerial.id, name: "iPhone 15" })

    await createTestStoreProduct({
      productId: productA.id,
      storeId: store.id,
      sellPrice: "500.00",
      quantity: 5,
    })
    await createTestStoreProduct({
      productId: productB.id,
      storeId: store.id,
      sellPrice: "80000.00",
      quantity: 1,
    })

    const serialUnit = await db.serialUnit.create({
      data: {
        productId: productB.id,
        storeId: store.id,
        imei: `IMEI-${Date.now()}`,
        status: "IN_STOCK",
        costPrice: "60000.00",
        warrantyDays: 365,
      },
    })

    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [
        { productId: productA.id, quantity: 2, price: "500.00", name: "Кабель USB" },
        {
          productId: productB.id,
          quantity: 1,
          price: "80000.00",
          name: "iPhone 15",
          serialUnitId: serialUnit.id,
          requiresImei: true,
        },
      ],
      prepaidAmount: "40000.00",
      status: "READY_FOR_PICKUP",
    })

    // Wave 2 ACT — stub сейчас бросает, тест падает RED
    const result = await completeOrder(order.id, {
      finalPayment: { method: "CASH", amount: "41000.00" },
    })

    // Wave 2 positive expectations:
    const spA = await db.storeProduct.findFirst({
      where: { storeId: store.id, productId: productA.id },
    })
    const spB = await db.storeProduct.findFirst({
      where: { storeId: store.id, productId: productB.id },
    })
    expect(spA!.quantity).toBe(3) // 5 - 2
    expect(spB!.quantity).toBe(0) // 1 - 1

    const refreshedUnit = await db.serialUnit.findUnique({ where: { id: serialUnit.id } })
    expect(refreshedUnit!.status).toBe("SOLD")

    const sale = await db.sale.findUnique({ where: { id: result.saleId } })
    expect(sale!.finalAmount).toEqualDecimal("41000.00")

    await assertStockConservation(db, {
      storeId: store.id,
      productId: productA.id,
      initialStock: 5,
    })
    await assertStockConservation(db, {
      storeId: store.id,
      productId: productB.id,
      initialStock: 1,
    })
    await assertSerialConsistency(db, { storeId: store.id })
    await assertOrderSaleLink(db, { storeId: store.id })

    expect(toMoney(order.totalAmount).toString()).toBe("81000")
  })

  it("FIN-02: недостаточный остаток → throw 'Недостаточно остатка: {name}'", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id, name: "Редкий товар" })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1000.00",
      quantity: 1,
    })
    const shift = await createTestShift({ storeId: store.id, userId: user.id })
    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: shift.id,
      items: [{ productId: product.id, quantity: 3, price: "1000.00", name: "Редкий товар" }],
      prepaidAmount: "1000.00",
      status: "READY_FOR_PICKUP",
    })

    // Wave 2 expectation: rejects с точным сообщением. Сейчас падает на stub.
    await expect(completeOrder(order.id)).rejects.toThrow(/Недостаточно остатка: Редкий товар/)
  })
})
