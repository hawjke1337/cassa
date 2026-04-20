# Phase 2: Целостность данных - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Обеспечить корректность всех финансовых расчётов, остатков и нумерации даже при конкурентном доступе. Чисто серверные изменения — исправление race conditions, формул расчёта, откатов и валидаций в server actions. UI не затрагивается.

</domain>

<decisions>
## Implementation Decisions

### Блокировка остатков (DATA-01)
- SELECT FOR UPDATE на StoreProduct.quantity внутри Prisma `$transaction` + `$queryRaw`
- При продаже: `SELECT quantity FROM "StoreProduct" WHERE id = $1 FOR UPDATE` — блокирует строку до конца транзакции
- Если quantity < запрошенного — вернуть ошибку "Товар закончился" (не минусовой остаток)
- Pessimistic locking (не optimistic) — для ~10 пользователей overhead минимален, гарантия корректности максимальная
- Применить ко всем операциям уменьшения остатка: createSale, createReturn (увеличение), confirmReceive (увеличение), transfer, writeOff

### Транзакционная нумерация (DATA-02)
- getNextNumber должен работать внутри переданной транзакции (tx), а не создавать свою
- Сигнатура: `getNextNumber(prefix: string, tx?: PrismaTransactionClient)` — если tx передан, использовать его; иначе — db напрямую (обратная совместимость)
- Counter.upsert уже атомарен в PostgreSQL, но гонки возможны между двумя параллельными транзакциями — FOR UPDATE на Counter row
- `$queryRaw` для `SELECT current FROM "Counter" WHERE id = $1 FOR UPDATE` + increment

### Средневзвешенная costPrice (DATA-03)
- При confirmReceive: `newCostPrice = (oldQty * oldCostPrice + receiveQty * receiveCostPrice) / (oldQty + receiveQty)`
- Округление до 2 знаков (`.toFixed(2)`) — копейки
- Если oldQty = 0 (первая приёмка), costPrice = receiveCostPrice напрямую
- Обновлять StoreProduct.costPrice в той же транзакции что и quantity increment
- НЕ обновлять Product.costPrice (глобальный) — только StoreProduct (per-store)

### Откат заказа (DATA-04)
- cancelOrder должен в одной транзакции:
  1. Удалить/отменить все Payment записи связанные с заказом
  2. Вернуть серийники (SerialUnit) в статус IN_STOCK (если были привязаны)
  3. Откатить долг поставщику (если SupplierDebt был создан)
  4. Вернуть quantity на склад (StoreProduct.quantity += количество)
  5. Установить Order.status = "CANCELLED"
- Если заказ уже COMPLETED (товар отдан покупателю) — отмена запрещена, только возврат через createReturn

### sellPrice fallback (DATA-05)
- При создании StoreProduct для серийного товара: если sellPrice не задан или = 0, fallback = costPrice * 1.3 (30% наценка)
- Это дефолт, администратор может изменить потом
- Применять только при создании, не при обновлении

### Комиссия при частичном возврате (DATA-06)
- При возврате N из M единиц: вычитать комиссию за возвращённые N единиц из мотивации продавца
- Формула дедукции: та же calculateItemCommission с теми же rate/basis/type, но с quantity = N (возвращённые)
- ReturnDeduction в calculateEarnings уже есть — нужно исправить чтобы считал per-item, а не per-sale
- Комиссия за оставшиеся (M-N) единиц остаётся нетронутой

### Валидация rate мотивации (DATA-07)
- PERCENT: rate >= 0 и rate <= 1 (не > 100%)
- FIXED: rate >= 0 и rate <= 100000 (разумный максимум для фиксированной суммы)
- Валидация в Zod-схеме commissionRuleSchema + серверная проверка в saveMotivationScheme
- Существующие невалидные значения: не ломать, но при редактировании — требовать исправления

### Авто-закрытие смены (DATA-08)
- autoCloseShift: expectedCash = openingCash + sum(cash payments за смену) - sum(cash refunds за смену)
- discrepancy = actualCash - expectedCash
- Если нет данных о actualCash (авто-закрытие без кассира) — expectedCash всё равно считать, discrepancy = null (не 0)
- autoCloseShift вызывается планировщиком или при открытии новой смены

### searchSaleByNumber exact match (DATA-09)
- УЖЕ СДЕЛАНО в Phase 1 (01-01, commit 0ba7a58) — `equals` вместо `contains`
- Не требует дополнительной работы

### deleteTradeIn статус-проверка (DATA-10)
- Запретить удаление trade-in если статус IN_STOCK, SOLD, или IN_REPAIR
- Разрешить удаление только для PENDING (ожидает оценки) и REJECTED (отклонён)
- Вернуть понятную ошибку: "Невозможно удалить trade-in в статусе {status}"

### Claude's Discretion
- Конкретный формат ошибок при race condition (текст сообщения)
- Нужно ли логировать отмены заказов (audit trail)
- Оптимизация: batch SELECT FOR UPDATE для нескольких товаров в одной продаже

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (DATA-01..DATA-10).

### Ключевые файлы для изменения
- `src/actions/sales.ts` — SELECT FOR UPDATE при продаже (DATA-01), уже обновлён в Phase 1
- `src/actions/inventory.ts` — confirmReceive: средневзвешенная costPrice (DATA-03), sellPrice fallback (DATA-05)
- `src/actions/orders.ts` — cancelOrder: откат побочных эффектов (DATA-04)
- `src/actions/motivation-calculation.ts` — комиссия при частичном возврате (DATA-06)
- `src/actions/shifts.ts` — autoCloseShift: expectedCash расчёт (DATA-08)
- `src/actions/trade-in.ts` — deleteTradeIn: проверка статуса (DATA-10)
- `src/lib/counters.ts` — getNextNumber: транзакционная нумерация (DATA-02)
- `src/lib/validations/motivation.ts` — commissionRuleSchema: валидация rate (DATA-07)

### Контекст из Phase 1
- `.planning/phases/01-security/01-CONTEXT.md` — решения по валидации, Prisma transactions, requirePermission паттерны

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db.$transaction()` — уже используется повсеместно в sales.ts, inventory.ts, orders.ts
- `$queryRaw` — доступен в Prisma 7 для SELECT FOR UPDATE
- `calculateItemCommission()` в motivation-calculation.ts — готовая формула, нужно только исправить per-item дедукцию
- `getNextNumber()` в counters.ts — простая функция, легко расширить сигнатуру для tx
- Zod-схемы в validations/motivation.ts — commissionRuleSchema уже есть, добавить .max()

### Established Patterns
- Server actions: `await requirePermission(...)` первой строкой (Phase 1)
- Prisma transactions: `db.$transaction(async (tx) => { ... })` — все мутации внутри tx
- Ошибки: `throw new Error("Русское сообщение")` → клиент показывает через toast
- Числа: `Number()` для Decimal → number конвертации, `.toFixed(2)` для округления

### Integration Points
- `confirmReceive` в inventory.ts (строки 195-220) — точка для средневзвешенной costPrice
- `createSale` в sales.ts — уже в Phase 1 обновлён с транзакцией, добавить FOR UPDATE
- `calculateEarnings` в motivation-calculation.ts — ReturnDeduction секция для DATA-06
- `closeShift` / `autoCloseShift` в shifts.ts — expectedCash расчёт для DATA-08
- `deleteTradeIn` в trade-in.ts (строка 390) — добавить проверку статуса для DATA-10

</code_context>

<specifics>
## Specific Ideas

- DATA-09 (searchSaleByNumber exact match) уже выполнен в Phase 1 — пометить как done
- getNextNumber: сохранить обратную совместимость (опциональный tx параметр)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-tselostnost-dannykh*
*Context gathered: 2026-04-05 via auto-mode*
