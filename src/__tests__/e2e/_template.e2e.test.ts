/**
 * E2E TEST TEMPLATE — реальная БД
 *
 * Скопируйте этот файл и переименуйте под свою фичу:
 *   cp _template.e2e.test.ts моя-фича.e2e.test.ts
 *
 * Полное руководство: docs/E2E-TESTING.md
 *
 * Что важно знать:
 *   1. TRUNCATE происходит в глобальном beforeEach (setup-db.ts) —
 *      каждый it() начинается с пустой БД, никакого ручного cleanup.
 *   2. Денежные поля передавайте как string ('1499.99'), не number.
 *   3. Сравнение Decimal — через expect(...).toEqualDecimal('...').
 *   4. Импорт db ТОЛЬКО из '../helpers/db' (test-scoped client).
 *   5. test.concurrent ЗАПРЕЩЁН — schema делится между тестами одного worker'а.
 */

import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestProduct,
  createTestStoreProduct,
} from "../helpers/fixtures"

describe("Template: моя фича", () => {
  it("создаёт StoreProduct и сохраняет quantity + Decimal precision", async () => {
    // 1. ARRANGE — создать данные
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const product = await createTestProduct()
    const sp = await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1499.99",
      costPrice: "999.50",
      quantity: 5,
    })

    // 2. ACT — выполнить тестируемое действие
    // Здесь обычно: вызов server action, db query, или комбинация
    const fetched = await db.storeProduct.findUnique({ where: { id: sp.id } })

    // 3. ASSERT — проверить результат
    expect(fetched).not.toBeNull()
    expect(fetched?.quantity).toBe(5)
    expect(fetched?.sellPrice).toEqualDecimal("1499.99") // ← matcher из Plan 02
    expect(user.id).toBeDefined() // user используется ниже в реальных тестах
  })

  it("второй тест начинается с чистой БД (TRUNCATE автоматический)", async () => {
    // Доказательство что предыдущий тест не оставил данных.
    // В реальных тестах эта проверка не нужна — это просто демонстрация.
    const storeCount = await db.store.count()
    const productCount = await db.product.count()
    expect(storeCount).toBe(0)
    expect(productCount).toBe(0)
  })
})
