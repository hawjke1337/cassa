# Phase 9: Race Conditions & Locking - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Решения собраны из REQUIREMENTS.md (LOCK-01..06), bug reports (BUG-044..047, BUG-053, BUG-080), STATE.md, Phase 7-8 CONTEXT.md, и кодовой базы — всё уже зафиксировано.

<domain>
## Phase Boundary

Фаза закрывает 6 требований LOCK-01..LOCK-06: добавление SELECT FOR UPDATE на SerialUnit и StoreProduct во всех мутирующих операциях, атомарный stock decrement в createSale, failure recovery в confirmReceive, и reservation stock при PENDING transfer.

**В скоупе:**

- LOCK-01: FOR UPDATE на SerialUnit в createSale (BUG-044)
- LOCK-02: FOR UPDATE на StoreProduct в confirmTransferSent (BUG-045)
- LOCK-03: Атомарный stock decrement в createSale — до/вместе с Sale.create (BUG-046)
- LOCK-04: Failure recovery в confirmReceive SerialUnit-цикле — нет orphaned StoreProduct (BUG-047)
- LOCK-05: FOR UPDATE на StoreProduct в createWriteOff (BUG-053)
- LOCK-06: Stock reservation при PENDING transfer (BUG-080)
- E2E concurrency тесты для каждого LOCK-\*
- Hotfix deferred failures из Phase 8 (partial-return-per-unit, assertOrderSaleLink edge)

**Вне скоупа (другие фазы):**

- Optimistic locking на CustomOrder.version, MotivationScheme.version (Phase 15)
- Payment CHECK constraint exclusivity (Phase 15)
- Reports correctness (Phase 10)
- UI отображение зарезервированного stock (Phase 16 UX polish)

</domain>

<decisions>
## Implementation Decisions

### Паттерн FOR UPDATE (LOCK-01, LOCK-02, LOCK-05)

- **Портировать существующий паттерн из `stock-helpers.ts`** — raw SQL `SELECT ... FOR UPDATE`, Prisma не поддерживает нативно.
- LOCK-01: В `createSale` (sales.ts) для серийных товаров добавить `SELECT id FROM "SerialUnit" WHERE id = ANY($1) FOR UPDATE` + re-check `status = 'IN_STOCK'` перед изменением. Паттерн уже используется в `completeOrder` (orders.ts:1062-1070).
- LOCK-02: В `confirmTransferSent` (inventory.ts) добавить FOR UPDATE на StoreProduct источника перед decrement. Переиспользовать `decrementStockForItems` или его паттерн.
- LOCK-05: В `createWriteOff` (inventory.ts) добавить FOR UPDATE на StoreProduct перед decrement. Аналогично LOCK-02.
- Единый порядок блокировки: сначала StoreProduct (по productId ASC), потом SerialUnit (по id ASC) — предотвращает deadlock.

### Атомарный stock decrement в createSale (LOCK-03)

- **Stock decrement и Sale.create в одной `db.$transaction` interactive** — уже реализовано в sales.ts (FOR UPDATE + decrement внутри транзакции), но нужно верифицировать что decrement происходит ДО create или атомарно с ним.
- Проверка: quantity >= requested ПОСЛЕ lock, ДО decrement — throw "Недостаточно остатка: {name}" при race condition.
- Использовать `decrementStockForItems` из `stock-helpers.ts` (уже batch lock + decrement).

### Failure recovery в confirmReceive (LOCK-04)

- Весь SerialUnit-цикл в `confirmReceive` (inventory.ts) должен быть **внутри одной транзакции**.
- Если SerialUnit.create fails (duplicate IMEI, constraint violation) — вся транзакция откатывается, включая StoreProduct.quantity increment.
- НЕ нужен ручной compensation — Prisma interactive transaction автоматически откатывает при throw.
- Проверка: в текущем коде цикл уже внутри `$transaction`? Если нет — обернуть.

### Stock reservation при PENDING transfer (LOCK-06)

- **Подход: `reservedQuantity` поле на StoreProduct** — новая колонка `Int @default(0)`.
- При создании transfer (status=PENDING): `reservedQuantity += transferQuantity` в источнике.
- Доступный остаток для продажи: `availableQuantity = quantity - reservedQuantity`.
- При confirmTransferSent: `quantity -= transferQuantity`, `reservedQuantity -= transferQuantity`.
- При cancelTransfer: `reservedQuantity -= transferQuantity` (stock возвращается в доступные).
- POS и все stock-check операции используют `availableQuantity` вместо `quantity`.
- Migration: `ALTER TABLE "StoreProduct" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0`.
- CHECK constraint: `reservedQuantity >= 0`, `quantity >= reservedQuantity`.

### Concurrency error UX

- При race condition rejection — throw конкретное сообщение: "Товар уже продан другим продавцом" (серийный) / "Недостаточно остатка: {name}" (несерийный).
- Server action возвращает ошибку → toast в UI через существующий error handling паттерн.
- Корзина НЕ очищается автоматически — продавец видит ошибку и решает сам (убрать товар, заменить, повторить).

### E2E Concurrency тестирование

- **Реальные параллельные транзакции** через `Promise.allSettled([createSale(tx1), createSale(tx2)])` на одну SerialUnit/StoreProduct.
- Ожидаемый результат: ровно 1 fulfilled + 1 rejected.
- Тест на каждый LOCK: createSale (serial), createSale (non-serial), confirmTransferSent, confirmReceive, createWriteOff, transfer+sale conflict.
- Инфраструктура Phase 7 (schema-per-worker, TRUNCATE) — готова.

### Claude's Discretion

- Конкретная реализация batch lock запросов (один SELECT vs несколько)
- Порядок операций внутри транзакций (при сохранении атомарности)
- Структура E2E тест-файлов (один файл vs по файлу на LOCK)
- Hotfix deferred failures из Phase 8 — конкретный подход к фиксу

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locking requirements

- `.planning/REQUIREMENTS.md` §v1.1 "Race Conditions & Locking (LOCK)" — 6 requirements LOCK-01..06
- `.planning/ROADMAP.md` §"Phase 9: Race Conditions & Locking" — goal, success criteria, depends

### Bug reports

- `../../../Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` — BUG-044, BUG-045, BUG-046, BUG-047, BUG-053, BUG-080

### Existing locking patterns

- `src/lib/stock-helpers.ts` — `decrementStockForItems` batch FOR UPDATE helper
- `src/actions/sales.ts:180-236` — existing FOR UPDATE pattern in createSale (StoreProduct only, SerialUnit missing)
- `src/actions/orders.ts:989-1070` — completeOrder FOR UPDATE pattern (includes SerialUnit)
- `src/actions/inventory.ts:304-308` — confirmReceive FOR UPDATE on non-serialized

### Prior phase decisions

- `.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md` — E2E test framework, Decimal strategy
- `.planning/phases/08-order-sale-flow/08-CONTEXT.md` §"Concurrency strategy" — pessimistic FOR UPDATE decision
- `.planning/phases/08-order-sale-flow/08-CONTEXT.md` §"Stock & Serials" — decrementStockForItems pattern

### Deferred items from Phase 8

- `.planning/phases/08-order-sale-flow/deferred-items.md` — partial-return E2E edge, assertOrderSaleLink full-return

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/lib/stock-helpers.ts`: `decrementStockForItems(tx, storeId, items)` — batch lock StoreProduct + decrement. Переиспользовать для LOCK-02, LOCK-05.
- `src/actions/orders.ts:1062-1070`: FOR UPDATE pattern для SerialUnit — портировать в createSale для LOCK-01.
- `src/__tests__/stock-locking.test.ts`: static analysis тесты проверяющие наличие FOR UPDATE в source — расширить для новых locks.
- `src/__tests__/e2e-real-db/`: E2E infrastructure из Phase 7 (schema isolation, fixtures, TRUNCATE).

### Established Patterns

- Raw SQL для FOR UPDATE: `tx.$queryRaw\`SELECT ... FOR UPDATE\`` — единственный способ с Prisma.
- Interactive transactions: `db.$transaction(async (tx) => { ... })` — все мутации внутри.
- Error handling: throw внутри tx → Prisma откатывает → server action ловит → toast в UI.
- Batch lock ordering: StoreProduct rows sorted by productId для предотвращения deadlock (stock-helpers.ts:56-63).

### Integration Points

- `src/actions/sales.ts`: createSale — основная точка для LOCK-01, LOCK-03.
- `src/actions/inventory.ts`: confirmTransferSent (LOCK-02), confirmReceive (LOCK-04), createWriteOff (LOCK-05), createTransfer/cancelTransfer (LOCK-06).
- `src/app/pos/`: POS UI — должен показывать availableQuantity вместо quantity после LOCK-06.
- `prisma/schema.prisma`: StoreProduct model — добавление reservedQuantity.

</code_context>

<specifics>
## Specific Ideas

- Phase 8 STATE.md: "Phase 9 готова к discuss-phase", deferred hotfixes от Phase 8 включены в scope
- Success Criteria из ROADMAP.md: "Два продавца одновременно сканируют один IMEI — один получает ошибку" — конкретный E2E сценарий обязателен
- Невозвратная предоплата decision (project_prepayment_rule.md) не затрагивается Phase 9

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 09-race-conditions-locking_
_Context gathered: 2026-04-09_
