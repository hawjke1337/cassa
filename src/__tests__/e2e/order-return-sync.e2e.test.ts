/**
 * Phase 8 Wave 0 RED: E2E для синхронизации CustomOrder ↔ Sale при возврате.
 *
 * Покрывает требование:
 *   FIN-07 — createReturn со связанной CustomOrder должна синхронизировать статус:
 *     - Full return → CustomOrder.status = CANCELLED + OrderStatusHistory запись
 *     - Partial return → CustomOrder.status остаётся COMPLETED
 *
 * Wave 0 RED: текущий createReturn НЕ синхронизирует CustomOrder.status. Тесты
 * пишут позитивные Wave 2 assertions — падают RED до Plan 08-04 где sync будет добавлен.
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
} from "../helpers/fixtures"
import { assertOrderSaleLink, assertReturnAmountCap } from "../helpers/invariants"

// --- Mocks ---
vi.mock("@/lib/db", () => ({ db }))

const mockSession = { user: { id: "", storeId: "" } }
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

const { createReturn } = await import("@/actions/sales")

async function seedSaleLinkedToOrder(opts: { quantity: number; price: string; costPrice: string }) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory({ isSerialized: false })
  const product = await createTestProduct({ categoryId: category.id })
  await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice: opts.price,
    quantity: 10 - opts.quantity,
  })
  const shift = await createTestShift({ storeId: store.id, userId: user.id })

  mockSession.user.id = user.id
  mockSession.user.storeId = store.id

  const total = (Number(opts.price) * opts.quantity).toFixed(2)

  const sale = await db.sale.create({
    data: {
      number: `S-${Date.now()}-${Math.random()}`,
      storeId: store.id,
      sellerId: user.id,
      status: "COMPLETED",
      totalAmount: total,
      discountAmount: "0.00",
      finalAmount: total,
      shiftId: shift.id,
      payments: {
        create: [
          {
            method: "CASH",
            amount: total,
            shiftId: shift.id,
            storeId: store.id,
          },
        ],
      },
      items: {
        create: [
          {
            productId: product.id,
            name: "Test Product",
            quantity: opts.quantity,
            price: opts.price,
            costPrice: opts.costPrice,
            total,
          },
        ],
      },
    },
    include: { items: true },
  })

  const order = await db.customOrder.create({
    data: {
      number: `O-${Date.now()}-${Math.random()}`,
      storeId: store.id,
      sellerId: user.id,
      status: "COMPLETED",
      clientName: "Test Client",
      clientPhone: "+7 (999) 000-00-00",
      totalAmount: total,
      prepaidAmount: "0.00",
      finalAmount: total,
      saleId: sale.id,
    },
  })

  return { store, user, product, shift, sale, order }
}

describe("E2E FIN-07: Order ↔ Sale sync при возврате (Wave 0 RED)", () => {
  it("Full return: CustomOrder.status → CANCELLED + OrderStatusHistory запись", async () => {
    const { store, sale, order } = await seedSaleLinkedToOrder({
      quantity: 1,
      price: "1000.00",
      costPrice: "500.00",
    })

    // ACT — полный возврат
    await createReturn({
      saleId: sale.id,
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      reason: "Клиент вернул полностью",
      refundMethod: "CASH",
    })

    // Wave 2 expectations (Plan 08-04):
    const refreshed = await db.customOrder.findUnique({ where: { id: order.id } })
    expect(refreshed!.status).toBe("CANCELLED")

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: order.id },
    })
    expect(history.some((h) => h.status === "CANCELLED")).toBe(true)

    await assertOrderSaleLink(db, { storeId: store.id })
    await assertReturnAmountCap(db, { saleId: sale.id })
  })

  it("Partial return: CustomOrder.status остаётся COMPLETED", async () => {
    const { store, sale, order } = await seedSaleLinkedToOrder({
      quantity: 2,
      price: "500.00",
      costPrice: "300.00",
    })

    // ACT — частичный возврат (1 из 2)
    await createReturn({
      saleId: sale.id,
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      reason: "Частичный возврат",
      refundMethod: "CASH",
    })

    const refreshed = await db.customOrder.findUnique({ where: { id: order.id } })
    // При partial return status НЕ меняется (товар частично у клиента)
    expect(refreshed!.status).toBe("COMPLETED")
    expect(refreshed!.saleId).toBe(sale.id)

    await assertOrderSaleLink(db, { storeId: store.id })
    await assertReturnAmountCap(db, { saleId: sale.id })
  })
})
