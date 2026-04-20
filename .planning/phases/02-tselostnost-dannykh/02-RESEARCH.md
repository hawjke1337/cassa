# Phase 2: Целостность данных - Research

**Researched:** 2026-04-05
**Domain:** PostgreSQL concurrency, Prisma 7 transactions, financial calculations
**Confidence:** HIGH

## Summary

Фаза 2 затрагивает исключительно серверную логику: race conditions при работе с остатками, корректность финансовых формул и полноту откатов бизнес-операций. Все 10 требований (DATA-01..DATA-10) имеют четкие решения, зафиксированные в CONTEXT.md. Одно требование (DATA-09) уже выполнено в Phase 1.

Ключевой технический паттерн -- `SELECT ... FOR UPDATE` через Prisma `$queryRaw` внутри `db.$transaction()`. Этот подход уже частично используется в кодовой базе (Phase 1 добавил транзакции в sales.ts). Основной риск -- пропустить место, где quantity уменьшается без блокировки, или забыть передать `tx` в `getNextNumber`.

**Primary recommendation:** Реализовать pessimistic locking через `$queryRaw('SELECT ... FOR UPDATE')` внутри существующих `$transaction` блоков; исправить финансовые формулы в точках, указанных в CONTEXT.md; добавить unit-тесты на каждую формулу.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SELECT FOR UPDATE на StoreProduct.quantity внутри Prisma `$transaction` + `$queryRaw` (pessimistic locking)
- getNextNumber принимает опциональный `tx` параметр (обратная совместимость)
- Средневзвешенная costPrice: `newCostPrice = (oldQty * oldCostPrice + receiveQty * receiveCostPrice) / (oldQty + receiveQty)`
- cancelOrder откатывает все побочные эффекты в одной транзакции (Payment, SerialUnit, SupplierDebt, quantity)
- sellPrice fallback = costPrice * 1.3 при создании StoreProduct для серийных товаров
- Комиссия при частичном возврате: per-item дедукция через calculateItemCommission
- Валидация rate: PERCENT max=1, FIXED max=100000
- autoCloseShift: expectedCash = openingCash + cashPayments - cashRefunds; discrepancy = null если нет actualCash
- DATA-09 (searchSaleByNumber exact match) -- УЖЕ СДЕЛАНО в Phase 1
- deleteTradeIn: разрешить удаление только для PENDING (и WRITTEN_OFF -- см. Open Questions)

### Claude's Discretion
- Формат ошибок при race condition (текст сообщения)
- Логирование отмен заказов (audit trail)
- Batch SELECT FOR UPDATE для нескольких товаров в одной продаже

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | SELECT FOR UPDATE на StoreProduct.quantity при продаже | Prisma $queryRaw + $transaction pattern; применить в createSale, createReturn, confirmReceive, transfer, writeOff |
| DATA-02 | getNextNumber внутри транзакции | Расширить сигнатуру getNextNumber(prefix, tx?); FOR UPDATE на Counter row |
| DATA-03 | Средневзвешенная costPrice при приёмке | Формула в confirmReceive для non-serialized; current code просто перезаписывает costPrice |
| DATA-04 | Отмена заказа откатывает побочные эффекты | cancelOrder в orders.ts (новая функция); Payment, SerialUnit, SupplierDebt, quantity |
| DATA-05 | sellPrice fallback при создании StoreProduct | В confirmReceive для serialized products: если sellPrice=0, использовать costPrice*1.3 |
| DATA-06 | Комиссия при частичном возврате | Исправить returnDeductions в motivation-calculation.ts: per-item, не per-sale filtering |
| DATA-07 | Валидация rate в мотивации | Добавить .max(1) для PERCENT и .max(100000) для FIXED в commissionRuleSchema |
| DATA-08 | Авто-закрытие смены с expectedCash | В openShift при AUTO_CLOSE существующей смены: вычислять expectedCash (сейчас не делает) |
| DATA-09 | searchSaleByNumber exact match | УЖЕ ВЫПОЛНЕНО в Phase 1 (commit 0ba7a58) -- пометить как done |
| DATA-10 | deleteTradeIn проверка статуса | Добавить guard: status must be PENDING or WRITTEN_OFF (нет REJECTED в enum!) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.4.2 | ORM + $queryRaw для raw SQL | Уже в проекте; $queryRaw единственный способ SELECT FOR UPDATE |
| PostgreSQL | 14+ | БД с row-level locking | FOR UPDATE -- стандарт PostgreSQL |
| Zod | 3.x | Валидация схем | Уже в проекте для всех validation schemas |
| Vitest | 4.1.2 | Unit тесты | Уже настроен, 5 тестов из Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | 7.4.2 | Type-safe DB client | Для типа PrismaTransactionClient |

### Alternatives Considered
Не применимо -- все решения зафиксированы в CONTEXT.md, альтернативы не рассматриваются.

## Architecture Patterns

### Pattern 1: SELECT FOR UPDATE через Prisma $queryRaw

**What:** Блокировка строки БД до конца транзакции для предотвращения race conditions.
**When to use:** Любая операция уменьшения/проверки quantity (продажа, перемещение, списание).

```typescript
// Внутри db.$transaction(async (tx) => { ... })
const locked = await tx.$queryRaw<{ quantity: number }[]>`
  SELECT quantity FROM "StoreProduct" 
  WHERE "storeId" = ${storeId} AND "productId" = ${productId}
  FOR UPDATE
`
if (!locked[0] || locked[0].quantity < requestedQuantity) {
  throw new Error("Товар закончился")
}
// Далее обычный tx.storeProduct.update с decrement
```

**Key insight:** `$queryRaw` возвращает массив. Всегда проверять `locked[0]`. Тип результата надо указать явно через generic.

### Pattern 2: Транзакционный getNextNumber

**What:** Генерация уникального номера внутри внешней транзакции.
**When to use:** Когда номер должен быть атомарен с остальной операцией.

```typescript
type PrismaTx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export async function getNextNumber(prefix: string, tx?: PrismaTx): Promise<string> {
  const year = new Date().getFullYear()
  const counterId = `${prefix}-${year}`
  const client = tx ?? db

  // FOR UPDATE для предотвращения дубликатов при параллельных транзакциях
  await client.$queryRaw`
    INSERT INTO "Counter" (id, current) VALUES (${counterId}, 0)
    ON CONFLICT (id) DO NOTHING
  `
  const result = await client.$queryRaw<{ current: number }[]>`
    UPDATE "Counter" SET current = current + 1
    WHERE id = ${counterId}
    RETURNING current
  `
  return `${prefix}-${year}-${String(result[0].current).padStart(6, "0")}`
}
```

**Note:** Используем `INSERT ... ON CONFLICT DO NOTHING` + `UPDATE ... RETURNING` вместо upsert для атомарности в raw SQL. Альтернатива -- сохранить Prisma upsert если tx передан (upsert уже атомарен в PostgreSQL), но добавить FOR UPDATE.

### Pattern 3: Средневзвешенная costPrice

**What:** Формула пересчета себестоимости при приемке нового товара.

```typescript
// Внутри confirmReceive, после SELECT FOR UPDATE на StoreProduct
const oldQty = locked[0].quantity
const oldCostPrice = Number(locked[0].costPrice)
const receiveQty = item.quantity
const receiveCostPrice = Number(item.costPrice)

const newCostPrice = oldQty === 0
  ? receiveCostPrice
  : +((oldQty * oldCostPrice + receiveQty * receiveCostPrice) / (oldQty + receiveQty)).toFixed(2)

await tx.storeProduct.update({
  where: { storeId_productId: { storeId: receive.storeId, productId: item.productId } },
  data: { 
    quantity: { increment: receiveQty },
    costPrice: newCostPrice,
  },
})
```

### Pattern 4: Batch SELECT FOR UPDATE (оптимизация, Claude's Discretion)

**Recommendation:** Для createSale с несколькими товарами -- одним запросом заблокировать все строки.

```typescript
const productIds = data.items.map(i => i.productId)
const locked = await tx.$queryRaw<{ productId: string; quantity: number }[]>`
  SELECT "productId", quantity FROM "StoreProduct"
  WHERE "storeId" = ${storeId} AND "productId" = ANY(${productIds}::text[])
  FOR UPDATE
`
const stockMap = new Map(locked.map(r => [r.productId, r.quantity]))
// Проверить каждый item.quantity <= stockMap.get(item.productId)
```

**Tradeoff:** Один запрос вместо N, но чуть сложнее код. Для ~10 пользователей не критично, но правильнее архитектурно.

### Anti-Patterns to Avoid
- **Не использовать optimistic locking (version field):** Для POS с ~10 пользователями pessimistic проще и надежнее
- **Не генерировать номер до транзакции:** `getNextNumber("S")` вызывается ДО `$transaction` в текущем коде sales.ts (строка 133) -- это race condition на нумерации
- **Не забывать FOR UPDATE при увеличении quantity:** createReturn и confirmReceive тоже нуждаются в блокировке для корректной средневзвешенной

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-level locking | Custom mutex/semaphore | PostgreSQL FOR UPDATE | Встроено в БД, работает с транзакциями |
| Atomic counter | Ручной SELECT + UPDATE | INSERT ON CONFLICT + UPDATE RETURNING | Атомарная операция в одном запросе |
| Decimal arithmetic | parseFloat + математика | Prisma Decimal + .toFixed(2) | Избежать floating-point ошибок |
| Zod conditional validation | if/else в handler | z.discriminatedUnion или .refine() | Единая точка валидации |

## Common Pitfalls

### Pitfall 1: getNextNumber вне транзакции
**What goes wrong:** Два параллельных запроса получают один номер.
**Why it happens:** Текущий `getNextNumber("S")` вызывается на строке 133 sales.ts ДО `db.$transaction`. Counter.upsert атомарен сам по себе, но номер может быть сгенерирован для транзакции которая потом упадет -- "дыра" в нумерации.
**How to avoid:** Переместить вызов внутрь транзакции, передать `tx`.
**Warning signs:** Пропуски в нумерации (S-2026-000001, S-2026-000003 без 000002).

### Pitfall 2: costPrice перезапись при приемке
**What goes wrong:** Текущий код (inventory.ts строка 316-318) при `update` просто ставит `costPrice: item.costPrice` -- перезаписывает средневзвешенную последним приходом.
**Why it happens:** Не учитывается имеющийся остаток и его себестоимость.
**How to avoid:** Читать текущие quantity и costPrice с FOR UPDATE, вычислять средневзвешенную.

### Pitfall 3: cancelOrder без полного отката
**What goes wrong:** В orders.ts нет функции cancelOrder. updateOrderStatus обрабатывает CANCELLED, но НЕ откатывает: Payment, SerialUnit status, SupplierDebt, quantity.
**Why it happens:** Отмена -- это просто смена статуса, без обратной логики.
**How to avoid:** Реализовать полный откат всех побочных эффектов внутри одной транзакции.

### Pitfall 4: returnDeductions фильтрация per-sale вместо per-item
**What goes wrong:** В motivation-calculation.ts строка 292: `saleItems.filter((item) => !returnedItemIds.has(item.id))` -- исключает весь SaleItem если хотя бы одна единица возвращена, даже если возвращена только 1 из 3.
**Why it happens:** returnedItemIds содержит saleItemId если был ANY return для этого item.
**How to avoid:** Вместо Set<saleItemId> использовать Map<saleItemId, returnedQuantity>. Комиссия = calculateItemCommission(..., item.quantity - returnedQuantity, ...).

### Pitfall 5: autoCloseShift без expectedCash
**What goes wrong:** В openShift (shifts.ts строка 51-57) при auto-close просто ставит `status: "AUTO_CLOSED"` и `closedAt` -- без вычисления expectedCash и discrepancy.
**Why it happens:** closeShift вычисляет expectedCash, но openShift использует упрощенный auto-close.
**How to avoid:** Извлечь логику расчета expectedCash в отдельную функцию, вызывать из обоих мест. При AUTO_CLOSE discrepancy = null (нет actualCash от кассира).

### Pitfall 6: TradeInStatus enum не содержит REJECTED
**What goes wrong:** CONTEXT.md упоминает "PENDING и REJECTED" как допустимые для удаления, но Prisma enum `TradeInStatus` содержит: PENDING, IN_STOCK, IN_REPAIR, SOLD, WRITTEN_OFF -- без REJECTED.
**Why it happens:** Несоответствие между CONTEXT.md и реальной схемой.
**How to avoid:** Использовать PENDING и WRITTEN_OFF как допустимые для удаления (WRITTEN_OFF -- единственный "терминальный безопасный" статус кроме PENDING).

### Pitfall 7: Floating-point в финансовых расчетах
**What goes wrong:** `(5 * 80 + 10 * 100) / 15` = 93.33333... -- бесконечная дробь.
**Why it happens:** JavaScript Number -- IEEE 754 double.
**How to avoid:** Всегда `.toFixed(2)` после финансовых вычислений, конвертировать обратно в Number через `+()`.

## Code Examples

### cancelOrder (новая функция для orders.ts)

```typescript
export async function cancelOrder(orderId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { serialUnit: true } },
      payments: true,
      debt: true,
    },
  })
  if (!order) throw new Error("Заказ не найден")
  if (order.status === "COMPLETED") {
    throw new Error("Завершённый заказ нельзя отменить, используйте возврат")
  }
  if (order.status === "CANCELLED") {
    throw new Error("Заказ уже отменён")
  }

  await requirePermission("orders.manage", order.storeId)

  await db.$transaction(async (tx) => {
    // 1. Откатить платежи
    if (order.payments.length > 0) {
      await tx.payment.deleteMany({ where: { orderId } })
      await tx.customOrder.update({
        where: { id: orderId },
        data: { prepaidAmount: 0 },
      })
    }

    // 2. Вернуть серийники
    for (const item of order.items) {
      if (item.serialUnitId) {
        await tx.serialUnit.update({
          where: { id: item.serialUnitId },
          data: { status: "IN_STOCK" },
        })
      }
    }

    // 3. Откатить долг поставщику
    if (order.debt) {
      await tx.supplierDebt.delete({ where: { id: order.debt.id } })
    }

    // 4. Вернуть quantity (если товар уже был зарезервирован -- проверить бизнес-логику)
    // NOTE: В текущей реализации quantity не резервируется при создании заказа,
    // только при COMPLETED создается Sale. Поэтому quantity откат может быть не нужен.

    // 5. Статус
    await tx.customOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    })
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "CANCELLED",
        comment: "Заказ отменён",
        userId: session.user!.id,
      },
    })
  })

  return { success: true }
}
```

### Валидация rate с условным max (DATA-07)

```typescript
export const commissionRuleSchema = z.object({
  groupId: z.string().optional(),
  type: commissionTypeSchema.default("PERCENT"),
  rate: z.coerce.number().min(0, "Значение не может быть отрицательным"),
  basis: commissionBasisSchema,
}).refine(
  (data) => {
    if (data.type === "PERCENT") return data.rate <= 1
    if (data.type === "FIXED") return data.rate <= 100000
    return true
  },
  {
    message: "Для процента максимум 1 (100%), для фиксированной суммы максимум 100 000",
    path: ["rate"],
  }
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma upsert для counter | $queryRaw INSERT ON CONFLICT + UPDATE RETURNING | Prisma 4+ | Атомарность в рамках внешней транзакции |
| Optimistic locking (version) | Pessimistic FOR UPDATE | Always valid | Проще для low-concurrency (10 users) |
| costPrice = last receive | Средневзвешенная | Accounting standard | Корректная себестоимость |

## Open Questions

1. **TradeInStatus REJECTED не существует в enum**
   - What we know: Enum содержит PENDING, IN_STOCK, IN_REPAIR, SOLD, WRITTEN_OFF
   - What's unclear: CONTEXT.md упоминает REJECTED как допустимый для удаления
   - Recommendation: Использовать PENDING и WRITTEN_OFF как допустимые (WRITTEN_OFF безопасен для удаления). Если бизнес-логика требует REJECTED -- нужна миграция в Phase 3 (DB schema changes).

2. **Audit trail для cancelOrder**
   - What we know: orderStatusHistory уже записывает каждую смену статуса
   - What's unclear: Нужно ли дополнительное логирование (какие платежи удалены, какие серийники вернулись)
   - Recommendation: Минимальный audit -- orderStatusHistory с comment содержащим summary. Детальный audit -- отложить до v2.

3. **quantity откат при отмене заказа**
   - What we know: В текущей реализации quantity не резервируется при создании заказа; товар "уходит со склада" только при COMPLETED (через Sale)
   - What's unclear: Если заказ COMPLETED -- отмена запрещена (только return). Но если SerialUnit привязан через linkSerialUnitToOrder, его status не меняется на "RESERVED" -- он остается IN_STOCK
   - Recommendation: При отмене достаточно: удалить payments, unlink serial units (set serialUnitId=null на CustomOrderItem), удалить SupplierDebt, обновить статус.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | SELECT FOR UPDATE блокирует quantity при продаже | unit | `npx vitest run src/__tests__/stock-locking.test.ts -t "FOR UPDATE"` | Wave 0 |
| DATA-02 | getNextNumber внутри tx не создает дубликатов | unit | `npx vitest run src/__tests__/counter-transaction.test.ts` | Wave 0 |
| DATA-03 | Средневзвешенная costPrice при приемке | unit | `npx vitest run src/__tests__/weighted-cost-price.test.ts` | Wave 0 |
| DATA-04 | cancelOrder откатывает все побочные эффекты | unit | `npx vitest run src/__tests__/cancel-order.test.ts` | Wave 0 |
| DATA-05 | sellPrice fallback = costPrice * 1.3 | unit | `npx vitest run src/__tests__/sell-price-fallback.test.ts` | Wave 0 |
| DATA-06 | Комиссия при частичном возврате per-item | unit | `npx vitest run src/__tests__/partial-return-commission.test.ts` | Wave 0 |
| DATA-07 | Валидация rate: PERCENT<=1, FIXED<=100000 | unit | `npx vitest run src/__tests__/motivation-validation.test.ts` | Wave 0 |
| DATA-08 | autoCloseShift вычисляет expectedCash | unit | `npx vitest run src/__tests__/auto-close-shift.test.ts` | Wave 0 |
| DATA-09 | searchSaleByNumber exact match | unit | `npx vitest run src/__tests__/sales-validation.test.ts` | Exists (Phase 1) |
| DATA-10 | deleteTradeIn запрещает удаление IN_STOCK/SOLD/IN_REPAIR | unit | `npx vitest run src/__tests__/trade-in-delete.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/stock-locking.test.ts` -- covers DATA-01 (pure function тест: проверка logic, не реальный DB lock)
- [ ] `src/__tests__/counter-transaction.test.ts` -- covers DATA-02
- [ ] `src/__tests__/weighted-cost-price.test.ts` -- covers DATA-03 (чистая математика)
- [ ] `src/__tests__/cancel-order.test.ts` -- covers DATA-04
- [ ] `src/__tests__/sell-price-fallback.test.ts` -- covers DATA-05
- [ ] `src/__tests__/partial-return-commission.test.ts` -- covers DATA-06
- [ ] `src/__tests__/motivation-validation.test.ts` -- covers DATA-07
- [ ] `src/__tests__/auto-close-shift.test.ts` -- covers DATA-08
- [ ] `src/__tests__/trade-in-delete.test.ts` -- covers DATA-10

**Note:** DATA-01 и DATA-02 тестируют concurrency -- полноценный integration test требует реальную БД. Для unit-тестов можно проверить что $queryRaw вызывается с FOR UPDATE (mock-based) и что логика проверки quantity корректна (pure function extraction).

## Sources

### Primary (HIGH confidence)
- Prisma 7.4.2 -- `$queryRaw`, `$transaction` API (from installed package + schema)
- PostgreSQL FOR UPDATE -- standard SQL, row-level locking semantics
- Existing codebase -- sales.ts, inventory.ts, orders.ts, shifts.ts, motivation-calculation.ts, counters.ts, trade-in.ts, validations/motivation.ts

### Secondary (MEDIUM confidence)
- Prisma interactive transactions with raw queries -- verified via installed Prisma 7.4.2 (supports $queryRaw inside $transaction)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- все библиотеки уже в проекте, версии проверены через npm ls
- Architecture: HIGH -- паттерны SELECT FOR UPDATE в PostgreSQL хорошо документированы; Prisma $queryRaw проверен в кодовой базе
- Pitfalls: HIGH -- каждый pitfall основан на прямом чтении текущего кода и выявлении конкретных строк

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain -- PostgreSQL concurrency patterns don't change)
