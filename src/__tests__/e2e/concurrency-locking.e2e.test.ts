/**
 * Phase 9: E2E Concurrency Locking Tests
 *
 * Тесты на реальной БД проверяющие pessimistic locking (SELECT FOR UPDATE)
 * при параллельных операциях. Каждый тест запускает 2 конкурентных операции
 * через Promise.allSettled — ожидается ровно 1 fulfilled + 1 rejected.
 *
 * Requirements: LOCK-01, LOCK-02, LOCK-03, LOCK-05
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
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
const { createWriteOff, confirmTransferSent } = await import("@/actions/inventory")

describe("Phase 9: Concurrency Locking E2E", () => {
  describe("LOCK-01: SerialUnit FOR UPDATE в createSale", () => {
    it("2 параллельных createSale на одну SerialUnit — ровно 1 успех", async () => {
      // ARRANGE
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory({ isSerialized: true })
      const product = await createTestProduct({ categoryId: category.id })
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "5000.00",
        costPrice: "3000.00",
        quantity: 1,
      })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      // Create a serial unit
      const serialUnit = await db.serialUnit.create({
        data: {
          productId: product.id,
          storeId: store.id,
          imei: "123456789012345",
          status: "IN_STOCK",
          costPrice: "3000.00",
        },
      })

      const saleData = {
        storeId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 1,
            discount: 0,
            serialUnitId: serialUnit.id,
          },
        ],
        payments: [{ method: "CASH" as const, amount: 5000 }],
      }

      // ACT — two parallel createSale on same SerialUnit
      const results = await Promise.allSettled([createSale(saleData), createSale(saleData)])

      // ASSERT
      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)

      // Post-check: SerialUnit should be SOLD
      const updatedUnit = await db.serialUnit.findUnique({
        where: { id: serialUnit.id },
      })
      expect(updatedUnit?.status).toBe("SOLD")

      // Post-check: exactly 1 sale created
      const saleCount = await db.sale.count()
      expect(saleCount).toBe(1)
    })
  })

  describe("LOCK-03: Atomic stock decrement в createSale", () => {
    it("2 параллельных createSale на последний несерийный — ровно 1 успех", async () => {
      // ARRANGE
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 1,
      })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const saleData = {
        storeId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 1,
            discount: 0,
          },
        ],
        payments: [{ method: "CASH" as const, amount: 1000 }],
      }

      // ACT — two parallel createSale on last item
      const results = await Promise.allSettled([createSale(saleData), createSale(saleData)])

      // ASSERT
      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)

      // Post-check: StoreProduct.quantity should be 0 (not -1)
      const sp = await db.storeProduct.findFirst({
        where: { storeId: store.id, productId: product.id },
      })
      expect(sp?.quantity).toBe(0)

      // Post-check: exactly 1 sale created
      const saleCount = await db.sale.count()
      expect(saleCount).toBe(1)
    })
  })

  describe("LOCK-05: createWriteOff FOR UPDATE", () => {
    it("2 параллельных createWriteOff на последний товар — ровно 1 успех", async () => {
      // ARRANGE
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 1,
      })

      const writeOffArgs = [
        store.id,
        [{ productId: product.id, quantity: 1 }],
        "Тестовое списание",
      ] as const

      // ACT — two parallel createWriteOff on last item
      const results = await Promise.allSettled([
        createWriteOff(writeOffArgs[0], [...writeOffArgs[1]], writeOffArgs[2]),
        createWriteOff(writeOffArgs[0], [...writeOffArgs[1]], "Тестовое списание 2"),
      ])

      // ASSERT
      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)

      // Post-check: StoreProduct.quantity should be 0
      const sp = await db.storeProduct.findFirst({
        where: { storeId: store.id, productId: product.id },
      })
      expect(sp?.quantity).toBe(0)
    })
  })

  describe("LOCK-02: confirmTransferSent FOR UPDATE", () => {
    it("confirmTransferSent и createSale concurrent — нет отрицательного stock", async () => {
      // ARRANGE
      const store1 = await createTestStore()
      const store2 = await createTestStore()
      const user = await createTestUser({ storeId: store1.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store1.id } })

      const category = await createTestCategory({ isSerialized: false })
      const product = await createTestProduct({ categoryId: category.id })
      // quantity: 2, reservedQuantity: 1 (transfer reserved 1)
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store1.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 2,
      })
      // Set reservedQuantity to 1
      await db.storeProduct.update({
        where: { id: sp.id },
        data: { reservedQuantity: 1 },
      })

      const shift = await createTestShift({ storeId: store1.id, userId: user.id })

      // Create a PENDING transfer (qty: 1) from store1 to store2
      const transfer = await db.stockTransfer.create({
        data: {
          number: `T-LOCK02-TEST`,
          fromStoreId: store1.id,
          toStoreId: store2.id,
          userId: user.id,
          status: "PENDING",
          items: {
            create: [{ productId: product.id, quantity: 1 }],
          },
        },
      })

      // ACT: try to sell qty=2 (available = 2 - 1 = 1 < 2) concurrently with confirmTransferSent
      const results = await Promise.allSettled([
        confirmTransferSent(transfer.id),
        createSale({
          storeId: store1.id,
          items: [{ productId: product.id, quantity: 2, discount: 0 }],
          payments: [{ method: "CASH", amount: 2000 }],
        }),
      ])

      // ASSERT: at least 1 rejected (sale should fail due to insufficient available stock)
      const rejected = results.filter((r) => r.status === "rejected")
      expect(rejected.length).toBeGreaterThanOrEqual(1)

      // Post-check: StoreProduct.quantity should be >= 0 (never negative)
      const updatedSp = await db.storeProduct.findFirst({
        where: { storeId: store1.id, productId: product.id },
      })
      expect(updatedSp!.quantity).toBeGreaterThanOrEqual(0)
    })
  })
})
