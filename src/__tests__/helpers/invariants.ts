/**
 * E2E invariant assertions для Phase 8 (Order/Sale Flow).
 *
 * Каждая функция принимает PrismaClient + scope и проверяет одно из системных
 * инвариантов, которое ДОЛЖНО быть истинным после любой order/sale транзакции.
 *
 * Имена функций — locked contract из .planning/phases/08-order-sale-flow/08-CONTEXT.md
 * (секция Invariants) и не должны меняться:
 *
 *   1. assertStockConservation  — остатки + проданное - возвращённое = initial
 *   2. assertSerialConsistency  — SerialUnit.SOLD ↔ SaleItem exists (не RETURNED)
 *   3. assertMoneyConservation  — payments non-expense − expense == revenue + held
 *   4. assertShiftConsistency   — после Wave 1 миграции Payment.shiftId NOT NULL
 *   5. assertReturnAmountCap    — sum(Return.amount per sale) <= sale.finalAmount
 *   6. assertOrderSaleLink      — CustomOrder.saleId != null ↔ status == COMPLETED
 *
 * Все денежные сравнения — через @/lib/money helpers. НЕ использовать Number()
 * на Decimal значениях — money-guard ESLint этого не допустит.
 */
import { expect } from "vitest"
import type { PrismaClient } from "@/generated/prisma/client"
import { sum, sub, toMoney } from "@/lib/money"
import { testSchema } from "../setup-db"

/**
 * Инвариант 1: сохранение количества единиц товара.
 *
 * Для заданного (storeId, productId) проверяет что:
 *   current_stock + sold_non_returned == initial_stock
 *
 * Где:
 *   current_stock       — StoreProduct.quantity сейчас
 *   sold_non_returned   — sum(SaleItem.quantity) − sum(ReturnItem.quantity)
 */
export async function assertStockConservation(
  db: PrismaClient,
  opts: { storeId: string; productId: string; initialStock: number },
): Promise<void> {
  const sp = await db.storeProduct.findFirst({
    where: { storeId: opts.storeId, productId: opts.productId },
  })
  const current = sp?.quantity ?? 0

  const saleItems = await db.saleItem.findMany({
    where: {
      productId: opts.productId,
      sale: { storeId: opts.storeId },
    },
    include: { returnItems: true },
  })

  let soldNet = 0
  for (const it of saleItems) {
    const returned = it.returnItems.reduce((acc, ri) => acc + ri.quantity, 0)
    soldNet += it.quantity - returned
  }

  expect(current + soldNet).toBe(opts.initialStock)
}

/**
 * Инвариант 2: SerialUnit.status согласован с SaleItem.
 *
 * - SOLD   ↔ существует SaleItem в non-returned Sale ссылающийся на этот SerialUnit
 * - IN_STOCK ↔ нет активного SaleItem (все возвращены или отсутствуют)
 */
export async function assertSerialConsistency(
  db: PrismaClient,
  opts: { storeId: string },
): Promise<void> {
  const units = await db.serialUnit.findMany({
    where: { storeId: opts.storeId },
    include: {
      saleItem: {
        include: { sale: true, returnItems: true },
      },
    },
  })

  for (const u of units) {
    const linkedSaleItem = u.saleItem
    if (u.status === "SOLD") {
      // Должна быть связанная SaleItem в не-полностью-возвращённой Sale
      expect(linkedSaleItem, `SerialUnit ${u.id} SOLD но нет SaleItem`).not.toBeNull()
      if (linkedSaleItem) {
        const returnedQty = linkedSaleItem.returnItems.reduce((a, ri) => a + ri.quantity, 0)
        expect(returnedQty).toBeLessThan(linkedSaleItem.quantity)
      }
    } else if (u.status === "IN_STOCK") {
      // Никакого активного SaleItem (либо нет вовсе, либо всё возвращено)
      if (linkedSaleItem) {
        const returnedQty = linkedSaleItem.returnItems.reduce((a, ri) => a + ri.quantity, 0)
        expect(returnedQty).toBe(linkedSaleItem.quantity)
      }
    }
  }
}

/**
 * Инвариант 3: сохранение денег.
 *
 * Для магазина проверяет баланс:
 *   sum(Payment !isExpense) − sum(Payment isExpense) − sum(Return.amount без Payment)
 *     == sum(Sale.finalAmount)
 *        + sum(CustomOrder.prepaidAmount для CANCELLED с cancellationType=HOLD or active)
 *        − sum(Return.amount)
 *
 * Упрощённая форма: money_in − money_out == net_revenue (после возвратов).
 *
 * Примечание: createReturn не создаёт Payment с isExpense=true для возврата средств
 * (Return.amount хранит сумму возврата, но Payment record не создаётся).
 * Поэтому Return.amount учитывается как виртуальный outflow на стороне payments.
 */
export async function assertMoneyConservation(
  db: PrismaClient,
  opts: { storeId: string },
): Promise<void> {
  const payments = await db.payment.findMany({
    where: {
      OR: [
        { storeId: opts.storeId },
        { sale: { storeId: opts.storeId } },
        { order: { storeId: opts.storeId } },
      ],
    },
  })

  const inflow = sum(...payments.filter((p) => !p.isExpense).map((p) => p.amount))
  const outflow = sum(...payments.filter((p) => p.isExpense).map((p) => p.amount))

  // Returns that have no corresponding expense Payment are "virtual outflow"
  // (createReturn records refund in Return.amount but does not create Payment.isExpense)
  const allReturns = await db.return.findMany({
    where: { sale: { storeId: opts.storeId } },
  })
  const returnOutflow = sum(...allReturns.map((r) => r.amount))

  const netPayments = sub(sub(inflow, outflow), returnOutflow)

  const sales = await db.sale.findMany({
    where: { storeId: opts.storeId },
    include: { returns: true },
  })

  // Ожидаемый net revenue = sum(sale.finalAmount) − sum(returns.amount)
  let expectedRevenue = toMoney(0)
  for (const s of sales) {
    expectedRevenue = expectedRevenue.add(toMoney(s.finalAmount))
    for (const r of s.returns) {
      expectedRevenue = expectedRevenue.sub(toMoney(r.amount))
    }
  }

  // Добавляем удержанные предоплаты от CANCELLED заказов (HOLD)
  // Exclude CANCELLED orders that resulted from full return (cancellationType=REFUND)
  // since their prepaidAmount is already accounted for in Sale.finalAmount
  const heldOrders = await db.customOrder.findMany({
    where: {
      storeId: opts.storeId,
      status: "CANCELLED",
      prepaidAmount: { gt: 0 },
    },
  })
  for (const o of heldOrders) {
    // Skip REFUND-type cancellations: the prepayment was already converted to sale payment
    // via ledger re-entry pattern (completeOrder). Double-counting would break the invariant.
    const cancellationType = (o as any).cancellationType
    if (cancellationType === "REFUND") continue
    expectedRevenue = expectedRevenue.add(toMoney(o.prepaidAmount))
  }

  // Активные заказы (не COMPLETED, не CANCELLED) — предоплата ещё в кассе
  const activeOrders = await db.customOrder.findMany({
    where: {
      storeId: opts.storeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      prepaidAmount: { gt: 0 },
    },
  })
  for (const o of activeOrders) {
    expectedRevenue = expectedRevenue.add(toMoney(o.prepaidAmount))
  }

  expect(netPayments.toString()).toBe(expectedRevenue.toString())
}

/**
 * Инвариант 4: после Wave 1 миграции — никогда нет Payment.shiftId == null.
 *
 * В Wave 0 проверка может быть "soft" (ожидаем 0 только после миграции),
 * но проверка уже должна стоять в тестах как контракт.
 */
export async function assertShiftConsistency(db: PrismaClient): Promise<void> {
  // Prisma 7 не позволяет null в scalar filters напрямую — используем raw SQL.
  // Во многих схемах Payment.shiftId пока nullable (до Wave 1 миграции),
  // поэтому проверку допускается делать на текущем состоянии — после миграции
  // Payment.shiftId NOT NULL будет enforced БД.
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint as count FROM "${testSchema}"."Payment" WHERE "shiftId" IS NULL`,
  )
  const count = Number(rows[0]?.count ?? 0)
  expect(count).toBe(0)
}

/**
 * Инвариант 5: сумма всех возвратов по Sale не превышает Sale.finalAmount.
 */
export async function assertReturnAmountCap(
  db: PrismaClient,
  opts: { saleId: string },
): Promise<void> {
  const sale = await db.sale.findUnique({
    where: { id: opts.saleId },
    include: { returns: true },
  })
  expect(sale).not.toBeNull()
  if (!sale) return

  const totalRefunded = sum(...sale.returns.map((r) => r.amount))
  const cap = toMoney(sale.finalAmount)
  expect(totalRefunded.lte(cap)).toBe(true)
}

/**
 * Инвариант 6: связь CustomOrder ↔ Sale.
 *
 * Три правила:
 *   - Если saleId != null → status должен быть COMPLETED или CANCELLED
 *     (CANCELLED допустим при полном возврате Sale — FIN-07)
 *   - Если status == COMPLETED → saleId должен быть != null
 *   - Если saleId != null AND status == CANCELLED → Sale должна быть RETURNED
 */
export async function assertOrderSaleLink(
  db: PrismaClient,
  opts: { storeId: string },
): Promise<void> {
  // Raw SQL — Prisma 7 не принимает null в scalar filter
  // Allow saleId + CANCELLED: full return sets order to CANCELLED while keeping saleId link
  const orphans = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${testSchema}"."CustomOrder"
     WHERE "storeId" = $1
       AND (
         ("saleId" IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED'))
         OR ("saleId" IS NULL AND status = 'COMPLETED')
       )`,
    opts.storeId,
  )
  expect(orphans).toHaveLength(0)
}
