/**
 * Custom Vitest matcher для сравнения Prisma.Decimal значений.
 *
 * Зачем: стандартный `toBe` / `toEqual` проверяет ссылочное равенство,
 * а `Prisma.Decimal` — immutable объект, два инстанса с одинаковым значением
 * НЕ равны через `toEqual`. Для денежных тестов нужен matcher, который
 * вызывает `Decimal.equals()` (numeric equality с precision-awareness).
 *
 * Usage:
 * ```ts
 * expect(new Prisma.Decimal("0.30")).toEqualDecimal("0.3")  // passes
 * expect(sum("0.1", "0.2")).toEqualDecimal("0.3")           // passes
 * ```
 *
 * Matcher загружается в vitest.config.ts через `setupFiles`.
 */

import { expect } from "vitest"
import { Prisma } from "@/generated/prisma/client"

expect.extend({
  toEqualDecimal(received: unknown, expected: Prisma.Decimal | string | number) {
    const exp = expected instanceof Prisma.Decimal ? expected : new Prisma.Decimal(expected)

    if (!(received instanceof Prisma.Decimal)) {
      return {
        pass: false,
        message: () =>
          `expected ${String(received)} to be a Prisma.Decimal, got ${typeof received}`,
      }
    }

    const pass = received.equals(exp)

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received.toString()} not to equal ${exp.toString()}`
          : `expected ${received.toString()} to equal ${exp.toString()}`,
    }
  },
})

declare module "vitest" {
  interface Assertion<T> {
    toEqualDecimal(expected: Prisma.Decimal | string | number): T
  }
  interface AsymmetricMatchersContaining {
    toEqualDecimal(expected: Prisma.Decimal | string | number): unknown
  }
}
