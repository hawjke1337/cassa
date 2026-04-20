# Phase 8: Order/Sale Flow & Предоплаты - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Source:** Решения собраны из REQUIREMENTS.md, STATE.md, памяти (project_prepayment_rule.md) и 08-RESEARCH.md — обсуждение не потребовалось, всё уже зафиксировано ранее.

<domain>
## Phase Boundary

Фаза закрывает 12 требований FIN-01..FIN-12 (баги BUG-018, BUG-023..025, BUG-038..042, BUG-057): корректное завершение заказа, отмена с учётом предоплаты, частичный возврат, атомарность и обязательность смены/метода возврата.

**В скоупе:**

- Завершение заказа: stock decrement, серийники → SOLD, Sale.finalAmount с учётом предоплаты
- Отмена заказа: явный выбор "удержать / вернуть" с compensating entries
- Частичный возврат: per-unit discount calculation для заказов
- Schema migrations: `Payment.shiftId` NOT NULL, `Return.refundMethod` NOT NULL
- Валидация: no-shift block, overpay block, atomic return
- Sync: `CustomOrder.status` ↔ `Sale.status` при возврате
- E2E coverage на реальной БД для всех FIN-\*

**Вне скоупа (другие фазы):**

- Полное locking SerialUnit/StoreProduct для POS createSale (Phase 9)
- Banking fees и reverse percent (Phase 10)
- Revenue semantics для удержанной предоплаты в отчётах (Phase 10)
- Optimistic locking для CustomOrder version field (Phase 15)
- Payment CHECK constraint "exactly one of (saleId,orderId,repairId)" (Phase 15)

</domain>

<decisions>
## Implementation Decisions

### Финансовая семантика завершения заказа (FIN-01)

- **`Sale.finalAmount = totalAmount − discount − prepaidAmount`** (Вариант А из research — locked в REQUIREMENTS.md FIN-01 + project_prepayment_rule.md)
- Смысл: сколько клиент доплачивает при выдаче. Предоплата уже в кассе с момента её внесения.
- `CustomOrder.finalAmount` тоже обновляется до этого значения при completion.
- Reports Phase 10 должны знать: revenue заказа = prepaidAmount + finalAmount (= totalAmount − discount).

### Предоплата: невозвратная по умолчанию (FIN-04, FIN-05, FIN-06)

- При отмене оператор делает **ЯВНЫЙ выбор** через RadioGroup в CancelDialog:
  - **"Удержать предоплату" (DEFAULT)** — Payments НЕ удаляются, `CustomOrder.status = CANCELLED`, `prepaidAmount` сохраняется. Деньги остаются в кассе магазина как доход.
  - **"Вернуть клиенту"** — для каждого оригинального Payment создаётся compensating entry:
    - `Payment { orderId, method: original.method, amount, isExpense: true, shiftId: openShift.id }`
    - Для CASH дополнительно `CashOperation { type: WITHDRAW, shiftId, reason: "Возврат предоплаты по заказу N" }`
    - `CustomOrder.prepaidAmount = 0`, `status = CANCELLED`
- **НИКОГДА не использовать `payment.deleteMany`** — уничтожает audit trail. Текущий код в `cancelOrder` (orders.ts:911) переписывается полностью.
- "Вернуть" требует OPEN shift — если нет, throw "Для возврата предоплаты откройте смену".
- Флаг для reports: `CustomOrder.cancellationType: "HOLD" | "REFUND" | null` — добавить колонку. Позволяет Phase 10 корректно считать revenue из удержанных предоплат.

### Stock & Serials при завершении заказа (FIN-02, FIN-03)

- **Портировать паттерн из `createSale` (sales.ts:148-323)**, не изобретать.
- Единый helper `decrementStockForItems(tx, storeId, items)` — вызывается из `createSale`, `completeOrder`, `payAndCompleteOrder`.
- **FOR UPDATE lock** на `StoreProduct` для всех несерийных `productId` ДО decrement (pessimistic, raw SQL — Prisma не поддерживает).
- **FOR UPDATE lock** на `SerialUnit` для всех связанных `serialUnitId` + re-check `status = 'IN_STOCK'` (минимум для Phase 8; Phase 9 доделает полное покрытие).
- Decrement через `storeProduct.update({ data: { quantity: { decrement } } })`.
- SerialUnit → SOLD + `SerialUnitHistory` запись внутри той же tx.
- Проверка достаточности остатка ДО списания — throw "Недостаточно остатка: {name}".

### Atomic Transitions (архитектура)

- Каждая order-транзиция = одна `db.$transaction` interactive, содержащая: lock → validate → write → history.
- Три публичных функции в orders.ts: `completeOrder`, `cancelOrderWithDecision`, `addOrderPayment` (существующая, hardening).
- Удалить/deprecated `updateOrderStatus(..., "COMPLETED")` и `payAndChangeStatus(..., "COMPLETED")` в пользу единого `completeOrder`.
- Prisma автоматически откатывает на throw — не писать ручные try/catch compensation.
- LOCK на `CustomOrder` row в начале каждой транзиции: `SELECT id FROM "CustomOrder" WHERE id = $1 FOR UPDATE` + re-check status.

### Concurrency strategy (FIN-10 + race protection)

- **Pessimistic FOR UPDATE** (raw SQL) для Phase 8 — портируем паттерн Phase 2 (STATE.md: "02-01: SELECT FOR UPDATE через raw SQL").
- Optimistic locking на `CustomOrder.version` отложен до Phase 15 (DATA2).
- Full SerialUnit/StoreProduct locking для всех POS flows — Phase 9.
- Phase 8 гарантирует atomicity для completeOrder, cancelOrderWithDecision, createReturn — этого достаточно для закрытия FIN-10.

### Per-unit discount для заказов (FIN-08)

- Order-level discount D пропорционально распределяется на `SaleItem.discount` по весу `price × quantity`.
- **Residual pattern** для precision: накапливать allocated, последний item получает `D - allocated` — гарантирует `sum(perItemDiscount × qty) === D` без drift.
- Pure function `computePerUnitDiscount(items, totalDiscount): Decimal[]` в `src/lib/orders/discount.ts` или extension `src/lib/money.ts` — решит planner.
- Unit тесты precision: 100₽/3 позиции, 99.99₽/2, 0₽/N, edge cases с разными quantity.
- Существующий паттерн `createReturn` (sales.ts:640) УЖЕ использует per-unit discount корректно — для order completion портируется.

### Schema migrations (FIN-09, FIN-11)

- **`Payment.shiftId`**: `String?` → `String` NOT NULL
  - Backfill strategy: для существующих NULL — прикрепить к ближайшему открытому/закрытому shift того же storeId по `createdAt`. Если невозможно — создать sentinel shift или оставить с логом (планирует planner).
  - Blocking migration: приложение должно иметь guards в коде ДО миграции, иначе крэш.
- **`Return.refundMethod`**: `PaymentMethod?` → `PaymentMethod` NOT NULL
  - Backfill: derive из первого `Payment.method` связанного Sale.
- **Новая колонка `CustomOrder.cancellationType: String?`** (enum `"HOLD" | "REFUND"`) — nullable т.к. имеет смысл только при status=CANCELLED.
- Миграции пишутся через Prisma migrate с explicit SQL для backfill (паттерн из Phase 3).

### Refund method validation (FIN-09)

- **Soft set policy**: `refundMethod ∈ set(sale.payments.map(p => p.method))`. Т.е. возвращаемый метод должен присутствовать среди оригинальных методов оплаты.
- При многометодных платежах (часть наличкой, часть картой) — UI предлагает выбор из списка оригинальных.
- Строгая эквивалентность (один-в-один) отвергнута: нельзя при смешанной оплате.
- Явная ошибка: "Метод возврата {X} не совпадает с методами оплаты: {list}".

### Prepayment Payments — shift assignment в созданном Sale (FIN-11 follow-up)

- При создании Sale из Order: оригинальные prepayment Payments переносятся под Sale с сохранением их `shiftId` (той смены, когда был внесён). Новые final payments — под смену completion.
- Преимущество: reports по сменам корректны (касса не "двигает" деньги между сменами задним числом).
- Реализация: `Payment.saleId` указывает на новый Sale, но `Payment.shiftId` остаётся без изменений.

### Overpay blocking (FIN-12)

- В `addOrderPayment` и `completeOrder`:

```ts
const existing = sum(...order.payments.map((p) => toMoney(p.amount)))
const newTotal = sum(existing, toMoney(payment.amount))
if (newTotal.gt(order.totalAmount)) throw new Error("Переплата заказа: уменьшите сумму")
```

- Никаких credit balance, никакого silent accept. Жёсткая блокировка.

### Order ↔ Sale status sync при возврате (FIN-07)

- В `createReturn` (sales.ts:721-726) после обновления `Sale.status`:
  - Если `sale.customOrderId != null` — обновить `CustomOrder.status`:
    - Full return → `CANCELLED` (reuse existing status — не плодим enum)
    - Partial return → оставляем `COMPLETED` (товар частично у клиента)
  - Запись в `OrderStatusHistory` с reason "Возврат Sale #{number}".
- **Reuse `CANCELLED`, не добавляем `REFUNDED`** — избегаем enum drift. `OrderStatusHistory` содержит достаточно контекста для аудита. (Решение из research open Q#2, recommendation применена.)

### Shift requirement (FIN-11)

- **`completeOrder` throws без OPEN shift** — немедленно, не `shiftId ?? null`.
- **`addOrderPayment` throws без OPEN shift** — то же.
- **`cancelOrderWithDecision` с action=REFUND требует OPEN shift** — т.к. создаются CashOperation/Payment.
- **`cancelOrderWithDecision` с action=HOLD НЕ требует shift** — статус меняется, денежные операции не создаются.

### Money arithmetic (carried from Phase 7)

- **ТОЛЬКО через `@/lib/money` helpers** (`sum`, `sub`, `mul`, `div`, `toMoney`, `toClient`).
- Money-guard ESLint уже активен для `sales.ts` и `orders.ts` — нарушения блокируют коммит.
- Никаких bare `Number()`, `parseFloat`, `+`, `*` на денежных значениях.
- API boundary: `.toNumber()` только для полей, которые возвращаются как number (backward compat) — всё остальное через `toClient()` → Branded Money string.

### E2E Testing (carried from Phase 7)

- **Каждая FIN-\* покрывается E2E на реальной БД** — моки запрещены (из v1.0 audit: 100 багов пропущены моками).
- Паттерн: `src/__tests__/e2e/*.e2e.test.ts` + schema-per-worker (Phase 7-01).
- Фикстуры: `createTestOrderWithPrepayment`, `createTestShift` — добавляются в `helpers/fixtures.ts` если отсутствуют.
- **Wave 0 (TDD RED)**: тесты пишутся ДО implementation — плановый подход.
- Минимум 6 E2E файлов (по research): order-completion, order-cancel (Hold+Refund), order-return-sync, partial-return-per-unit, order-payment-constraints (shift+overpay+refundMethod), return-midway-failure.
- Unit тест: `compute-per-unit-discount.test.ts` — pure function precision.
- **Test dimensions matrix** (research 08-RESEARCH.md §Validation Architecture): item type (серия/несерия/микс), prepayment (0/partial/full), discount (0/per-line/order), shift (OPEN/CLOSED/NONE), failure injection, cancel action (HOLD/REFUND для CASH и CARD).

### Invariants (E2E property checks)

Каждый E2E после ACT проверяет (из research):

1. Stock conservation — `sum(StoreProduct.quantity) + sum(SaleItem − Return)` == initial
2. Serial consistency — `SerialUnit.status=SOLD` ↔ SaleItem exists ∧ !RETURNED
3. Money conservation — `sum(Payment !isExpense) − sum(Payment isExpense) == revenue + held prepayments`
4. Shift consistency — `Payment.shiftId != null` всегда после миграции
5. Return cap — `sum(Return.amount per sale) <= sale.finalAmount`
6. Order ↔ Sale link — `CustomOrder.saleId != null` ↔ `status=COMPLETED`

### UI decisions

- **CancelDialog** (`src/components/orders/order-detail.tsx:1218-1266`) расширяется:
  - RadioGroup "Удержать предоплату" (default, `HandCoins` icon) / "Вернуть клиенту" (`Ban` icon)
  - При "Вернуть" — предупреждение "Требуется открытая смена. Возврат создаст расход в кассе."
  - Textarea reason остаётся обязательным для обоих вариантов
  - При отсутствии `prepaidAmount > 0` — radio скрыт (нечего удерживать/возвращать)
- **Return form** (`src/components/pos/return-form.tsx`): поле `refundMethod` обязательное (Select из методов оригинальных Payments). Placeholder с подсказкой при одном методе.
- Уровень дизайна — Awwwards (из CLAUDE.md quality standard).

### Claude's Discretion

- Точное имя helper функций (`decrementStockForItems` vs `applyStockChanges` vs др.)
- Внутренняя структура unit тестов (table-driven vs describe-блоки)
- Формат error messages (русский, но точная формулировка)
- Расположение `computePerUnitDiscount` (в `lib/money.ts`, `lib/orders/`, или inline)
- Migration SQL structure и backfill edge cases (когда не найдено shift/method)
- Порядок wave-ов в PLAN.md — planner решает согласно dependency graph research §Dependencies Between Tasks
- Точный набор E2E test cases внутри каждого файла (но все dimensions matrix должны быть покрыты)
- Нужен ли отдельный `Payment.reason` текстовый для compensating entries или достаточно CashOperation.reason

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning или implementing.**

### Фаза исследования и roadmap

- `.planning/phases/08-order-sale-flow/08-RESEARCH.md` — полный анализ codebase, gap matrix, architecture patterns, code examples, test plan, open questions resolved в этом CONTEXT.md
- `.planning/ROADMAP.md` §"Phase 8: Order/Sale Flow & Предоплаты" — goal, success criteria, dependencies
- `.planning/REQUIREMENTS.md` lines 127-140 — точные формулировки FIN-01..FIN-12

### Бизнес-правила и контекст v1.1

- `.planning/STATE.md` §"Key v1.1 Decisions" — carried-forward решения (Decimal everywhere, money-guard, E2E mandatory, prepayment невозвратная)
- `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` — исходные BUG-018, BUG-023, BUG-024, BUG-025, BUG-038, BUG-039, BUG-041, BUG-042, BUG-057 (при необходимости)
- Memory: `project_prepayment_rule.md` — правило невозвратной предоплаты, формула finalAmount

### Инфраструктура и эталонный код

- `src/actions/sales.ts` lines 123-362 (`createSale`) — эталон: FOR UPDATE lock, decrement, SerialUnit → SOLD, required shift
- `src/actions/sales.ts` lines 581-736 (`createReturn`) — эталон: per-unit refund, restore stock, tx atomicity; ДОРАБАТЫВАЕМ: refundMethod NOT NULL, sync CustomOrder
- `src/actions/orders.ts` lines 281-460 (`updateOrderStatus`) — ПЕРЕПИСЫВАЕТСЯ (baseline для gap analysis)
- `src/actions/orders.ts` lines 579-725 (`payAndChangeStatus`) — ПЕРЕПИСЫВАЕТСЯ
- `src/actions/orders.ts` lines 911-977 (`cancelOrder`) — ПЕРЕПИСЫВАЕТСЯ полностью (deleteMany → compensating)
- `src/lib/money.ts` — Decimal helpers (Phase 7 locked contract)
- `src/lib/counters.ts` — `getNextNumber('S'|'R', tx)` атомарная нумерация
- `src/lib/permissions.ts` — `requirePermission('orders.manage', storeId)`
- `prisma/schema.prisma` lines 242-371 (Sale/Payment/Return), 542-623 (CustomOrder), 1083-1135 (CashOperation/SerialUnit) — схема под миграции

### Тестовая инфраструктура (Phase 7)

- `src/__tests__/helpers/db.ts` — schema-per-worker
- `src/__tests__/helpers/fixtures.ts` — фикстуры (расширяется)
- `src/__tests__/e2e/_template.e2e.test.ts` — шаблон E2E
- `src/__tests__/e2e/sales-decimal.e2e.test.ts` — reference e2e-real-db
- `docs/E2E-TESTING.md` (Phase 7-05) — onboarding

### UI

- `src/components/orders/order-detail.tsx` lines 1218-1266 (CancelDialog) — расширяется RadioGroup
- `src/components/pos/return-form.tsx` — refundMethod обязательное поле

### CLAUDE.md / quality

- `/Users/pushkarev/PROD/astore shop/CLAUDE.md` — production-grade, TDD, security review, Awwwards UI

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`createSale` (sales.ts:123-362)**: эталонный atomic transaction с FOR UPDATE lock, decrement stock, SerialUnit update. Полностью портируется в `completeOrder`.
- **`createReturn` (sales.ts:581-736)**: per-unit refund calculation уже корректен. Дорабатывается refundMethod validation + CustomOrder sync.
- **`@/lib/money`**: `sum`, `sub`, `mul`, `div`, `toMoney`, `toClient` — единственный способ денежной арифметики.
- **`@/lib/counters.getNextNumber('S'|'R', tx)`**: атомарная нумерация внутри tx, raw SQL INSERT ON CONFLICT.
- **`@/lib/permissions.requirePermission('orders.manage', storeId)`**: стандартный auth check.
- **Phase 7 E2E infrastructure**: `helpers/db.ts` schema-per-worker, `helpers/fixtures.ts`, `_template.e2e.test.ts`.
- **`db.ts $extends`** (Phase 3-02, STATE.md): перехватывает findMany/findFirst/count для soft delete — findUnique НЕ покрыт (Phase 12 фикс).
- **`VALID_TRANSITIONS` map** (orders.ts:13-22): FSM для CustomOrderStatus, reuse.

### Established Patterns

- **Pessimistic FOR UPDATE через raw SQL** (Phase 2-01, 2026-04-05): `await tx.$queryRaw\`SELECT ... FOR UPDATE\`` перед update. Phase 8 применяет это к CustomOrder, StoreProduct, SerialUnit.
- **Interactive `db.$transaction`**: Prisma auto-rollback на throw — не писать ручные compensations в JS.
- **Money-guard ESLint**: sales.ts + orders.ts уже под правилом — любой bare `Number(decimal)` ломает lint/commit.
- **E2E on real DB**: обязательно для каждой FIN-\*, схема очищается через schema-per-worker (Phase 7).
- **Zod validation на client payload** (createSale pattern): strip unknown fields, server всегда использует DB значения для цен/стоимостей.
- **OrderStatusHistory логирование** для всех status transitions — уже есть.

### Integration Points

- `orders.ts` → `sales.ts`: новая dependency на shared stock helper (возможно `src/lib/inventory/decrement.ts`)
- `prisma/schema.prisma`: migrations для Payment.shiftId, Return.refundMethod, CustomOrder.cancellationType
- `/settings/` UI → Phase 12 не затрагиваем
- Phase 10 reports: ждёт `cancellationType` флаг для revenue calc
- Phase 11 repair→Sale: зависит от `completeOrder` паттерна (reuse helper)
- `src/components/orders/order-detail.tsx` CancelDialog — UI расширение
- `src/components/pos/return-form.tsx` — refundMethod required

</code_context>

<specifics>
## Specific Ideas

- **Без REFUNDED enum value** — reuse `CANCELLED` + `OrderStatusHistory` для аудита. Избегаем enum drift, STATE.md патерн "минимум schema changes".
- **Compensating entries, НЕ deleteMany** — audit trail священен (decision из памяти + research pitfall).
- **Residual pattern для discount drift** — precision-safe распределение по items (research Pattern 3).
- **"Удержать" как default** — бизнес-правило невозвратной предоплаты (project_prepayment_rule.md).
- **Phase 8 делает минимум SerialUnit locking только для completion** — full coverage в Phase 9. Не пытаемся решить всё сразу.
- **Идемпотентность через status re-check после lock** — если cancel+complete гонка, второй выбрасывает "Нельзя из статуса X". Уникальный constraint на Payment(orderId, isExpense) для compensating — рассмотреть в planner (research Pitfall 3).

</specifics>

<deferred>
## Deferred Ideas

- **Full SerialUnit/StoreProduct locking для createSale и confirmTransferSent** — Phase 9 (LOCK-\*)
- **Banking fees reverse percent** — Phase 10 (FEE-\*)
- **Revenue semantics для удержанной предоплаты в reports** — Phase 10 (REP-\*); cancellationType флаг подготовлен здесь, использование — там
- **Payment CHECK constraint "exactly one of (saleId,orderId,repairId)"** — Phase 15 (DATA2-01)
- **CustomOrder.version для optimistic locking** — Phase 15 (DATA2-10)
- **IDOR getSale / reports.full storeId проверка** — Phase 12 (SEC2-01)
- **Расширение money-guard ESLint scope на 13 файлов вне hotspots** — Phase 15 (deferred-items.md)
- **Idempotency-key для createSale / completeOrder** — Phase 16 (UX2-\*) double-click prevention

</deferred>

---

_Phase: 08-order-sale-flow_
_Context gathered: 2026-04-08 (без интерактивной дискуссии — решения собраны из зафиксированных источников)_
