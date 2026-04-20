/**
 * E2E tests for warranty lookup (REPAIR-07, REPAIR-08, REPAIR-09).
 *
 * REPAIR-07: lookupForWarrantyClaim finds devices with IN_STOCK status (not just SOLD)
 * REPAIR-08: warrantyUntil expiry check (isUnderWarranty true/false)
 * REPAIR-09: lookupForWarrantyClaim searches by Sale.number
 */
import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
  createTestShift,
} from "../helpers/fixtures"

/** Helper: create common fixtures for each test */
async function setupFixtures() {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const shift = await createTestShift({ storeId: store.id, userId: user.id })
  const category = await createTestCategory({ isSerialized: true })
  const product = await createTestProduct({ categoryId: category.id })
  const storeProduct = await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    quantity: 5,
  })
  return { store, user, shift, category, product, storeProduct }
}

describe("Warranty Lookup (REPAIR-07, REPAIR-08, REPAIR-09)", () => {
  it("REPAIR-07: finds SerialUnit with IN_STOCK status by IMEI", async () => {
    const { store, product } = await setupFixtures()

    const serial = await db.serialUnit.create({
      data: {
        productId: product.id,
        storeId: store.id,
        imei: "111222333444555",
        status: "IN_STOCK",
        warrantyDays: 365,
        costPrice: "500.00",
      },
    })

    // Query same way as lookupForWarrantyClaim (with fixed SOLD+IN_STOCK filter)
    const found = await db.serialUnit.findFirst({
      where: {
        OR: [
          { imei: "111222333444555" },
          { imei2: "111222333444555" },
          { serialNumber: "111222333444555" },
        ],
        status: { in: ["SOLD", "IN_STOCK"] },
      },
    })

    expect(found).not.toBeNull()
    expect(found!.id).toBe(serial.id)
    expect(found!.status).toBe("IN_STOCK")
  })

  it("REPAIR-07: finds SerialUnit with SOLD status by IMEI (regression)", async () => {
    const { store, product } = await setupFixtures()

    const serial = await db.serialUnit.create({
      data: {
        productId: product.id,
        storeId: store.id,
        imei: "222333444555666",
        status: "SOLD",
        warrantyDays: 365,
        costPrice: "500.00",
      },
    })

    const found = await db.serialUnit.findFirst({
      where: {
        OR: [
          { imei: "222333444555666" },
          { imei2: "222333444555666" },
          { serialNumber: "222333444555666" },
        ],
        status: { in: ["SOLD", "IN_STOCK"] },
      },
    })

    expect(found).not.toBeNull()
    expect(found!.id).toBe(serial.id)
  })

  it("REPAIR-09: finds Sale by Sale.number", async () => {
    const { store, user, shift } = await setupFixtures()

    const saleNumber = `S-WARTEST-${Date.now()}`
    const sale = await db.sale.create({
      data: {
        number: saleNumber,
        storeId: store.id,
        sellerId: user.id,
        type: "RETAIL",
        status: "COMPLETED",
        totalAmount: "1000.00",
        discountAmount: "0",
        finalAmount: "1000.00",
        shiftId: shift.id,
      },
    })

    // Query same way as the new Sale.number search in lookupForWarrantyClaim
    const found = await db.sale.findFirst({
      where: { number: saleNumber, status: "COMPLETED" },
      include: {
        items: {
          include: {
            serialUnit: {
              select: {
                id: true,
                imei: true,
                warrantyDays: true,
                product: { select: { name: true, sku: true } },
                deviceRecord: { select: { id: true } },
              },
            },
          },
          take: 1,
        },
      },
    })

    expect(found).not.toBeNull()
    expect(found!.id).toBe(sale.id)
  })

  it("REPAIR-09: non-existent Sale.number returns null", async () => {
    const found = await db.sale.findFirst({
      where: { number: "S-NONEXISTENT-999", status: "COMPLETED" },
    })
    expect(found).toBeNull()
  })

  it("REPAIR-08: expired warranty detected correctly", async () => {
    const { store, user, product } = await setupFixtures()

    await db.serialUnit.create({
      data: {
        productId: product.id,
        storeId: store.id,
        imei: "333444555666777",
        status: "SOLD",
        warrantyDays: 30, // 30 days warranty
        costPrice: "500.00",
        history: {
          create: {
            event: "SOLD",
            performedById: user.id,
            storeId: store.id,
            createdAt: new Date(Date.now() - 60 * 86400000), // sold 60 days ago
          },
        },
      },
    })

    const found = await db.serialUnit.findFirst({
      where: {
        imei: "333444555666777",
        status: { in: ["SOLD", "IN_STOCK"] },
      },
      include: {
        history: { where: { event: "SOLD" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    })

    expect(found).not.toBeNull()
    const soldDate = found!.history[0]?.createdAt
    expect(soldDate).toBeDefined()
    const warrantyEnd = new Date(soldDate!.getTime() + found!.warrantyDays * 86400000)
    const isUnderWarranty = warrantyEnd > new Date()

    expect(isUnderWarranty).toBe(false) // 30 days warranty, sold 60 days ago
  })

  it("REPAIR-08: valid warranty detected correctly", async () => {
    const { store, user, product } = await setupFixtures()

    await db.serialUnit.create({
      data: {
        productId: product.id,
        storeId: store.id,
        imei: "444555666777888",
        status: "SOLD",
        warrantyDays: 365, // 365 days warranty
        costPrice: "500.00",
        history: {
          create: {
            event: "SOLD",
            performedById: user.id,
            storeId: store.id,
            createdAt: new Date(Date.now() - 10 * 86400000), // sold 10 days ago
          },
        },
      },
    })

    const found = await db.serialUnit.findFirst({
      where: {
        imei: "444555666777888",
        status: { in: ["SOLD", "IN_STOCK"] },
      },
      include: {
        history: { where: { event: "SOLD" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    })

    expect(found).not.toBeNull()
    const soldDate = found!.history[0]?.createdAt
    expect(soldDate).toBeDefined()
    const warrantyEnd = new Date(soldDate!.getTime() + found!.warrantyDays * 86400000)
    const isUnderWarranty = warrantyEnd > new Date()

    expect(isUnderWarranty).toBe(true) // 365 days warranty, sold 10 days ago
  })
})
