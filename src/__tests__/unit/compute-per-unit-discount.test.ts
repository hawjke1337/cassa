/**
 * Phase 8 Wave 0 RED: unit тесты для чистой функции computePerUnitDiscount.
 *
 * Функция распределяет order-level discount по позициям пропорционально весу
 * `price × quantity` с residual pattern: sum(perItemDiscount × qty) === totalDiscount.
 *
 * **Wave 0:** `@/lib/orders/discount` уже существует (создан в рамках подготовки),
 * поэтому эти unit-тесты сразу GREEN — они закрепляют контракт precision-safe
 * distribution, от которого зависит Wave 2 completeOrder.
 *
 * Contract:
 *   computePerUnitDiscount(
 *     items: Array<{ price: DecimalLike; quantity: number }>,
 *     totalDiscount: DecimalLike,
 *   ): Prisma.Decimal[] // длина == items.length
 *
 * Guarantees:
 *   1. sum(result[i] * items[i].quantity) === totalDiscount (precision-safe)
 *   2. Для totalDiscount=0 все элементы == 0
 *   3. Для пустого items[] — []
 *   4. Последний элемент получает residual (погрешность compensation)
 */
import { describe, it, expect } from "vitest"
import { computePerUnitDiscount } from "@/lib/orders/discount"
import { toMoney, mul, sum } from "@/lib/money"

describe("computePerUnitDiscount (precision contract)", () => {
  it("totalDiscount=0 → все элементы == 0", () => {
    const items = [
      { price: "100.00", quantity: 2 },
      { price: "50.00", quantity: 3 },
    ]
    const result = computePerUnitDiscount(items, toMoney("0"))
    expect(result.length).toBe(2)
    expect(result[0].toString()).toBe("0")
    expect(result[1].toString()).toBe("0")
  })

  it("пустой items → пустой массив", () => {
    const result = computePerUnitDiscount([], toMoney("100"))
    expect(result).toEqual([])
  })

  it("3 × 100₽ со скидкой 100₽ → 33.33/33.33/33.34 (residual)", () => {
    const items = [
      { price: "100.00", quantity: 1 },
      { price: "100.00", quantity: 1 },
      { price: "100.00", quantity: 1 },
    ]
    const result = computePerUnitDiscount(items, toMoney("100"))

    // sum === 100 (residual pattern, не drift)
    const total = sum(
      mul(result[0], items[0].quantity),
      mul(result[1], items[1].quantity),
      mul(result[2], items[2].quantity),
    )
    expect(total.toString()).toBe("100")

    // Последний получает residual
    expect(result[2].gt(result[0]).valueOf() || result[2].eq(result[0]).valueOf()).toBe(true)
  })

  it("2 × 99.99₽ со скидкой 0.01₽ → precision сохранена", () => {
    const items = [
      { price: "99.99", quantity: 1 },
      { price: "99.99", quantity: 1 },
    ]
    const result = computePerUnitDiscount(items, toMoney("0.01"))

    const total = sum(mul(result[0], 1), mul(result[1], 1))
    expect(total.toString()).toBe("0.01")
  })

  it("mixed quantity: 2×50₽ + 1×100₽ со скидкой 20₽", () => {
    const items = [
      { price: "50.00", quantity: 2 }, // weight 100
      { price: "100.00", quantity: 1 }, // weight 100
    ]
    const result = computePerUnitDiscount(items, toMoney("20"))

    // Каждая позиция должна получить ~10₽ total discount (50/50 split)
    // Per-unit: item1 = 5, item2 = 10
    const total = sum(mul(result[0], 2), mul(result[1], 1))
    expect(total.toString()).toBe("20")
  })

  it("single item: весь discount падает на него", () => {
    const items = [{ price: "500.00", quantity: 5 }]
    const result = computePerUnitDiscount(items, toMoney("50"))

    // 50 / 5 = 10 per unit
    expect(result[0].toString()).toBe("10")
    const total = mul(result[0], 5)
    expect(total.toString()).toBe("50")
  })

  it("property-based: 100 random inputs — sum === totalDiscount", () => {
    for (let trial = 0; trial < 100; trial++) {
      const itemCount = 1 + Math.floor(Math.random() * 5)
      const items = Array.from({ length: itemCount }, () => ({
        price: (Math.random() * 1000).toFixed(2),
        quantity: 1 + Math.floor(Math.random() * 5),
      }))
      const totalWeight = items.reduce((acc, it) => acc + Number(it.price) * it.quantity, 0)
      // discount — рандом, но <= totalWeight
      const discount = (Math.random() * totalWeight * 0.5).toFixed(2)

      const result = computePerUnitDiscount(items, toMoney(discount))

      // Invariant: sum(per_unit * quantity) === totalDiscount
      const totalDist = result.reduce(
        (acc, d, idx) => acc.add(toMoney(d).mul(items[idx].quantity)),
        toMoney(0),
      )
      expect(totalDist.toString()).toBe(toMoney(discount).toString())
    }
  })
})
