/**
 * E2E Example Test — эталон для копирования в последующих фазах.
 *
 * Что доказывает:
 * 1. Инфраструктура работает: schema создаётся, миграции применяются, db подключается
 * 2. TRUNCATE CASCADE между тестами очищает данные (тест 2 видит 0 users)
 * 3. Decimal-поля сохраняют точность: '1499.99' persist → read → '1499.99'
 *
 * Шаблон для новых E2E тестов:
 *   1. Создать файл в `src/__tests__/e2e/<feature>.e2e.test.ts`
 *   2. import { db } from '../helpers/db'
 *   3. import { createTestStore, ... } from '../helpers/fixtures'
 *   4. Никакого cleanup — TRUNCATE автоматически перед каждым тестом
 */
import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
} from "../helpers/fixtures"

describe("E2E example: реальная БД", () => {
  it("создаёт магазин и пользователя — данные персистятся", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const found = await db.user.findUnique({ where: { id: user.id } })
    expect(found).not.toBeNull()
    expect(found?.login).toBe(user.login)

    // UserStore junction создан
    const link = await db.userStore.findUnique({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
    })
    expect(link).not.toBeNull()
  })

  it("TRUNCATE между тестами — предыдущий тест не виден", async () => {
    const userCount = await db.user.count()
    const storeCount = await db.store.count()
    expect(userCount).toBe(0)
    expect(storeCount).toBe(0)
  })

  it("создаёт StoreProduct с Decimal-полями — точность сохраняется", async () => {
    const store = await createTestStore()
    const category = await createTestCategory({ name: "Test Cat" })
    const product = await createTestProduct({ categoryId: category.id })
    const sp = await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1499.99",
      costPrice: "999.50",
      quantity: 10,
    })

    // Точность Decimal сохраняется после roundtrip
    expect(sp.sellPrice.toString()).toBe("1499.99")
    // 999.50 → Prisma нормализует до "999.5"
    expect(sp.costPrice.toString()).toBe("999.5")
    expect(sp.quantity).toBe(10)

    // Roundtrip: read back and verify
    const fetched = await db.storeProduct.findUnique({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
    })
    expect(fetched?.sellPrice.toString()).toBe("1499.99")
  })
})
