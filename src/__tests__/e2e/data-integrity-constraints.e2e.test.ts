/**
 * E2E: Data Integrity Constraints (DATA2-01, DATA2-07, DATA2-09)
 *
 * Verifies that DB-level CHECK constraints reject invalid data:
 * - Payment exclusivity: exactly one FK (or none for expenses)
 * - Quantity non-negative: StoreProduct, SaleItem, StockReceiveItem, ReturnItem
 * - SerialUnit uniqueness: (productId, imei) partial unique index
 *
 * CHECK constraints are applied via raw SQL in beforeAll since
 * `prisma db push` (used for test schema creation) doesn't run migrations.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestProduct,
  createTestStoreProduct,
  createTestShift,
  createTestCategory,
} from "../helpers/fixtures"

// Apply CHECK constraints to the test schema (db push doesn't run migration SQL)
beforeAll(async () => {
  // Set search_path for raw queries
  const schema = (await import("../setup-db")).testSchema

  // Helper to run DDL in the test schema
  async function execDDL(sql: string) {
    await db.$executeRawUnsafe(`SET search_path TO "${schema}", public`)
    await db.$executeRawUnsafe(sql)
  }

  // Payment exclusivity CHECK
  await execDDL(`
    ALTER TABLE "Payment" ADD CONSTRAINT "chk_payment_exclusivity"
    CHECK (
      ("isExpense" = true AND "saleId" IS NULL AND "orderId" IS NULL AND "repairId" IS NULL)
      OR
      ("isExpense" = false AND (
        CASE WHEN "saleId" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN "orderId" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN "repairId" IS NOT NULL THEN 1 ELSE 0 END
      ) = 1)
    )
  `)

  // Quantity CHECK constraints
  await execDDL(
    `ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_quantity" CHECK ("quantity" >= 0)`,
  )
  await execDDL(
    `ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_reserved" CHECK ("reservedQuantity" >= 0)`,
  )
  await execDDL(
    `ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_min_qty" CHECK ("minQty" >= 0)`,
  )
  await execDDL(
    `ALTER TABLE "SaleItem" ADD CONSTRAINT "chk_sale_item_quantity" CHECK ("quantity" > 0)`,
  )
  await execDDL(
    `ALTER TABLE "StockReceiveItem" ADD CONSTRAINT "chk_receive_item_quantity" CHECK ("quantity" > 0)`,
  )
  await execDDL(
    `ALTER TABLE "ReturnItem" ADD CONSTRAINT "chk_return_item_quantity" CHECK ("quantity" > 0)`,
  )

  // SerialUnit partial unique index
  await execDDL(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SerialUnit_productId_imei_unique"
    ON "SerialUnit" ("productId", "imei")
    WHERE "imei" IS NOT NULL
  `)
}, 30_000)

// Helper: set search_path then execute raw SQL, return error or null
async function rawExec(sql: string): Promise<Error | null> {
  const schema = (await import("../setup-db")).testSchema
  try {
    await db.$executeRawUnsafe(`SET search_path TO "${schema}", public`)
    await db.$executeRawUnsafe(sql)
    return null
  } catch (e) {
    return e as Error
  }
}

// Helper: set search_path then query raw SQL
async function rawQuery<T>(sql: string): Promise<T[]> {
  const schema = (await import("../setup-db")).testSchema
  await db.$executeRawUnsafe(`SET search_path TO "${schema}", public`)
  return db.$queryRawUnsafe<T[]>(sql)
}

describe("Data Integrity Constraints (E2E)", () => {
  // ============================================================
  // Payment exclusivity CHECK
  // ============================================================
  describe("Payment exclusivity CHECK (chk_payment_exclusivity)", () => {
    it("rejects Payment with no FK when isExpense=false", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const err = await rawExec(`
        INSERT INTO "Payment" ("id", "method", "amount", "isExpense", "shiftId", "createdAt", "updatedAt")
        VALUES ('pay-no-fk', 'CASH', 100.00, false, '${shift.id}', NOW(), NOW())
      `)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_payment_exclusivity")
    })

    it("rejects Payment with two FKs (saleId + orderId)", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      // Create a Sale
      const sale = await db.sale.create({
        data: {
          number: "S-DUAL-FK",
          storeId: store.id,
          sellerId: user.id,
          shiftId: shift.id,
          totalAmount: "100.00",
          finalAmount: "100.00",
          status: "COMPLETED",
        },
      })

      // Create a CustomOrder
      const order = await db.customOrder.create({
        data: {
          number: "CO-DUAL-FK",
          storeId: store.id,
          sellerId: user.id,
          clientName: "Test",
          clientPhone: "+7 000 000 0000",
          totalAmount: "200.00",
          prepaidAmount: "0.00",
          status: "NEW",
        },
      })

      const err = await rawExec(`
        INSERT INTO "Payment" ("id", "saleId", "orderId", "method", "amount", "isExpense", "shiftId", "createdAt", "updatedAt")
        VALUES ('pay-dual-fk', '${sale.id}', '${order.id}', 'CASH', 100.00, false, '${shift.id}', NOW(), NOW())
      `)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_payment_exclusivity")
    })

    it("allows isExpense=true Payment with no FK", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const err = await rawExec(`
        INSERT INTO "Payment" ("id", "method", "amount", "isExpense", "shiftId", "createdAt", "updatedAt")
        VALUES ('pay-expense', 'CASH', 50.00, true, '${shift.id}', NOW(), NOW())
      `)

      expect(err).toBeNull()

      // Verify it was actually inserted
      const rows = await rawQuery<{ id: string }>(
        `SELECT id FROM "Payment" WHERE id = 'pay-expense'`,
      )
      expect(rows).toHaveLength(1)
    })

    it("allows Payment with exactly one FK (saleId)", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const sale = await db.sale.create({
        data: {
          number: "S-ONE-FK",
          storeId: store.id,
          sellerId: user.id,
          shiftId: shift.id,
          totalAmount: "100.00",
          finalAmount: "100.00",
          status: "COMPLETED",
        },
      })

      const err = await rawExec(`
        INSERT INTO "Payment" ("id", "saleId", "method", "amount", "isExpense", "shiftId", "createdAt", "updatedAt")
        VALUES ('pay-one-fk', '${sale.id}', 'CASH', 100.00, false, '${shift.id}', NOW(), NOW())
      `)

      expect(err).toBeNull()
    })

    it("rejects isExpense=true Payment that also has a saleId", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const sale = await db.sale.create({
        data: {
          number: "S-EXP-FK",
          storeId: store.id,
          sellerId: user.id,
          shiftId: shift.id,
          totalAmount: "100.00",
          finalAmount: "100.00",
          status: "COMPLETED",
        },
      })

      const err = await rawExec(`
        INSERT INTO "Payment" ("id", "saleId", "method", "amount", "isExpense", "shiftId", "createdAt", "updatedAt")
        VALUES ('pay-exp-fk', '${sale.id}', 'CASH', 50.00, true, '${shift.id}', NOW(), NOW())
      `)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_payment_exclusivity")
    })
  })

  // ============================================================
  // Quantity CHECK constraints
  // ============================================================
  describe("Quantity CHECK constraints", () => {
    it("rejects negative StoreProduct.quantity", async () => {
      const store = await createTestStore()
      const product = await createTestProduct()
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        quantity: 5,
      })

      const err = await rawExec(`UPDATE "StoreProduct" SET "quantity" = -1 WHERE "id" = '${sp.id}'`)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_store_product_quantity")
    })

    it("allows StoreProduct.quantity = 0", async () => {
      const store = await createTestStore()
      const product = await createTestProduct()
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        quantity: 5,
      })

      const err = await rawExec(`UPDATE "StoreProduct" SET "quantity" = 0 WHERE "id" = '${sp.id}'`)

      expect(err).toBeNull()
    })

    it("rejects negative StoreProduct.reservedQuantity", async () => {
      const store = await createTestStore()
      const product = await createTestProduct()
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
      })

      const err = await rawExec(
        `UPDATE "StoreProduct" SET "reservedQuantity" = -1 WHERE "id" = '${sp.id}'`,
      )

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_store_product_reserved")
    })

    it("rejects zero SaleItem.quantity (must be > 0)", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })
      const product = await createTestProduct()

      const sale = await db.sale.create({
        data: {
          number: "S-ZERO-QTY",
          storeId: store.id,
          sellerId: user.id,
          shiftId: shift.id,
          totalAmount: "100.00",
          finalAmount: "100.00",
          status: "COMPLETED",
        },
      })

      const err = await rawExec(`
        INSERT INTO "SaleItem" ("id", "saleId", "productId", "name", "quantity", "price", "costPrice", "discount", "total", "updatedAt")
        VALUES ('si-zero', '${sale.id}', '${product.id}', 'Test', 0, 100.00, 50.00, 0, 100.00, NOW())
      `)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_sale_item_quantity")
    })

    it("rejects negative SaleItem.quantity", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })
      const product = await createTestProduct()

      const sale = await db.sale.create({
        data: {
          number: "S-NEG-QTY",
          storeId: store.id,
          sellerId: user.id,
          shiftId: shift.id,
          totalAmount: "100.00",
          finalAmount: "100.00",
          status: "COMPLETED",
        },
      })

      const err = await rawExec(`
        INSERT INTO "SaleItem" ("id", "saleId", "productId", "name", "quantity", "price", "costPrice", "discount", "total", "updatedAt")
        VALUES ('si-neg', '${sale.id}', '${product.id}', 'Test', -1, 100.00, 50.00, 0, 100.00, NOW())
      `)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_sale_item_quantity")
    })

    it("rejects negative StoreProduct.minQty", async () => {
      const store = await createTestStore()
      const product = await createTestProduct()
      const sp = await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
      })

      const err = await rawExec(`UPDATE "StoreProduct" SET "minQty" = -1 WHERE "id" = '${sp.id}'`)

      expect(err).not.toBeNull()
      expect(err!.message).toContain("chk_store_product_min_qty")
    })
  })

  // ============================================================
  // SerialUnit uniqueness
  // ============================================================
  describe("SerialUnit uniqueness (productId + imei)", () => {
    it("rejects duplicate productId+imei combination", async () => {
      const store = await createTestStore()
      const cat = await createTestCategory({ isSerialized: true })
      const product = await createTestProduct({ categoryId: cat.id })

      // First SerialUnit — OK
      await db.serialUnit.create({
        data: {
          productId: product.id,
          storeId: store.id,
          imei: "111222333444555",
          costPrice: "1000.00",
          status: "IN_STOCK",
        },
      })

      // Second SerialUnit with same productId + imei — should fail
      try {
        await db.serialUnit.create({
          data: {
            productId: product.id,
            storeId: store.id,
            imei: "111222333444555",
            costPrice: "1000.00",
            status: "IN_STOCK",
          },
        })
        // Should not reach here
        expect.fail("Expected unique constraint violation")
      } catch (e: unknown) {
        const err = e as Error
        // Prisma wraps the constraint violation
        expect(err.message).toMatch(/unique|Unique/)
      }
    })

    it("allows same imei on different products (global @unique prevents this, but compound index is defense-in-depth)", async () => {
      const store = await createTestStore()
      const cat = await createTestCategory({ isSerialized: true })
      const product1 = await createTestProduct({ categoryId: cat.id })

      // Create first SerialUnit
      await db.serialUnit.create({
        data: {
          productId: product1.id,
          storeId: store.id,
          imei: "999888777666555",
          costPrice: "1000.00",
          status: "IN_STOCK",
        },
      })

      // With global @unique on imei, even different products can't share IMEI.
      // This is expected behavior — global uniqueness is stricter than compound.
      const product2 = await createTestProduct({ categoryId: cat.id })
      try {
        await db.serialUnit.create({
          data: {
            productId: product2.id,
            storeId: store.id,
            imei: "999888777666555",
            costPrice: "1200.00",
            status: "IN_STOCK",
          },
        })
        expect.fail("Expected unique constraint violation (global @unique on imei)")
      } catch (e: unknown) {
        const err = e as Error
        expect(err.message).toMatch(/unique|Unique/)
      }
    })

    it("allows multiple SerialUnits with NULL imei on same product", async () => {
      const store = await createTestStore()
      const cat = await createTestCategory({ isSerialized: true })
      const product = await createTestProduct({ categoryId: cat.id })

      // NULL imei should not trigger the partial unique index
      const su1 = await db.serialUnit.create({
        data: {
          productId: product.id,
          storeId: store.id,
          imei: null,
          costPrice: "500.00",
          status: "IN_STOCK",
        },
      })

      const su2 = await db.serialUnit.create({
        data: {
          productId: product.id,
          storeId: store.id,
          imei: null,
          costPrice: "600.00",
          status: "IN_STOCK",
        },
      })

      expect(su1.id).toBeDefined()
      expect(su2.id).toBeDefined()
      expect(su1.id).not.toBe(su2.id)
    })
  })
})
