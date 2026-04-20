# Phase 8: Order/Sale Flow & Предоплаты — Research

**Researched:** 2026-04-08
**Domain:** Order lifecycle, prepayments, returns, cash operations, stock/серийники consistency
**Confidence:** HIGH (codebase анализирован напрямую; требования BUG-024..057 чёткие)

## Summary

Phase 8 закрывает 12 требований FIN-01..FIN-12 из баг-репорта v1.0. Все они — реальные утечки денег или data-integrity дыры в текущей реализации `src/actions/orders.ts` и `src/actions/sales.ts`. Анализ кода выявил **системные**, а не точечные баги:

1. **Завершение заказа не трогает stock** — `updateOrderStatus(..., "COMPLETED")` и `payAndChangeStatus(..., "COMPLETED")` создают `Sale` из `CustomOrder.items`, но **не декрементят `StoreProduct.quantity`** для несерийных позиций (FIN-02). Это прямой дубликат остатков: товар продан дважды.
2. **`cancelOrder` всегда стирает предоплату без выбора оператора** — `payment.deleteMany()` + `prepaidAmount: 0`, но никакой `CashOperation` изъятие не создаётся и нет флага «удержать/вернуть» (FIN-04..06).
3. **`Payment.shiftId` nullable** — в схеме `shiftId String?`; `payAndChangeStatus` и `addOrderPayment` делают `shiftId ?? null` если смена закрыта (FIN-11).
4. **`Sale.finalAmount` не учитывает предоплату** — формула `sub(totalAmount, discount)` без вычитания `prepaidAmount` (FIN-01).
5. **Нет валидации `totalPaid > totalAmount`** — любая сумма платежа проходит (FIN-12).
6. **`Return.refundMethod` nullable** — `refundMethod PaymentMethod?` в схеме; нет валидации соответствия оригинальному Payment (FIN-09).
7. **Нет sync `Sale.status` ↔ `CustomOrder.status` при возврате** — после `createReturn` Sale становится `RETURNED`, но `CustomOrder` остаётся `COMPLETED` (FIN-07).
8. **Per-unit discount для заказов не реализован** — в `updateOrderStatus` SaleItem создаётся с `discount: 0`, нет прораты order-level скидки на строки (FIN-08 для orders).

**Primary recommendation:** Переписать три hot-функции (`updateOrderStatus`, `payAndChangeStatus`, `cancelOrder`) в единый набор атомарных операций `completeOrder` / `cancelOrderWithDecision` / `createReturn`, со shared helper `applyStockChanges(tx, items, direction)`. Все операции внутри `db.$transaction`. Сделать миграцию `Payment.shiftId → NOT NULL` и `Return.refundMethod → NOT NULL` с backfill. E2E-покрытие на реальной БД обязательно — моки пропустили все эти баги в v1.0.

## User Constraints

CONTEXT.md не создавался (фаза инициируется напрямую research-phase). Ограничений от пользователя нет — все решения в дискреции Claude, с опорой на:

- **CLAUDE.md**: НЕ MVP, production-grade, TDD обязательно, Awwwards-уровень (для UI решения cancel dialog)
- **STATE.md: Предоплата невозвратная** — default поведение = удержать; «вернуть» явный выбор оператора
- **STATE.md: E2E на реальной БД обязательны в каждой фазе v1.1** — паттерн `e2e-real-db.test.ts`
- **STATE.md: Decimal.js везде** — money-guard ESLint активен для hotspot-файлов, sales.ts и orders.ts уже частично мигрированы (Phase 7)

## Phase Requirements

| ID     | Description                                               | Research Support                                                                                                                                                                                                                                                   |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FIN-01 | Sale.finalAmount = totalAmount − discount − prepaidAmount | `updateOrderStatus` line 349, 393: текущее `sub(totalAmount, discount)` — нужен ещё `sub(..., prepaidAmount)`. ⚠️ Семантика спорна (см. Open Questions #1).                                                                                                        |
| FIN-02 | Stock декрементится при completion                        | **КРИТИЧНО:** в `orders.ts` вообще нет `storeProduct.update({quantity: decrement})`. Нужно портировать pattern из `sales.ts:314-323` с `FOR UPDATE` lock (pattern из `sales.ts:149-157`).                                                                          |
| FIN-03 | SerialUnits → SOLD                                        | `orders.ts:423-439` и `703-719` — уже сделано, но при early transaction error может быть partial rollback. Перепроверить atomicity.                                                                                                                                |
| FIN-04 | Явный выбор «удержать / вернуть» при cancel               | Нужен новый параметр `cancelOrder(orderId, prepaymentAction: "HOLD" \| "REFUND")`, UI dialog расширяется RadioGroup. Default = HOLD.                                                                                                                               |
| FIN-05 | «Вернуть» → CashOperation + Payment isExpense=true        | В tx: `tx.cashOperation.create({type: "WITHDRAW", amount, shiftId, reason: "Возврат предоплаты по заказу"})` + `tx.payment.create({orderId, method: original.method, amount, isExpense: true, shiftId})`. Требует OPEN shift — блок если нет.                      |
| FIN-06 | «Удержать» → Payment остаётся, видна как доход            | Не удалять payments. `CustomOrder.status = CANCELLED`, но payments живы — Phase 10 (reports) должна видеть эту сумму. Пометить payments отдельным флагом? Обсудить в plan.                                                                                         |
| FIN-07 | Sync Order ↔ Sale status при возврате                     | `createReturn` (sales.ts:721-726) обновляет Sale. Добавить: если `sale.customOrder` существует, в том же tx обновить `customOrder.status` → `CANCELLED` или новый статус `REFUNDED`.                                                                               |
| FIN-08 | Per-unit discount refund                                  | `sales.ts:640` — уже computes `(price-discount)×qty` где discount per-unit. **Gap:** order completion создаёт SaleItem с `discount: 0` (orders.ts:402, 684). Нужно: при order-level скидке, пропорционально распределить на SaleItem.discount по весу `price×qty`. |
| FIN-09 | `refundMethod` NOT NULL + валидация                       | Schema migration: `refundMethod PaymentMethod` (убрать `?`); backfill existing NULL → производный от Payment.method; валидация в `createReturn`: `refundMethod` ∈ set(original payments methods).                                                                  |
| FIN-10 | Atomic Return midway failure                              | `createReturn` уже в `db.$transaction`. Нужно проверить: если `tx.serialUnit.update` fails в середине loop, Prisma откатит всё? **Да** — Prisma interactive transactions откатывают при throw. Добавить E2E для proof.                                             |
| FIN-11 | `shiftId NOT NULL` для Payment заказа                     | Schema migration `Payment.shiftId` → NOT NULL (с guard: нельзя `payAndChangeStatus` если нет OPEN shift). Текущий код: `const shiftId = openShift?.id ?? null` — throw вместо.                                                                                     |
| FIN-12 | Переплата блокируется                                     | В `payAndChangeStatus` и `addOrderPayment`: `if (sum(existing_payments, new_payment).gt(order.totalAmount)) throw`.                                                                                                                                                |

## Current State Analysis

### Ключевые файлы и функции

| Файл                                     | Функция                       | Строки    | Назначение                                                                                                             |
| ---------------------------------------- | ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/actions/orders.ts`                  | `VALID_TRANSITIONS`           | 13-22     | State machine: NEW→PREPAID→ORDERED→IN_TRANSIT→ARRIVED→READY_FOR_PICKUP→COMPLETED                                       |
| `src/actions/orders.ts`                  | `updateOrderStatus`           | 281-460   | Основной state transition; создаёт Sale при COMPLETED **без декремента stock**; Supplier debt при ORDERED              |
| `src/actions/orders.ts`                  | `payAndChangeStatus`          | 579-725   | Добавляет payment + смена статуса; тоже создаёт Sale при COMPLETED **без декремента stock**                            |
| `src/actions/orders.ts`                  | `addOrderPayment`             | 759-803   | Добавляет payment без смены статуса; `shiftId ?? null`                                                                 |
| `src/actions/orders.ts`                  | `cancelOrder`                 | 911-977   | **Всегда стирает payments через deleteMany** — нет выбора удержать/вернуть                                             |
| `src/actions/sales.ts`                   | `createSale`                  | 123-362   | Reference implementation: `FOR UPDATE` lock, decrement stock, SerialUnit → SOLD, Zod validation, required OPEN shift   |
| `src/actions/sales.ts`                   | `createReturn`                | 581-736   | Per-unit refund calc ✓, restore stock ✓, status update ✓, **refundMethod nullable**, **не синхронизирует CustomOrder** |
| `src/components/orders/order-detail.tsx` | `CancelDialog`                | 1218-1266 | Текущий UI: только textarea reason. Нужно добавить RadioGroup с «Удержать / Вернуть»                                   |
| `src/components/pos/return-form.tsx`     | Return UI                     | 1-421     | Форма возврата из POS. Проверить есть ли выбор refundMethod — нужно сделать required.                                  |
| `src/lib/money.ts`                       | `sum, sub, mul, div, toMoney` | —         | Decimal helpers (Phase 7) — использовать ВСЕГДА, money-guard blocks bare Number()                                      |
| `src/lib/counters.ts`                    | `getNextNumber('S'\|'R', tx)` | —         | Атомарная нумерация Sale/Return внутри tx                                                                              |

### Schema findings (`prisma/schema.prisma`)

```prisma
model Sale {                            // line 242
  totalAmount    Decimal  @db.Decimal(12, 2)
  discountAmount Decimal  @default(0)
  finalAmount    Decimal  @db.Decimal(12, 2)   // FIN-01 semantic question
  shiftId        String?                        // already nullable (for SetNull cascade)
  status         SaleStatus @default(COMPLETED)
  customOrder    CustomOrder?                   // via Sale.saleId unique back-ref
}

model Payment {                          // line 306
  saleId    String?
  orderId   String?
  repairId  String?
  isExpense Boolean @default(false)
  shiftId   String?    // ← FIN-11: migrate to NOT NULL
  // Phase 15 (DATA2-01) also wants CHECK: exactly one of (saleId, orderId, repairId)
}

model Return {                           // line 339
  refundMethod PaymentMethod?  // ← FIN-09: migrate to NOT NULL
  shiftId      String?
}

model CustomOrder {                      // line 542
  totalAmount     Decimal
  prepaidAmount   Decimal @default(0)    // aggregate counter, обновляется в addOrderPayment
  finalAmount     Decimal?               // пока = totalAmount - discount (без prepaid)
  saleId          String? @unique        // связь с Sale после completion
  status          CustomOrderStatus
}

enum CustomOrderStatus {
  NEW, PREPAID, ORDERED, IN_TRANSIT, ARRIVED, READY_FOR_PICKUP, COMPLETED, CANCELLED
  // ⚠️ Нет REFUNDED — нужно решить: добавить или переиспользовать CANCELLED
}

model CashOperation {                    // line 1083
  shiftId String   // уже NOT NULL ✓
  type    CashOpType  // DEPOSIT / WITHDRAW (уточнить enum)
}
```

### Gap Analysis Matrix

| Success Criterion                                                           | Текущее поведение                                                | Gap                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| **1.** Завершение с предоплатой 5000/30000 → finalAmount=25000, stock, SOLD | finalAmount=30000, stock не декрементится, SOLD только для серий | Полностью сломано: FIN-01, FIN-02             |
| **2.** Cancel: явный выбор Hold/Refund                                      | Всегда стирает payments                                          | Полностью отсутствует: FIN-04, FIN-05, FIN-06 |
| **3.** Partial return per-unit                                              | В POS работает; в orders → Sale discount=0 hardcoded             | Частично сломано: FIN-08 (order path)         |
| **4.** No pay without open shift; overpay blocked                           | `shiftId ?? null`, overpay не проверяется                        | Сломано: FIN-11, FIN-12                       |
| **5.** Return midway atomic + refundMethod required                         | tx atomic ✓, refundMethod nullable ✗                             | Частично: FIN-09, FIN-10 (proof only)         |
| **6.** E2E coverage                                                         | Нет ни одного теста для orders flow                              | 0% coverage — нужно с нуля                    |

## Standard Stack

### Core (already in project, используем as-is)

| Library                         | Version | Purpose                                     | Why Standard                                         |
| ------------------------------- | ------- | ------------------------------------------- | ---------------------------------------------------- |
| Prisma                          | 7.x     | ORM, `$transaction` interactive mode        | Проект уже на нём                                    |
| Decimal.js (via Prisma.Decimal) | —       | Money arithmetic                            | Phase 7 migration — через `src/lib/money.ts` helpers |
| Zod                             | latest  | Input validation (client payload stripping) | Паттерн из `createSale` — `createSaleSchema.parse()` |
| Vitest                          | 3.x     | Unit + E2E                                  | Phase 7 infra                                        |

### Supporting

| Library             | Version  | Purpose                              | When to Use                              |
| ------------------- | -------- | ------------------------------------ | ---------------------------------------- |
| `@/lib/money`       | internal | `sum/sub/mul/div/toMoney`            | Все money расчёты — money-guard enforced |
| `@/lib/counters`    | internal | `getNextNumber(prefix, tx)`          | Нумерация S/R внутри tx                  |
| `@/lib/permissions` | internal | `requirePermission, checkPermission` | `orders.manage` для всех mutations       |

### UI

| Library                                           | Version | Purpose                            |
| ------------------------------------------------- | ------- | ---------------------------------- |
| shadcn/ui Dialog, RadioGroup, AlertDialog, Select | latest  | CancelDialog с выбором Hold/Refund |
| `Ban`, `HandCoins` from lucide-react              | —       | Icons (уже в use)                  |

**Installation:** ничего нового ставить не нужно — всё в проекте.

## Architecture Patterns

### Recommended Pattern: Atomic Transition с Compensating Actions

**Ядро:** каждая order-транзиция = одна `db.$transaction` interactive, содержащая:

1. Re-fetch и lock ресурсов (`FOR UPDATE`)
2. Validation (shift, overpay, transitions)
3. Write (status, payments, sale, stock, serial)
4. History / audit
5. Throw на любой violation → Prisma автоматически откатит ВСЁ

### Pattern 1: Stock Lock & Decrement (копировать из createSale)

```typescript
// Source: src/actions/sales.ts:148-157, 313-323
const productIds = order.items
  .filter((i) => !i.serialUnitId && i.productId)
  .map((i) => i.productId!)
if (productIds.length > 0) {
  await tx.$queryRaw`
    SELECT sp."productId", sp.quantity FROM "StoreProduct" sp
    WHERE sp."storeId" = ${order.storeId} AND sp."productId" = ANY(${productIds}::text[])
    FOR UPDATE OF sp
  `
}
for (const item of order.items) {
  if (!item.serialUnitId && item.productId) {
    await tx.storeProduct.update({
      where: { storeId_productId: { storeId: order.storeId, productId: item.productId } },
      data: { quantity: { decrement: item.quantity } },
    })
  }
}
```

### Pattern 2: Prepayment Decision (новый)

```typescript
// completeOrder: учёт prepayment
const prepaidAmount = toMoney(order.prepaidAmount)
const discount = toMoney(discountAmount ?? 0)
const finalAmount = sub(sub(order.totalAmount, discount), prepaidAmount)
// ⚠️ FIN-01 семантика: если finalAmount = "сколько ещё собрать" — OK.
//    Если finalAmount = "итоговая цена чека" — тогда = totalAmount - discount.
//    Обсудить в plan-phase (Open Question #1).

// cancelOrderWithDecision
if (action === "HOLD") {
  // payments остаются; prepaidAmount не обнуляем (сохраняем в истории)
  await tx.customOrder.update({ where: { id }, data: { status: "CANCELLED" } })
  // Note: эти payments должны быть видны в доходах (Phase 10 reports)
} else if (action === "REFUND") {
  const openShift = await tx.shift.findFirst({ where: { storeId, status: "OPEN" } })
  if (!openShift) throw new Error("Для возврата предоплаты откройте смену")

  // Для каждого original payment — compensating entry
  for (const p of order.payments) {
    if (p.method === "CASH") {
      await tx.cashOperation.create({
        data: {
          shiftId: openShift.id,
          type: "WITHDRAW", // ⚠️ verify enum имя
          amount: p.amount,
          reason: `Возврат предоплаты по заказу ${order.number}`,
          performedById: session.user!.id,
        },
      })
    }
    await tx.payment.create({
      data: {
        orderId: order.id,
        method: p.method,
        amount: p.amount,
        isExpense: true,
        shiftId: openShift.id,
      },
    })
  }
  await tx.customOrder.update({ where: { id }, data: { status: "CANCELLED", prepaidAmount: 0 } })
}
```

### Pattern 3: Per-unit Discount Proration (для orders)

```typescript
// При completion order с order-level discount D:
// прорастрачиваем D на items пропорционально весу price*quantity
const lineWeights = order.items.map((i) => mul(i.price, i.quantity))
const totalWeight = sum(...lineWeights) // == order.totalAmount before discount
// per-unit discount для item[i] = (lineWeight[i] / totalWeight * D) / quantity[i]
// Округление: использовать Decimal с 2 знаками; накапливать residual на последнюю позицию,
//             чтобы sum(perUnit × qty) === totalDiscount (precision-safe)
```

### Anti-Patterns to Avoid

- **Float арифметика для money** — блокируется ESLint money-guard, но на всякий случай: никаких `Number(decimal)`, только helpers.
- **`deleteMany` как способ «отката» payment** — теряет audit trail; использовать compensating entries.
- **Проверка shift через nullable `shiftId ?? null`** — throw немедленно, не откладывать.
- **Разделение stock decrement от Sale.create** — должны быть в одной tx с `FOR UPDATE` lock перед обоими.
- **Сравнение Decimal через `>`/`===`** — использовать `.gt()/.eq()` методы.
- **`deleteMany`-based cancel** — текущий `cancelOrder` удаляет payments без audit следа.

## Don't Hand-Roll

| Problem             | Don't Build                                  | Use Instead                                                                      | Why                                                                         |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Row locking         | `SELECT ... WHERE` + application-level check | `SELECT ... FOR UPDATE` via raw SQL (Prisma не поддерживает pessimistic locking) | Паттерн уже в `sales.ts:149` — race-free                                    |
| Atomic numbering    | `MAX(number)+1`                              | `getNextNumber(prefix, tx)` из `src/lib/counters.ts`                             | Phase 2/3 уже решили — raw SQL `INSERT ... ON CONFLICT DO UPDATE RETURNING` |
| Money arithmetic    | `a + b`, `a * b`                             | `sum(a, b)`, `mul(a, b)` из `@/lib/money`                                        | ESLint money-guard blocks bare ops                                          |
| Status FSM          | `if (status === X)` повсюду                  | `VALID_TRANSITIONS` map + helper                                                 | Уже есть в `orders.ts:13`                                                   |
| Permission check    | прямые проверки role                         | `requirePermission('orders.manage', storeId)`                                    | `src/lib/permissions.ts`                                                    |
| Transaction wrapper | ручные try/catch + rollback                  | `db.$transaction(async (tx) => {...})`                                           | Prisma откатывает на throw автоматически                                    |

**Key insight:** Весь необходимый инфраструктурный код УЖЕ существует в `sales.ts` и `counters.ts`. Задача Phase 8 — **портировать** эти паттерны в `orders.ts`, не изобретать новое.

## Common Pitfalls

### Pitfall 1: Silent Stock Decrement Skip (BUG-023)

**What goes wrong:** Order completion создаёт Sale, серийники помечаются SOLD, но несерийный stock не декрементится — товар висит как доступный в двух местах.
**Why it happens:** `updateOrderStatus` и `payAndChangeStatus` копируют данные из `order.items` в `Sale`, но НЕ копируют `storeProduct.update({quantity: decrement})` паттерн из `createSale`.
**How to avoid:** Извлечь `decrementStockForItems(tx, storeId, items)` helper и вызывать из всех трёх точек: createSale, completeOrder, payAndCompleteOrder.
**Warning signs:** `quantity` в StoreProduct не меняется после completion; два параллельных потока (POS + order completion) могут продать один и тот же товар.

### Pitfall 2: Race между Cancel и Complete

**What goes wrong:** Оператор А жмёт «Завершить», оператор Б жмёт «Отменить» параллельно. Без локов получаем Sale + CANCELLED order, или оба transitions могут пройти.
**Why:** `findUnique` не блокирует row.
**How to avoid:** В начале каждой транзиции — `SELECT ... FROM "CustomOrder" WHERE id = ${id} FOR UPDATE` + re-check status после lock.

### Pitfall 3: Prepayment After Cancel, Before Refund Crash

**What goes wrong:** Cancel с REFUND: создали CashOperation, упала БД/сеть, client retry → создаётся ещё одна compensating entry → двойной возврат.
**How to avoid:** Idempotency. Либо check `CustomOrder.status === CANCELLED` в начале (уже сейчас throw), либо уникальный constraint `Payment(orderId, isExpense=true)` для одного compensating entry. Либо `INSERT ... ON CONFLICT DO NOTHING` по natural key.

### Pitfall 4: Order-level Discount Round Drift

**What goes wrong:** Discount 100₽ на 3 позиции → 33.33₽ × 3 = 99.99₽, потерян 1 коп.
**How to avoid:** Residual pattern — распределить 33.33, 33.33, 33.34. Накапливать в Decimal, последний item получает остаток.

### Pitfall 5: Serial Unit Race

**What goes wrong:** Тот же SerialUnit привязан к заказу и одновременно продан через POS (`createSale`).
**Why:** `linkSerialUnitToOrder` проверяет status, но не локает; `createSale` локает StoreProduct, но не serialUnit.
**How to avoid:** В `completeOrder` — `SELECT ... FROM "SerialUnit" WHERE id IN (...) FOR UPDATE` + re-check status=`IN_STOCK`. (Phase 9 полностью решает серийники, но для Phase 8 нам нужна гарантия хотя бы при completion.)

### Pitfall 6: RefundMethod Validation Drift

**What goes wrong:** Продажа оплачена картой (CARD), возврат делаем наличкой (CASH) → касса не сходится.
**How to avoid:** В `createReturn` — `refundMethod` должен быть ∈ `set(sale.payments.map(p => p.method))`. Или чётко: «возврат только тем же методом». Уточнить бизнес-правило в plan phase.

### Pitfall 7: Overpay Silent Credit

**What goes wrong:** totalAmount=30000, клиент платит 35000 → 5000 зависает в Payment без credit balance.
**How to avoid:** В `payAndChangeStatus` и `addOrderPayment`:

```typescript
const existing = sum(...order.payments.map((p) => toMoney(p.amount)))
const newTotal = sum(existing, toMoney(payment.amount))
if (newTotal.gt(order.totalAmount)) throw new Error("Переплата заказа: уменьшите сумму")
```

## Code Examples

### Example 1: Full completeOrder (целевой шаблон)

```typescript
// Source: композиция паттернов из sales.ts и orders.ts
export async function completeOrder(
  orderId: string,
  options: { discountAmount?: number; finalPayment?: { method: PaymentMethod; amount: number } },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  return await db.$transaction(async (tx) => {
    // 1. LOCK order row
    await tx.$queryRaw`SELECT id FROM "CustomOrder" WHERE id = ${orderId} FOR UPDATE`
    const order = await tx.customOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { serialUnit: true } }, payments: true },
    })
    await requirePermission("orders.manage", order.storeId)

    // 2. Validate transition
    if (order.status !== "READY_FOR_PICKUP") throw new Error(`Нельзя завершить из ${order.status}`)

    // 3. Shift required
    const openShift = await tx.shift
      .findFirstOrThrow({
        where: { storeId: order.storeId, status: "OPEN" },
        select: { id: true },
      })
      .catch(() => {
        throw new Error("Откройте кассовую смену")
      })

    // 4. Discount + prepayment arithmetic
    const discount = toMoney(options.discountAmount ?? 0)
    if (discount.lt(0) || discount.gt(order.totalAmount)) throw new Error("Некорректная скидка")
    const netTotal = sub(order.totalAmount, discount)
    const prepaid = toMoney(order.prepaidAmount)
    const owing = sub(netTotal, prepaid)

    // 5. Final payment (если нужен)
    const finalPaid = toMoney(options.finalPayment?.amount ?? 0)
    if (finalPaid.gt(owing)) throw new Error("Переплата: клиент должен только " + owing.toFixed(2))
    if (finalPaid.lt(owing))
      throw new Error("Недоплата: осталось " + sub(owing, finalPaid).toFixed(2))

    // 6. Stock lock + decrement (FIN-02)
    const productIds = order.items
      .filter((i) => !i.serialUnitId && i.productId)
      .map((i) => i.productId!)
    if (productIds.length > 0) {
      const locked = await tx.$queryRaw<{ productId: string; quantity: number }[]>`
        SELECT sp."productId", sp.quantity FROM "StoreProduct" sp
        WHERE sp."storeId" = ${order.storeId} AND sp."productId" = ANY(${productIds}::text[])
        FOR UPDATE OF sp
      `
      const stockMap = new Map(locked.map((r) => [r.productId, r]))
      for (const item of order.items) {
        if (!item.serialUnitId && item.productId) {
          const stock = stockMap.get(item.productId)
          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Недостаточно остатка: ${item.name}`)
          }
        }
      }
    }

    // 7. SerialUnit lock (FIN-03)
    const serialIds = order.items.map((i) => i.serialUnitId).filter(Boolean) as string[]
    if (serialIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM "SerialUnit" WHERE id = ANY(${serialIds}::text[]) AND status = 'IN_STOCK' FOR UPDATE`
    }

    // 8. Create Sale
    const saleNumber = await getNextNumber("S", tx)
    // Per-unit discount proration (FIN-08)
    const perUnitDiscount = computePerUnitDiscount(order.items, discount)
    const sale = await tx.sale.create({
      data: {
        number: saleNumber,
        storeId: order.storeId,
        sellerId: order.sellerId,
        totalAmount: order.totalAmount,
        discountAmount: discount,
        finalAmount: netTotal, // FIN-01 (semantic: чек total - скидка, без prepaid)
        shiftId: openShift.id,
        items: {
          create: order.items.map((item, i) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice ?? 0,
            discount: perUnitDiscount[i],
            total: mul(sub(item.price, perUnitDiscount[i]), item.quantity),
            serialUnitId: item.serialUnitId,
          })),
        },
        payments: {
          create: [
            // Existing prepayments — shift from prepayment to sale's shift? Discuss.
            ...order.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              shiftId: p.shiftId ?? openShift.id,
            })),
            ...(options.finalPayment
              ? [
                  {
                    method: options.finalPayment.method,
                    amount: options.finalPayment.amount,
                    shiftId: openShift.id,
                  },
                ]
              : []),
          ],
        },
      },
    })

    // 9. Decrement stock (FIN-02)
    for (const item of order.items) {
      if (!item.serialUnitId && item.productId) {
        await tx.storeProduct.update({
          where: { storeId_productId: { storeId: order.storeId, productId: item.productId } },
          data: { quantity: { decrement: item.quantity } },
        })
      }
    }

    // 10. Mark serials SOLD
    for (const item of order.items) {
      if (item.serialUnitId) {
        await tx.serialUnit.update({ where: { id: item.serialUnitId }, data: { status: "SOLD" } })
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: item.serialUnitId,
            event: "SOLD",
            storeId: order.storeId,
            performedById: session.user!.id,
            relatedDocument: `Продажа ${saleNumber}`,
          },
        })
      }
    }

    // 11. Update order status
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        saleId: sale.id,
        finalAmount: netTotal,
      },
    })
    await tx.orderStatusHistory.create({
      data: { orderId, status: "COMPLETED", userId: session.user!.id },
    })

    return { saleId: sale.id, saleNumber }
  })
}
```

### Example 2: Per-unit Discount Proration (precision-safe)

```typescript
function computePerUnitDiscount(
  items: Array<{ price: Decimal; quantity: number }>,
  totalDiscount: Decimal,
): Decimal[] {
  if (totalDiscount.eq(0)) return items.map(() => new Decimal(0))
  const lineTotals = items.map((i) => mul(i.price, i.quantity))
  const grandTotal = sum(...lineTotals)
  const perUnit: Decimal[] = []
  let allocated = new Decimal(0)
  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1
    let lineDiscount: Decimal
    if (isLast) {
      lineDiscount = sub(totalDiscount, allocated) // residual — покрывает rounding drift
    } else {
      lineDiscount = div(mul(totalDiscount, lineTotals[i]), grandTotal).toDecimalPlaces(2)
      allocated = sum(allocated, lineDiscount)
    }
    perUnit.push(div(lineDiscount, items[i].quantity).toDecimalPlaces(4)) // per-unit с 4 знаками
  }
  return perUnit
}
```

## State of the Art

| Old Approach                                     | Current Approach                              | Impact                                      |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------- |
| Отдельные updateOrderStatus + payAndChangeStatus | Единый `completeOrder` со всеми side effects  | Меньше дублирования, проще аудит            |
| `deleteMany` payment при cancel                  | Compensating `isExpense=true` + CashOperation | Аудит сохраняется, кассовый отчёт корректен |
| `Payment.shiftId` nullable                       | NOT NULL + migration + guard                  | Phase 10 reports smогут JOIN                |
| Return.refundMethod nullable                     | NOT NULL + валидация от оригинала             | Касса сходится по методам                   |
| Mock-based tests (v1.0)                          | E2E real-db pattern                           | Ловит constraint violations и race          |

## Open Questions

1. **Семантика `Sale.finalAmount` для order completion**
   - FIN-01 говорит: `finalAmount = totalAmount - discount - prepaidAmount`. Это = «сколько ещё собрать в кассу при выдаче», а не «итоговая цена чека».
   - Альтернатива: `finalAmount = totalAmount - discount` (итог чека), а «сколько собрать» = отдельное поле/расчёт.
   - **Recommendation:** обсудить в plan-phase. Вариант Б семантически чище и совместим с Phase 10 reports (revenue = finalAmount), но BUG-024 формулировка = Вариант А.

2. **Новый статус `REFUNDED` для CustomOrder?**
   - FIN-07: Sale возвращён → Order тоже. Текущий enum: `CANCELLED` уже есть.
   - **Recommendation:** добавить `REFUNDED` — отличается от `CANCELLED` тем, что товар был выдан. Или reuse CANCELLED с пометкой в `OrderStatusHistory`. Обсудить.

3. **Refund method policy**
   - FIN-09: «валидируется от метода оригинального Payment». Строгость?
     - (a) Строго: refundMethod === original.method (для многометодных платежей — ошибка)
     - (b) Мягко: refundMethod ∈ set(original.methods)
     - (c) Любой: разрешить, но залогировать
   - **Recommendation:** (b) для Phase 8, проверить с бизнесом.

4. **Prepayment shift assignment в созданном Sale**
   - Когда Sale создаётся из Order, куда отнести старые Payment'ы: в original prepayment shift или в текущий completion shift?
   - **Recommendation:** оставить `p.shiftId` (original), новые финальные — в completion shift. Тогда reports по сменам корректны.

5. **FIN-06: удержанная предоплата как доход**
   - Куда она попадает в Phase 10 reports? Нужен ли отдельный флаг на Payment (`isForfeited: boolean`) или наличия `order.status === CANCELLED && payments exist` достаточно?
   - **Recommendation:** добавить `CustomOrder.cancellationType: "HOLD" | "REFUND" | null`, тогда Phase 10 сможет фильтровать.

6. **Concurrent cancel vs complete**
   - Lock strategy достаточен? Или нужен optimistic locking на `CustomOrder.version`?
   - **Recommendation:** pessimistic `FOR UPDATE` для Phase 8; optimistic отложить в Phase 15 (DATA2).

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 3.x (projects.unit + projects.e2e)                                                                         |
| Config file        | `vitest.config.ts` (Phase 7)                                                                                      |
| Quick run command  | `pnpm test -- cancel-order`                                                                                       |
| Full suite command | `pnpm test && pnpm test:e2e`                                                                                      |
| E2E infra          | `src/__tests__/helpers/db.ts` (schema-per-worker) + `helpers/fixtures.ts` + `helpers/setup-db.ts` (auto TRUNCATE) |

### Phase Requirements → Test Map

| Req ID | Behavior                                      | Test Type                                   | Automated Command                                     | File Exists? |
| ------ | --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ------------ |
| FIN-01 | Sale.finalAmount правильно считает предоплату | E2E real-db                                 | `pnpm test:e2e order-completion`                      | ❌ Wave 0    |
| FIN-02 | Stock decrement при completion                | E2E real-db                                 | `pnpm test:e2e order-completion`                      | ❌ Wave 0    |
| FIN-03 | Serials → SOLD при completion                 | E2E real-db                                 | `pnpm test:e2e order-completion`                      | ❌ Wave 0    |
| FIN-04 | Cancel dialog: Hold/Refund выбор              | E2E real-db + UI unit                       | `pnpm test:e2e order-cancel`                          | ❌ Wave 0    |
| FIN-05 | Refund → CashOperation + Payment isExpense    | E2E real-db                                 | `pnpm test:e2e order-cancel-refund`                   | ❌ Wave 0    |
| FIN-06 | Hold → payments остаются, status CANCELLED    | E2E real-db                                 | `pnpm test:e2e order-cancel-hold`                     | ❌ Wave 0    |
| FIN-07 | Sale возврат → Order sync                     | E2E real-db                                 | `pnpm test:e2e order-return-sync`                     | ❌ Wave 0    |
| FIN-08 | Per-unit discount 1/3 refund                  | E2E real-db + unit (computePerUnitDiscount) | `pnpm test partial-return-per-unit` + `pnpm test:e2e` | ❌ Wave 0    |
| FIN-09 | refundMethod NOT NULL + валидация             | Schema migration test + E2E                 | `pnpm test:e2e refund-method-validation`              | ❌ Wave 0    |
| FIN-10 | Return midway failure — atomic rollback       | E2E real-db                                 | `pnpm test:e2e return-midway-failure`                 | ❌ Wave 0    |
| FIN-11 | shiftId NOT NULL — без смены блок             | E2E real-db                                 | `pnpm test:e2e order-payment-requires-shift`          | ❌ Wave 0    |
| FIN-12 | Overpay блокируется                           | E2E real-db                                 | `pnpm test:e2e order-overpay-blocked`                 | ❌ Wave 0    |

### Invariants (для E2E property-style проверок)

Для каждого теста после ACT проверять **все** следующие инварианты:

1. **Stock conservation:** `sum(StoreProduct.quantity) + sum(SaleItem.quantity — Return.quantity) == initial_stock` (для непопытных товаров)
2. **Serial status consistency:** `SerialUnit.status === 'SOLD'` ↔ есть `SaleItem.serialUnitId` с saleItem.sale.status != RETURNED
3. **Money conservation:** `sum(Payment.amount где !isExpense) − sum(Payment.amount где isExpense) == sum(Sale.finalAmount для COMPLETED) + sum(order.prepaidAmount для удержанных)`
4. **Shift consistency:** никакой `Payment.shiftId == null` при `order.status !== NEW`
5. **Return amount cap:** `sum(Return.amount для sale) <= sale.finalAmount`
6. **Order ↔ Sale link:** `CustomOrder.saleId != null` ↔ `CustomOrder.status === COMPLETED`

### Sampling Rate

- **Per task commit:** `pnpm test -- <touched-file-pattern>` (<30s)
- **Per wave merge:** `pnpm test && pnpm test:e2e` (full suite)
- **Phase gate:** Full suite green + manual smoke test на dev БД перед `/gsd:verify-work`

### Wave 0 Gaps (обязательны перед implementation)

- [ ] `src/__tests__/e2e/order-completion.e2e.test.ts` — покрывает FIN-01, FIN-02, FIN-03
- [ ] `src/__tests__/e2e/order-cancel.e2e.test.ts` — покрывает FIN-04, FIN-05, FIN-06
- [ ] `src/__tests__/e2e/order-return-sync.e2e.test.ts` — покрывает FIN-07
- [ ] `src/__tests__/e2e/partial-return-per-unit.e2e.test.ts` — покрывает FIN-08 (order path)
- [ ] `src/__tests__/e2e/order-payment-constraints.e2e.test.ts` — покрывает FIN-09 (refundMethod), FIN-11 (shift), FIN-12 (overpay)
- [ ] `src/__tests__/e2e/return-midway-failure.e2e.test.ts` — покрывает FIN-10 (force throw в середине tx, проверить Sale.status)
- [ ] `src/__tests__/unit/compute-per-unit-discount.test.ts` — pure function, precision тесты (100₽ / 3 items, residual)
- [ ] Фикстура `createTestOrderWithPrepayment({ storeId, items, prepaidAmount })` в `helpers/fixtures.ts`
- [ ] Фикстура `createTestShift({ storeId, status: "OPEN" })` (проверить — может уже есть)

### Test Dimensions Matrix (критичный E2E test grid)

| Dimension         | Values                                     |
| ----------------- | ------------------------------------------ |
| Item type         | серийный / несерийный / смешанный          |
| Prepayment        | 0 / partial / full                         |
| Discount          | 0 / per-line / order-level                 |
| Shift             | OPEN / CLOSED / NONE                       |
| Failure injection | none / mid-tx DB error / concurrent cancel |
| Cancel action     | HOLD / REFUND (для CASH и CARD original)   |

Минимум один test case покрывает каждую комбинацию критичных dimensions.

## Dependencies Between Tasks

```
Task A: Schema migrations (FIN-09, FIN-11)
  └─→ Task B: completeOrder refactor (FIN-01, 02, 03, 08, 12)
        ├─→ Task C: cancelOrder refactor (FIN-04, 05, 06)
        └─→ Task D: createReturn hardening (FIN-07, 09, 10)
              └─→ Task E: UI CancelDialog + return-form (FIN-04, 09)
                    └─→ Task F: E2E coverage (все FIN-*)

Task A (Wave 0): Test fixtures + E2E файлы-заглушки (RED)
```

Порядок: Wave 0 (тесты RED) → Wave 1 (schema migrations + unit) → Wave 2 (actions refactor — parallel B/C/D) → Wave 3 (UI) → Wave 4 (E2E зелёные + full suite).

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` lines 242-371 (Sale/SaleItem/Payment/Return/ReturnItem)
- `prisma/schema.prisma` lines 542-623 (CustomOrder/CustomOrderItem/OrderStatusHistory)
- `prisma/schema.prisma` lines 1083-1135 (CashOperation/SerialUnit)
- `src/actions/orders.ts` — полный анализ (1013 строк, все ключевые функции прочитаны)
- `src/actions/sales.ts` — полный анализ createSale/createReturn (815 строк)
- `src/__tests__/cancel-order.test.ts` — текущее покрытие cancel (75 строк, mock-based)
- `src/components/orders/order-detail.tsx` lines 1218-1266 (CancelDialog UI)
- `.planning/REQUIREMENTS.md` lines 127-140 (FIN-01..12 формулировки)
- `.planning/STATE.md` — Phase 7 результаты, money.ts helpers, money-guard rule
- `.planning/ROADMAP.md` Phase 8 section (success criteria, dependencies)
- `src/__tests__/e2e/_template.e2e.test.ts` — E2E pattern (Phase 7-05)

### Secondary (MEDIUM)

- `src/__tests__/e2e/sales-decimal.e2e.test.ts` — reference для e2e-real-db pattern
- CLAUDE.md — production-grade, TDD, no-mocks policy

### Tertiary (LOW)

- Нет — всё проверено через прямое чтение кода

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — всё уже в проекте, просто переиспользуем
- Architecture patterns: HIGH — шаблон взят из `createSale`, проверен в Phase 7
- Gap analysis: HIGH — прочитан весь `orders.ts` (1013 строк)
- Open questions: HIGH — это реальные бизнес-решения, требующие discuss
- E2E strategy: HIGH — Phase 7 infra готова, шаблон есть

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 дней — стабильные внутренние модули)

---

## RESEARCH COMPLETE

**Phase:** 8 — Order/Sale Flow & Предоплаты
**Confidence:** HIGH

### Key Findings

1. **КРИТИЧНО: завершение заказа не декрементит несерийный stock** (FIN-02) — прямой дубликат остатков. Оба пути (`updateOrderStatus`, `payAndChangeStatus`) затронуты.
2. **`cancelOrder` безусловно стирает предоплату** через `payment.deleteMany` — никакого выбора HOLD/REFUND (FIN-04..06), никакого audit trail, никаких compensating entries.
3. **`Payment.shiftId` и `Return.refundMethod` nullable в схеме** — нужны migrations с NOT NULL + backfill (FIN-09, FIN-11). Код позволяет `shiftId ?? null` — нужно throw.
4. **Infrastructure exists в `sales.ts`** — `FOR UPDATE` lock, Decimal helpers, atomic numbering, tx pattern. Задача — **портировать**, не изобретать.
5. **E2E coverage = 0** — ни одного теста на orders flow. Wave 0 нужен крупный: ~6 E2E файлов + 1 unit + 2 фикстуры.
6. **6 open questions требуют plan-phase обсуждения** — особенно семантика `finalAmount` (FIN-01 interpretation), новый статус REFUNDED, refund method policy.

### File Created

`.planning/phases/08-order-sale-flow/08-RESEARCH.md`

### Confidence Assessment

| Area               | Level | Reason                                                       |
| ------------------ | ----- | ------------------------------------------------------------ |
| Standard Stack     | HIGH  | Всё in-tree, Phase 7 уже решила foundation                   |
| Architecture       | HIGH  | Паттерны из createSale, проверенные production               |
| Current State Gaps | HIGH  | Прочитан весь orders.ts, schema, UI                          |
| Pitfalls           | HIGH  | Race conditions + money rounding — известные domain pitfalls |
| Test Strategy      | HIGH  | Phase 7 infra готова, шаблон проверен                        |

### Open Questions (для plan-phase или /gsd:discuss-phase)

1. Семантика `Sale.finalAmount` для completed order (вариант А vs Б)
2. Новый статус `REFUNDED` в `CustomOrderStatus` vs reuse `CANCELLED`
3. Refund method policy: strict / set / any
4. Prepayment shift assignment в созданном Sale
5. Как удержанная предоплата попадает в Phase 10 reports (`CustomOrder.cancellationType` флаг?)
6. Concurrent cancel vs complete — pessimistic FOR UPDATE достаточно?

### Dependencies

- Phase 7 (Decimal foundation) ✅ — используем `@/lib/money` helpers, money-guard активен
- **Phase 9** (locking) — частично overlap на SerialUnit FOR UPDATE. Phase 8 делает минимум для completion; Phase 9 доделает createSale/confirmTransferSent.
- **Phase 10** (reports) — зависит от Phase 8: Hold vs Refund семантика нужна для revenue calc.

### Ready for Planning

Research complete. Planner может создавать PLAN.md файлы. Рекомендуется сначала `/gsd:discuss-phase 8` для resolving 6 open questions — особенно #1 (FIN-01 interpretation), #2 (REFUNDED status), #5 (reports impact).
