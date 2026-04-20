/**
 * Phase 9: Transfer Reservation E2E Tests
 *
 * LOCK-04: confirmReceive atomicity (SerialUnit failure rolls back StoreProduct)
 * LOCK-06: Stock reservation при PENDING transfer
 *
 * Тесты на реальной БД проверяющие что:
 * 1. createTransfer резервирует stock (reservedQuantity)
 * 2. cancelTransfer освобождает reservation
 * 3. confirmTransferSent декрементит quantity И reservedQuantity
 * 4. confirmReceive с duplicate IMEI откатывает StoreProduct increment
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

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))

const authMock = vi.fn(async () => ({ user: { id: "placeholder", storeId: "placeholder" } }))
vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { createSale } = await import("@/actions/sales")
const { createTransfer, confirmTransferSent, cancelTransfer, confirmReceive } =
  await import("@/actions/inventory")

describe("Phase 9: Transfer Reservation E2E", () => {
  describe("LOCK-06: createTransfer reserves stock, createSale on reserved stock fails", () => {
    it("createTransfer увеличивает reservedQuantity, createSale на reserved stock fails", async () => {
      // ARRANGE
      const store1 = await createTestStore()
      const store2 = await createTestStore()
      const user = await createTestUser({ storeId: store1.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store1.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store1.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 3,
      })
      const shift = await createTestShift({ storeId: store1.id, userId: user.id })

      // ACT: create transfer reserving 2 items
      const transfer = await createTransfer(store1.id, store2.id, [
        { productId: product.id, quantity: 2 },
      ])

      // ASSERT: reservedQuantity should be 2
      const sp1 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp1?.reservedQuantity).toBe(2)

      // ACT: try to sell qty=2 (available = 3 - 2 = 1 < 2) -> should fail
      await expect(
        createSale({
          storeId: store1.id,
          items: [{ productId: product.id, quantity: 2, discount: 0 }],
          payments: [{ method: "CASH", amount: 2000 }],
        }),
      ).rejects.toThrow(/Недостаточно/)

      // ACT: sell qty=1 (available = 1) -> should succeed
      const saleResult = await createSale({
        storeId: store1.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })
      expect(saleResult.id).toBeDefined()

      // Post-check: quantity decremented by 1
      const sp2 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp2?.quantity).toBe(2)
    })
  })

  describe("LOCK-06: cancelTransfer releases reservation", () => {
    it("cancelTransfer sets reservedQuantity to 0, createSale succeeds", async () => {
      // ARRANGE
      const store1 = await createTestStore()
      const store2 = await createTestStore()
      const user = await createTestUser({ storeId: store1.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store1.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store1.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 2,
      })
      const shift = await createTestShift({ storeId: store1.id, userId: user.id })

      // Create transfer reserving all 2 items
      const transfer = await createTransfer(store1.id, store2.id, [
        { productId: product.id, quantity: 2 },
      ])

      // Verify reserved
      const sp1 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp1?.reservedQuantity).toBe(2)

      // ACT: cancel transfer
      await cancelTransfer(transfer.id)

      // ASSERT: reservedQuantity back to 0
      const sp2 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp2?.reservedQuantity).toBe(0)

      // ACT: now sell qty=2 — should succeed since reservation released
      const saleResult = await createSale({
        storeId: store1.id,
        items: [{ productId: product.id, quantity: 2, discount: 0 }],
        payments: [{ method: "CASH", amount: 2000 }],
      })
      expect(saleResult.id).toBeDefined()

      // Post-check: quantity should be 0
      const sp3 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp3?.quantity).toBe(0)
    })
  })

  describe("LOCK-06: confirmTransferSent decrements quantity and reservedQuantity", () => {
    it("confirmTransferSent decrements both quantity and reservedQuantity", async () => {
      // ARRANGE
      const store1 = await createTestStore()
      const store2 = await createTestStore()
      const user = await createTestUser({ storeId: store1.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store1.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store1.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 5,
      })

      // Create transfer reserving 3 items
      const transfer = await createTransfer(store1.id, store2.id, [
        { productId: product.id, quantity: 3 },
      ])

      // Verify reserved
      const sp1 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp1?.reservedQuantity).toBe(3)
      expect(sp1?.quantity).toBe(5)

      // ACT: confirmTransferSent
      await confirmTransferSent(transfer.id)

      // ASSERT: quantity decremented by 3, reservedQuantity back to 0
      const sp2 = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(sp2?.quantity).toBe(2)
      expect(sp2?.reservedQuantity).toBe(0)
    })
  })

  describe("LOCK-04: confirmReceive with duplicate IMEI rolls back StoreProduct", () => {
    it("confirmReceive с duplicate IMEI откатывает StoreProduct increment", async () => {
      // ARRANGE
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory({ isSerialized: true })
      const product = await createTestProduct({ categoryId: category.id })

      // Pre-insert a SerialUnit with IMEI that will conflict
      const existingImei = "999888777666555"
      await db.serialUnit.create({
        data: {
          productId: product.id,
          storeId: store.id,
          imei: existingImei,
          status: "IN_STOCK",
          costPrice: "1000.00",
        },
      })

      // Ensure StoreProduct exists to track quantity (serialized: quantity = 0, managed by SerialUnit count)
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "2000.00",
        costPrice: "1000.00",
        quantity: 0,
      })

      // Create a DRAFT stock receive with 2 items
      const receive = await db.stockReceive.create({
        data: {
          number: `SR-LOCK04-TEST-${Date.now()}`,
          storeId: store.id,
          userId: user.id,
          totalAmount: "2000.00",
          status: "DRAFT",
          items: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                costPrice: "1000.00",
              },
            ],
          },
        },
        include: { items: true },
      })

      // Record initial StoreProduct quantity
      const spBefore = await db.storeProduct.findFirst({
        where: { storeId: store.id, productId: product.id },
      })
      const initialQuantity = spBefore?.quantity ?? 0

      // ACT: confirmReceive with serialData containing a duplicate IMEI
      await expect(
        confirmReceive(receive.id, {
          [product.id]: [
            { imei: "111222333444555", costPrice: 1000 },
            { imei: existingImei, costPrice: 1000 }, // duplicate!
          ],
        }),
      ).rejects.toThrow()

      // ASSERT: StoreProduct.quantity should be unchanged (transaction rolled back)
      const spAfter = await db.storeProduct.findFirst({
        where: { storeId: store.id, productId: product.id },
      })
      expect(spAfter?.quantity ?? 0).toBe(initialQuantity)

      // ASSERT: no new SerialUnit created (both rolled back)
      const units = await db.serialUnit.findMany({
        where: { productId: product.id, storeId: store.id },
      })
      expect(units).toHaveLength(1) // only the pre-existing one

      // ASSERT: receive still DRAFT (not confirmed)
      const receiveAfter = await db.stockReceive.findUnique({
        where: { id: receive.id },
      })
      expect(receiveAfter?.status).toBe("DRAFT")
    })
  })
})
