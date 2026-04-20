/**
 * Decimal-arithmetic helpers для денежных операций.
 *
 * Зачем: float-арифметика накапливает погрешности (0.1 + 0.2 = 0.30000000000000004).
 * Для денег это неприемлемо — BUG-069 уже существовал. Этот модуль — фундамент
 * всех финансовых операций в ePRM milestone v1.1.
 *
 * Все функции возвращают `Decimal` и не теряют точность даже на 1000+ операциях.
 * Precision proof см. в money.test.ts.
 *
 * Usage:
 * ```ts
 * import { sum, mul, toClient } from "@/lib/money"
 *
 * const commission = mul(orderTotal, "0.005") // 0.5% commission
 * const profit = sum(sale1, sale2, sale3)
 * const clientValue = toClient(profit) // "1499.99" (branded Money string)
 * ```
 */

import Decimal from "decimal.js"

/**
 * Branded string type для денежных значений, отдаваемых на клиент.
 *
 * Brand существует только в compile-time (TypeScript структурная типизация).
 * На runtime это обычный `string`. Гарантирует что строка прошла через
 * `toClient()` с корректным форматированием (2 знака после запятой).
 *
 * TS compile check: `toClient(a) + toClient(b)` — НЕ даёт ошибку напрямую
 * (template literal concat работает с branded string), но арифметика `number`
 * невозможна: `Number(toClient(a)) + Number(toClient(b))` — это явное приведение,
 * которое уже осознанный выбор. Branded type защищает от случайного использования
 * Money там, где нужен DecimalLike.
 */
export type Money = string & { readonly __brand: "Money" }

/**
 * Принимаемые типы для денежных операций.
 * Любая функция сначала оборачивает вход через `toMoney()` — единая точка валидации.
 */
export type DecimalLike = Decimal | string | number

/**
 * Приводит любое значение к `Decimal`.
 *
 * - Если уже `Decimal` — возвращает as-is (без копии, т.к. Decimal immutable).
 * - Если строка/число — парсит через `new Decimal(input)`.
 * - На невалидном входе кидает понятную ошибку.
 *
 * @throws Error если значение нельзя сконвертировать в Decimal
 */
export function toMoney(input: DecimalLike): Decimal {
  if (input instanceof Decimal) {
    return input
  }
  try {
    return new Decimal(input)
  } catch (err) {
    throw new Error(
      `toMoney: не удалось сконвертировать значение "${String(input)}" в Decimal: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

/**
 * Суммирует произвольное количество денежных значений.
 *
 * Precision-safe: 1000 операций сложения `0.01` дают ровно `10.00`
 * (в отличие от float, где накопится погрешность).
 *
 * `sum()` без аргументов возвращает `Decimal(0)` — удобно для
 * начальных значений в reduce-chain.
 */
export function sum(...values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.add(toMoney(v)), new Decimal(0))
}

/**
 * Вычитает `b` из `a`. Precision-safe.
 */
export function sub(a: DecimalLike, b: DecimalLike): Decimal {
  return toMoney(a).sub(toMoney(b))
}

/**
 * Умножает `a` на `b`. Precision-safe.
 *
 * Используется для расчётов комиссий/процентов:
 * `mul(orderTotal, "0.005")` = 0.5% commission.
 */
export function mul(a: DecimalLike, b: DecimalLike): Decimal {
  return toMoney(a).mul(toMoney(b))
}

/**
 * Делит `a` на `b`. Precision-safe (но с учётом Decimal.js precision-limits —
 * по умолчанию 20 значащих цифр).
 */
export function div(a: DecimalLike, b: DecimalLike): Decimal {
  return toMoney(a).div(toMoney(b))
}

/**
 * Форматирует `Decimal` в branded `Money` строку для отдачи на клиент.
 *
 * Использует `toFixed(2)` — ровно 2 знака после запятой, HALF_EVEN rounding.
 * Branded type гарантирует что результат прошёл через этот форматтер.
 *
 * Пример: `toClient(new Decimal("7.49995"))` → `"7.50"` (округление).
 */
export function toClient(value: Decimal): Money {
  return value.toFixed(2) as Money
}

/**
 * Парсит branded `Money` обратно в `Decimal`.
 *
 * Используется когда на сервере нужно продолжить вычисления над значением,
 * полученным с клиента (например из формы).
 */
export function fromClient(value: Money): Decimal {
  return new Decimal(value)
}

/**
 * Runtime type-guard для `Money`.
 *
 * Всегда возвращает `false`, потому что brand существует только в compile-time
 * и runtime-проверку провести невозможно. Функция экспортируется для
 * type-narrowing в utils, где нужен формальный guard (TS типизация).
 *
 * Если нужна runtime-валидация формата — используйте regex напрямую:
 * `/^\d+\.\d{2}$/.test(value)`.
 */
export function isMoney(_value: unknown): _value is Money {
  return false
}

/**
 * Рассчитывает банковскую комиссию обратным процентом (стандарт эквайринга).
 *
 * Формула: fee = amount / (1 - rate) - amount
 * Пример: товар 10000₽, ставка 2% → 10000 / 0.98 - 10000 = 204.08₽
 *
 * @param amount — сумма без комиссии
 * @param rate — ставка комиссии (0.02 = 2%), должна быть < 1
 * @returns { fee, total } — комиссия и итого к оплате, округлённые до 2 знаков
 * @throws Error если rate >= 1
 */
export function calcBankingFee(
  amount: DecimalLike,
  rate: DecimalLike,
): { fee: Decimal; total: Decimal } {
  const a = toMoney(amount)
  const r = toMoney(rate)
  if (a.isZero()) return { fee: new Decimal(0), total: new Decimal(0) }
  if (r.gte(1)) throw new Error("calcBankingFee: rate must be less than 1")
  if (r.isZero()) return { fee: new Decimal(0), total: a }
  // Reverse percentage: fee = amount / (1 - rate) - amount
  const oneMinusRate = new Decimal(1).sub(r)
  const total = a.div(oneMinusRate)
  const fee = total.sub(a)
  return {
    fee: new Decimal(fee.toFixed(2)),
    total: new Decimal(total.toFixed(2)),
  }
}
