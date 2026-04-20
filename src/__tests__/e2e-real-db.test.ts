/**
 * E2E тесты с РЕАЛЬНОЙ БД — ловят constraint violations, raw SQL баги,
 * и проблемы интеграции которые моки пропускают.
 *
 * НЕ мокает db, auth, permissions — вызывает Prisma напрямую.
 * Каждый тест откатывает свои данные.
 */
import { describe, it, expect, afterAll } from "vitest"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const pool = new pg.Pool({
  connectionString: "postgresql://astore:astore_dev_2026@localhost:5432/astore_erp",
})
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

// IDs для cleanup
const createdIds: { table: string; id: string }[] = []

afterAll(async () => {
  for (const { table, id } of createdIds.reverse()) {
    try {
      await (db as any)[table].delete({ where: { id } })
    } catch {
      // Already deleted or FK constraint — ok
    }
  }
  await db.$disconnect()
  await pool.end()
})

// =========================================================
// TEST 1: getNextNumber — Counter с updatedAt через raw SQL
// =========================================================
describe("E2E: Counter (getNextNumber raw SQL)", () => {
  const testCounterId = `TEST-${Date.now()}`

  afterAll(async () => {
    await db.$queryRaw`DELETE FROM "Counter" WHERE id = ${testCounterId}`
  })

  it("INSERT создаёт Counter с updatedAt NOT NULL", async () => {
    await db.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${testCounterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`

    const rows = await db.$queryRaw<{ id: string; current: number; updatedAt: Date }[]>`
      SELECT id, current, "updatedAt" FROM "Counter" WHERE id = ${testCounterId}
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].current).toBe(0)
    expect(rows[0].updatedAt).toBeInstanceOf(Date)
  })

  it("UPDATE инкрементирует и обновляет updatedAt", async () => {
    const result = await db.$queryRaw<{ current: number }[]>`
      UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${testCounterId} RETURNING current
    `
    expect(result[0].current).toBe(1)
  })

  it("повторный INSERT (ON CONFLICT DO NOTHING) не ломается", async () => {
    await expect(
      db.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${testCounterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`,
    ).resolves.not.toThrow()
  })
})

// =========================================================
// TEST 2: Создание заказа (CustomOrder) — полный flow
// =========================================================
describe("E2E: Создание CustomOrder", () => {
  it("создаёт заказ с автонумерацией через Counter", async () => {
    const storeId = "seed-store-central"
    const userId = "cmmjd65am00004s9kqn1rboug" // admin
    const customerId = "cmn8t3m84000g339kwklea7fk" // Вася Пупкин

    const order = await db.$transaction(async (tx) => {
      // Replicate getNextNumber logic
      const counterId = `CO-${new Date().getFullYear()}`
      await tx.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
      const result = await tx.$queryRaw<
        { current: number }[]
      >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`
      const number = `CO-${new Date().getFullYear()}-${String(result[0].current).padStart(6, "0")}`

      return tx.customOrder.create({
        data: {
          number,
          storeId,
          sellerId: userId,
          clientName: "E2E Test Client",
          clientPhone: "+79001234567",
          status: "NEW",
          totalAmount: 10000,
        },
      })
    })

    expect(order.id).toBeTruthy()
    expect(order.number).toMatch(/^CO-\d{4}-\d{6}$/)
    expect(order.status).toBe("NEW")
    createdIds.push({ table: "customOrder", id: order.id })
  })
})

// =========================================================
// TEST 3: Создание Trade-In — полный flow
// =========================================================
describe("E2E: Создание Trade-In", () => {
  it("создаёт trade-in с автонумерацией", async () => {
    const storeId = "seed-store-central"
    const userId = "cmmjd65am00004s9kqn1rboug"
    const customerId = "cmn8t3m84000g339kwklea7fk"

    const tradeIn = await db.$transaction(async (tx) => {
      const counterId = `TI-${new Date().getFullYear()}`
      await tx.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
      const result = await tx.$queryRaw<
        { current: number }[]
      >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`
      const number = `TI-${new Date().getFullYear()}-${String(result[0].current).padStart(6, "0")}`

      return tx.tradeIn.create({
        data: {
          number,
          storeId,
          customerId,
          acceptedById: userId,
          type: "TRADE_IN",
          status: "PENDING",
          deviceType: "Смартфон",
          deviceBrand: "Apple",
          deviceModel: "iPhone 15",
          deviceCondition: "Хорошее, без царапин",
          estimatedPrice: 50000,
          agreedPrice: 45000,
        },
      })
    })

    expect(tradeIn.id).toBeTruthy()
    expect(tradeIn.number).toMatch(/^TI-\d{4}-\d{6}$/)
    expect(tradeIn.status).toBe("PENDING")
    createdIds.push({ table: "tradeIn", id: tradeIn.id })
  })
})

// =========================================================
// TEST 4: Создание продажи (Sale) — полный flow
// =========================================================
describe("E2E: Создание Sale", () => {
  it("создаёт продажу с SaleItem и обновляет остатки", async () => {
    const storeId = "seed-store-central"
    const userId = "cmmjd65am00004s9kqn1rboug"
    const productId = "prod-anker-pp3" // Anker PowerPort, quantity=10

    // Get initial stock
    const before = await db.storeProduct.findUnique({
      where: { storeId_productId: { storeId, productId } },
    })
    expect(before).toBeTruthy()
    const initialQty = before!.quantity

    // BUILD-01 / FIN-11: Payment.shiftId теперь NOT NULL — Sale с платежом
    // требует открытой смены. Создаём смену для теста и чистим в finally.
    const shiftCounterId = `SH-${new Date().getFullYear()}`
    await db.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${shiftCounterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
    const shiftNumResult = await db.$queryRaw<
      { current: number }[]
    >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${shiftCounterId} RETURNING current`
    const shiftNumber = `SH-${new Date().getFullYear()}-${String(shiftNumResult[0].current).padStart(6, "0")}`
    const testShift = await db.shift.create({
      data: {
        number: shiftNumber,
        storeId,
        openedById: userId,
        openedAt: new Date(),
        openingCash: 0,
        status: "OPEN",
      },
    })
    createdIds.push({ table: "shift", id: testShift.id })

    const sale = await db.$transaction(async (tx) => {
      // Counter
      const counterId = `S-${new Date().getFullYear()}`
      await tx.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
      const result = await tx.$queryRaw<
        { current: number }[]
      >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`
      const number = `S-${new Date().getFullYear()}-${String(result[0].current).padStart(6, "0")}`

      // Create sale
      const s = await tx.sale.create({
        data: {
          number,
          storeId,
          sellerId: userId,
          totalAmount: 2990,
          finalAmount: 2990,
          cashReceived: 3000,
          changeAmount: 10,
          items: {
            create: {
              productId,
              quantity: 1,
              price: 2990,
              costPrice: 1500,
              total: 2990,
            },
          },
          payments: {
            create: {
              method: "CASH",
              amount: 2990,
              shiftId: testShift.id,
            },
          },
        },
      })

      // Decrement stock
      await tx.storeProduct.update({
        where: { storeId_productId: { storeId, productId } },
        data: { quantity: { decrement: 1 } },
      })

      return s
    })

    expect(sale.id).toBeTruthy()
    expect(sale.number).toMatch(/^S-\d{4}-\d{6}$/)
    expect(Number(sale.cashReceived)).toBe(3000)
    expect(Number(sale.changeAmount)).toBe(10)

    // Verify stock decremented
    const after = await db.storeProduct.findUnique({
      where: { storeId_productId: { storeId, productId } },
    })
    expect(after!.quantity).toBe(initialQty - 1)

    // Cleanup: restore stock and delete sale
    await db.payment.deleteMany({ where: { saleId: sale.id } })
    await db.saleItem.deleteMany({ where: { saleId: sale.id } })
    await db.sale.delete({ where: { id: sale.id } })
    await db.storeProduct.update({
      where: { storeId_productId: { storeId, productId } },
      data: { quantity: { increment: 1 } },
    })
  })
})

// =========================================================
// TEST 5: Открытие смены (Shift)
// =========================================================
describe("E2E: Открытие смены", () => {
  it("создаёт смену с автонумерацией", async () => {
    const storeId = "seed-store-central"
    const userId = "cmmjd65am00004s9kqn1rboug"

    const shift = await db.$transaction(async (tx) => {
      const counterId = `SH-${new Date().getFullYear()}`
      await tx.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
      const result = await tx.$queryRaw<
        { current: number }[]
      >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`
      const number = `SH-${new Date().getFullYear()}-${String(result[0].current).padStart(6, "0")}`

      return tx.shift.create({
        data: {
          number,
          storeId,
          openedById: userId,
          openedAt: new Date(),
          openingCash: 5000,
          status: "OPEN",
        },
      })
    })

    expect(shift.id).toBeTruthy()
    expect(shift.number).toMatch(/^SH-\d{4}-\d{6}$/)
    expect(shift.status).toBe("OPEN")

    // Cleanup
    await db.shift.delete({ where: { id: shift.id } })
  })
})

// =========================================================
// TEST 6: Создание ремонта (Repair)
// =========================================================
describe("E2E: Создание Repair", () => {
  it("создаёт ремонт с автонумерацией", async () => {
    const storeId = "seed-store-central"
    const userId = "cmmjd65am00004s9kqn1rboug"

    const repair = await db.$transaction(async (tx) => {
      const counterId = `REP-${new Date().getFullYear()}`
      await tx.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
      const result = await tx.$queryRaw<
        { current: number }[]
      >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`
      const number = `REP-${new Date().getFullYear()}-${String(result[0].current).padStart(6, "0")}`

      return tx.repair.create({
        data: {
          number,
          storeId,
          createdById: userId,
          clientName: "E2E Клиент",
          clientPhone: "+79001234567",
          deviceType: "Смартфон",
          deviceCondition: "Потёртости на экране",
          defectDescription: "Не заряжается",
          status: "RECEIVED",
          estimatedCost: 5000,
        },
      })
    })

    expect(repair.id).toBeTruthy()
    expect(repair.number).toMatch(/^REP-\d{4}-\d{6}$/)
    expect(repair.status).toBe("RECEIVED")

    // Cleanup
    await db.repair.delete({ where: { id: repair.id } })
  })
})

// =========================================================
// TEST 7: Soft delete фильтрация
// =========================================================
describe("E2E: Soft delete", () => {
  it("findMany с ручным фильтром не возвращает записи с deletedAt", async () => {
    // Проверяем через raw SQL что soft delete данные правильно фильтруются
    const allStores = await db.store.findMany({
      where: { deletedAt: null },
    })
    const deletedStores = await db.store.findMany({
      where: { deletedAt: { not: null } },
    })
    // Все активные магазины не должны иметь deletedAt
    expect(allStores.every((s) => s.deletedAt === null)).toBe(true)
    // Deleted stores might exist or not — just verify the filter works
    expect(Array.isArray(deletedStores)).toBe(true)
  })
})

// =========================================================
// TEST 8: CHECK constraints на БД уровне
// =========================================================
describe("E2E: CHECK constraints", () => {
  it("StoreProduct.quantity не может быть < 0", async () => {
    await expect(
      db.$queryRaw`
        INSERT INTO "StoreProduct" ("storeId", "productId", quantity, "costPrice", "sellPrice", "updatedAt")
        VALUES ('seed-store-central', 'prod-test-constraint', -1, 100, 200, NOW())
      `,
    ).rejects.toThrow() // CHECK constraint violation
  })

  it("Sale.totalAmount не может быть отрицательным", async () => {
    await expect(
      db.$queryRaw`
        INSERT INTO "Sale" (id, number, "storeId", "sellerId", "paymentMethod", "totalAmount", "totalCost", "createdAt", "updatedAt")
        VALUES ('test-check', 'S-TEST-001', 'seed-store-central', 'cmmjd65am00004s9kqn1rboug', 'CASH', -100, 0, NOW(), NOW())
      `,
    ).rejects.toThrow()
  })
})
