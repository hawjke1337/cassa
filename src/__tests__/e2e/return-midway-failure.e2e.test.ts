/**
 * Phase 8 Wave 0 RED: атомарность возврата при mid-transaction failure.
 *
 * Покрывает требование:
 *   FIN-10 — Если createReturn падает после частичных изменений, Prisma
 *            должна откатить всё: Sale.status, StoreProduct.quantity,
 *            SerialUnit.status — ничего не должно остаться изменённым.
 *
 * **Wave 0 RED:** тест инъектирует failure через нарушение constraint
 * (например invalid saleItemId), проверяет что state БД не изменился.
 * Сейчас этот тест может быть uncertain — Wave 2 (Plan 08-04) докрутит
 * atomic guarantees.
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
import { assertStockConservation } from "../helpers/invariants"

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

const { createReturn } = await import("@/actions/sales")

describe("E2E FIN-10: атомарный rollback возврата при mid-tx failure (Wave 0 RED)", () => {
  it("Невалидный saleItemId → throw, stock/Sale/Return не изменились", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1000.00",
      quantity: 9, // после "продажи" 1 шт
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

    const stateBefore = {
      saleStatus: sale.status,
      stockQty: 9,
      returnCount: 0,
    }

    // ACT — createReturn с несуществующим saleItemId → throw, rollback полный
    await expect(
      createReturn({
        saleId: sale.id,
        items: [{ saleItemId: "clxxx-does-not-exist", quantity: 1 }],
        reason: "Rollback test",
        refundMethod: "CASH",
      }),
    ).rejects.toThrow()

    // ASSERT — ничего не изменилось
    const saleAfter = await db.sale.findUnique({ where: { id: sale.id } })
    expect(saleAfter!.status).toBe(stateBefore.saleStatus)

    const sp = await db.storeProduct.findFirst({
      where: { storeId: store.id, productId: product.id },
    })
    expect(sp!.quantity).toBe(stateBefore.stockQty)

    const returns = await db.return.count({ where: { saleId: sale.id } })
    expect(returns).toBe(stateBefore.returnCount)

    await assertStockConservation(db, {
      storeId: store.id,
      productId: product.id,
      initialStock: 10,
    })
  })

  it("Возврат больше чем было продано → throw, state не изменён", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "500.00",
      quantity: 8,
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
              quantity: 2,
              price: "500.00",
              costPrice: "300.00",
              total: "1000.00",
            },
          ],
        },
      },
      include: { items: true },
    })

    // Попытка вернуть 5 из 2 проданных
    await expect(
      createReturn({
        saleId: sale.id,
        items: [{ saleItemId: sale.items[0].id, quantity: 5 }],
        reason: "Overcapacity",
        refundMethod: "CASH",
      }),
    ).rejects.toThrow()

    const sp = await db.storeProduct.findFirst({
      where: { storeId: store.id, productId: product.id },
    })
    expect(sp!.quantity).toBe(8) // без изменений
  })
})
