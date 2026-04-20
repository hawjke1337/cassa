/**
 * Per-unit discount computation для заказов (FIN-08).
 *
 * Зачем: order-level discount D распределяется между позициями пропорционально
 * весу `price × quantity`. Чтобы избежать drift от округления (sum остатков
 * не совпадает с D), используется residual pattern: все позиции кроме
 * последней получают округлённую долю, последняя поглощает остаток.
 *
 * Гарантия: `sum(perUnit[i] × items[i].quantity) === totalDiscount` (на уровне
 * Decimal, до 2 знаков после запятой).
 *
 * Pure function: без I/O, без Prisma, без side effects. Используется в
 * completeOrder (Wave 2) и при создании частичных Return на заказах.
 *
 * Все операции через `@/lib/money` helpers — money-guard ESLint активен,
 * bare Number()/parseFloat() запрещены.
 */

import { Prisma } from "@/generated/prisma/client"
import { sum, sub, mul, div, toMoney, type DecimalLike } from "@/lib/money"

export interface DiscountItem {
  /** Цена за единицу (Decimal или строка). */
  price: DecimalLike
  /** Количество штук в позиции. Должно быть > 0. */
  quantity: number
}

/**
 * Распределяет `totalDiscount` между `items` пропорционально `price × quantity`.
 *
 * Возвращает массив per-unit скидок той же длины что `items` (в том же порядке).
 * Каждое значение — скидка НА ЕДИНИЦУ позиции (не на всю позицию):
 *   lineDiscount = perUnit[i] × items[i].quantity
 *
 * Округление: line-level до 2 знаков (копейки), per-unit до 4 знаков для
 * внутренней точности.
 *
 * Edge cases:
 *   - `totalDiscount === 0` → массив нулей (fast path)
 *   - `items.length === 0` → пустой массив
 *   - `items.length === 1` → вся скидка на единственную позицию
 *   - Все цены 0 → делить на ноль нельзя, возвращаем нули (нечего распределять)
 *
 * @param items - позиции с price/quantity
 * @param totalDiscount - суммарная скидка заказа (Decimal)
 * @returns массив per-unit скидок, `result[i]` = скидка на единицу items[i]
 *
 * @example
 *   computePerUnitDiscount(
 *     [{ price: "100", quantity: 1 }, { price: "100", quantity: 1 }, { price: "100", quantity: 1 }],
 *     toMoney("99"),
 *   )
 *   // → [Decimal(33), Decimal(33), Decimal(33)]
 *   // sum = 99, residual покрывает drift если distributions неровные
 */
export function computePerUnitDiscount(
  items: DiscountItem[],
  totalDiscount: Prisma.Decimal,
): Prisma.Decimal[] {
  // Fast path: нулевая скидка — массив нулей.
  if (totalDiscount.eq(0)) {
    return items.map(() => new Prisma.Decimal(0))
  }

  if (items.length === 0) {
    return []
  }

  // Вес каждой позиции = price × quantity (line total до скидки).
  const lineTotals = items.map((item) => mul(toMoney(item.price), item.quantity))
  const grandTotal = sum(...lineTotals)

  // Защита от деления на ноль: если все цены 0, распределять нечего.
  if (grandTotal.eq(0)) {
    return items.map(() => new Prisma.Decimal(0))
  }

  const perUnit: Prisma.Decimal[] = []
  // `allocated` хранит СУММУ уже распределённых line-discount значений,
  // где lineDiscount[i] = perUnit[i] × quantity[i] (с учётом округления per-unit
  // до 2 знаков). Это реальная сумма скидки "как она будет записана в БД",
  // поэтому residual вычитает именно её, а не pre-rounding значения.
  let allocated = new Prisma.Decimal(0)

  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1
    let lineDiscount: Prisma.Decimal
    let perUnitValue: Prisma.Decimal

    if (isLast) {
      // Residual: последняя позиция поглощает весь rounding drift.
      // sum_real = allocated + lineDiscount(last) === totalDiscount.
      lineDiscount = sub(totalDiscount, allocated)
      // Для последней позиции per-unit НЕ округляем — так инвариант
      // perUnit × quantity === lineDiscount выполняется точно, даже если
      // lineDiscount не делится ровно на quantity.
      perUnitValue = div(lineDiscount, items[i].quantity)
    } else {
      // Пропорциональное распределение по весу price × quantity.
      // Округляем per-unit до копеек, затем пересчитываем реальный line discount.
      const rawLine = div(mul(totalDiscount, lineTotals[i]), grandTotal)
      perUnitValue = div(rawLine, items[i].quantity).toDecimalPlaces(2)
      // Реальный line discount после per-unit округления — он идёт в allocated.
      lineDiscount = mul(perUnitValue, items[i].quantity)
      allocated = sum(allocated, lineDiscount)
    }

    perUnit.push(perUnitValue)
  }

  return perUnit
}
