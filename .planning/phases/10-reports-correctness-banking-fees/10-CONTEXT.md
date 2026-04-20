# Phase 10: Reports Correctness & Banking Fees - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Решения собраны из REQUIREMENTS.md (REP-01..07, FEE-01..05), Obsidian Mind багов (BUG-012, BUG-019, BUG-096, BUG-097, BUG-098, BUG-099, BUG-100), Phase 8 CONTEXT.md (carry-forward decisions) — обсуждение не потребовалось, всё уже зафиксировано.

<domain>
## Phase Boundary

Все отчёты и дашборд показывают финансовую правду — RETURNED/PARTIALLY_RETURNED исключены из revenue, returns вычитаются через JOIN, банковские комиссии учтены через обратный процент, кассовый отчёт за период с breakdown по методам оплаты.

**В скоупе:**

- **REP-01..02**: Фильтр `status='COMPLETED'` в getProfitReport и getSalesReport (исключить RETURNED/PARTIALLY_RETURNED)
- **REP-03**: Returns вычитаются из revenue в getProfitReport через LEFT JOIN Return
- **REP-04**: getSellerReport вычитает returns из выручки продавца
- **REP-05**: Inventory report фильтрует `product.isActive=true` и `deletedAt IS NULL`
- **REP-06**: Trade-in выплаты как расход магазина в финансовых отчётах
- **REP-07**: Новый кассовый отчёт за период (breakdown наличные/карта/СБП/перевод/кредит, сверка с кассой)
- **FEE-01**: Настройка % комиссий по методам оплаты (CARD, SBP, TRANSFER, CREDIT, CASH=0)
- **FEE-02**: Расчёт обратным процентом: `commission = amount / (1 - rate) - amount`
- **FEE-03**: POS показ "Цена / Комиссия / Итого к оплате" при безналичной оплате
- **FEE-04**: getProfitReport вычитает банковские комиссии из чистой прибыли
- **FEE-05**: Дашборд показывает чистую прибыль (после комиссий) и валовую отдельно
- E2E тесты на реальной БД для всех REP/FEE

**Вне скоупа (другие фазы):**

- Разная цена товара в зависимости от метода оплаты (BUG-012 п.5 — "возможно") — отложено
- Per-item commission для продавцов (Phase 14: Payroll)
- IDOR на reports.full storeId (Phase 12: Security Fixes)
- Optimistic locking (Phase 15)

</domain>

<decisions>
## Implementation Decisions

### Фильтрация статусов в отчётах (REP-01, REP-02)

- **`getSalesReport`** и **`getProfitReport`** добавляют `status: 'COMPLETED'` в WHERE.
- Текущий код: НЕ фильтрует по status (баг) — включает все продажи.
- Raw SQL запросы (chart, COGS, category breakdown, top products) — добавляется `AND s."status" = 'COMPLETED'`.
- Prisma aggregate (summary) — добавляется `status: 'COMPLETED'` в where.
- `getSellerReport` — тоже фильтрует `status: 'COMPLETED'`.
- `getDashboardData` — уже фильтрует правильно, но profit COGS query (line 62) тоже уже фильтрует. Ок.

### Вычитание returns из revenue (REP-03, REP-04)

- **`Sale.finalAmount` НЕ изменяется при возврате** (BUG-097). Returns хранятся в отдельной таблице `Return`.
- Формула revenue: `revenue = SUM(Sale.finalAmount) - SUM(Return.amount)` для каждой COMPLETED продажи.
- Реализация: `LEFT JOIN "Return" r ON r."saleId" = s."id"` → `COALESCE(SUM(r."amount"), 0)` вычитается.
- `getSellerReport`: вычитает returns при расчёте выручки и среднего чека продавца. Текущий код (line 433) просто суммирует `sale.finalAmount` — нужен пересчёт.
- COGS: НЕ вычитаем COGS за возвращённые позиции (возвращённый товар уже на складе, себестоимость остаётся).

### Inventory report fixes (REP-05)

- Текущий `getInventoryReport` использует `db.storeProduct.findMany` без фильтра `product.isActive` и без `deletedAt IS NULL`.
- Добавить: `product: { isActive: true, deletedAt: null }` в where.
- Soft delete `$extends` из Phase 3 покрывает `findMany` для StoreProduct, но Product JOIN нужен явный фильтр.

### Trade-in как расход (REP-06)

- TradeIn модель уже существует в schema с `payoutAmount` (Decimal).
- Trade-in выплата — расход магазина. В `getProfitReport` добавляется:
  - `SUM(TradeIn.payoutAmount)` за период где `status = 'COMPLETED'` (или аналогичный финальный статус).
  - Вычитается из чистой прибыли наравне с write-offs.
- В category/product breakdown: trade-in НЕ аффектит (это не COGS, а отдельный расход).

### Кассовый отчёт (REP-07)

- **Новый отчёт** `getCashReport(storeId, dateFrom, dateTo)` в `reports.ts`.
- Breakdown по `PaymentMethod`: CASH, CARD, SBP, TRANSFER, CREDIT — из таблицы `Payment`.
- Фильтрация: только `Payment` привязанные к `Sale` с `status = 'COMPLETED'` + Payments с `isExpense = true` (возвраты, компенсации).
- **Сверка с кассой:**
  - Ожидаемый наличный остаток = начальный остаток смены + CASH приходы - CASH расходы (refunds, CashOperation WITHDRAW).
  - `CashOperation` (DEPOSIT/WITHDRAW за период) учитываются.
  - Расхождение = ожидаемый - фактический (фактический — то что посчитал кассир при закрытии смены, `CashierShift.actualCash`).
- Группировка по сменам: breakdown показывает каждую смену за период с итогами.
- Включает: количество транзакций, сумму, расхождение по каждой смене.
- Существующий `getFundReport` остаётся — это про фонды, не про кассовый отчёт.

### Banking fee settings (FEE-01)

- **Новая модель** `PaymentFeeConfig` (или расширение Store settings):
  - `storeId` + `method` (PaymentMethod) → `feeRate` (Decimal, 0.00-1.00).
  - Defaults: CASH=0, CARD=0.02, SBP=0.007, TRANSFER=0.01, CREDIT=0.03.
  - Каждый магазин может иметь свои ставки (разные банки/терминалы).
- UI: раздел настроек магазина → "Комиссии по методам оплаты" (таблица с полями % для каждого метода).
- Право: `settings.fees` или reuse `settings.edit` — Claude's discretion.
- **Per-store** — разные магазины могут работать с разными банками/эквайрерами.

### Обратный процент (FEE-02)

- **Формула эквайринга** (из BUG-012): `commission = amount / (1 - rate) - amount`.
- Пример: товар 10000₽, ставка 2% → `10000 / 0.98 - 10000 = 204.08₽` (не 200₽).
- Итого к оплате: `10000 + 204.08 = 10204.08₽`.
- Pure function в `src/lib/money.ts`: `calcBankingFee(amount: Decimal, rate: Decimal): { fee: Decimal, total: Decimal }`.
- Precision: Decimal через `@/lib/money`, round to 2 decimal places.

### POS отображение комиссий (FEE-03)

- При выборе метода оплаты ≠ CASH в POS:
  - Показ: "Цена: X ₽ | Комиссия банка: Y ₽ | **Итого к оплате: Z ₽**"
  - Комиссия рассчитывается realtime при смене метода оплаты.
  - Для CASH — комиссия 0, показ стандартный.
- При split-payment (несколько методов): комиссия считается per-payment, суммируется.
- **Payment.amount хранит сумму БЕЗ комиссии** (цена товара). Комиссия — отдельное поле или вычисляемое.
- Для отчётов: `Payment.feeAmount` (Decimal?) — сохраняет рассчитанную комиссию на момент оплаты (чтобы при изменении ставки не пересчитывать историю).

### Profit report с комиссиями (FEE-04)

- `getProfitReport` текущие расчёты:
  - `grossProfit = revenue - COGS`
  - `netProfit = grossProfit - writeOffs`
- Добавляется:
  - `bankingFees = SUM(Payment.feeAmount)` для COMPLETED Sales за период
  - `tradeInExpenses = SUM(TradeIn.payoutAmount)` за период
  - `netProfit = grossProfit - writeOffs - bankingFees - tradeInExpenses`
- Response API расширяется: `{ ..., bankingFees, tradeInExpenses, netProfitAfterFees }`.

### Dashboard gross vs net (FEE-05)

- Текущий дашборд показывает одну карточку "Прибыль" (`todayProfit = revenue - COGS`).
- Расширяется на два числа:
  - **Валовая прибыль** = revenue - COGS (текущее).
  - **Чистая прибыль** = валовая - banking fees - trade-in expenses (за тот же период).
- UI: одна карточка с двумя строками или две отдельные карточки — Claude's discretion.
- Dashboard COGS query уже фильтрует `status = 'COMPLETED'` — корректно.

### Schema changes

- **`PaymentFeeConfig`** — новая модель: `id`, `storeId`, `method` (PaymentMethod), `feeRate` (Decimal).
  - Unique constraint: `(storeId, method)`.
- **`Payment.feeAmount`** — новая nullable Decimal колонка. Хранит рассчитанную комиссию на момент оплаты.
  - Backfill: NULL для существующих (не пересчитываем историю).
  - Для report: если `feeAmount IS NULL`, вычислять на лету из `PaymentFeeConfig` + `amount` (legacy fallback).
- Migration: Prisma migrate с explicit SQL для модели + колонки.

### Money arithmetic (carry-forward Phase 7)

- ТОЛЬКО через `@/lib/money` helpers.
- Money-guard ESLint уже активен для `reports.ts` — нарушения блокируют коммит.
- `calcBankingFee` реализуется через Decimal: `amount.div(Decimal.sub(1, rate)).sub(amount)`.

### E2E testing (carry-forward Phase 7)

- Каждая REP-_ и FEE-_ покрывается E2E на реальной БД.
- Паттерн: `src/__tests__/e2e/*.e2e.test.ts` + schema-per-worker.
- Success criteria #6: E2E с миксом COMPLETED, RETURNED, PARTIALLY_RETURNED — суммы совпадают с ручным расчётом.
- Banking fee E2E: настроить ставку → создать продажу с CARD → проверить feeAmount → проверить profit report.

### Claude's Discretion

- Точное имя модели для fee settings (`PaymentFeeConfig` vs `BankingFeeRate` vs расширение `Store`)
- Layout дашборда (две карточки vs одна с двумя строками для gross/net)
- Внутренняя структура кассового отчёта (группировка по сменам vs за период flat)
- Право доступа к настройкам комиссий (`settings.fees` vs reuse `settings.edit`)
- Нужен ли legacy fallback для `Payment.feeAmount IS NULL` или достаточно backfill=0
- Порядок wave-ов в PLAN.md
- Детальный набор E2E test cases

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements и баги

- `.planning/REQUIREMENTS.md` lines 153-167 — точные формулировки REP-01..07, FEE-01..05
- `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` §BUG-012 (line 105) — детальное описание комиссий, обратный процент, формулы
- `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` §BUG-019 (line 171) — описание кассового отчёта
- `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` §BUG-096 (line 704) — комиссии не вычитаются из прибыли
- `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md` §BUG-097 (line 710) — returns не вычитаются из revenue

### Roadmap и state

- `.planning/ROADMAP.md` §"Phase 10: Reports Correctness & Banking Fees" — goal, success criteria, dependencies
- `.planning/STATE.md` — carried decisions (Decimal everywhere, money-guard, E2E mandatory)

### Предыдущие фазы (carry-forward)

- `.planning/phases/08-order-sale-flow/08-CONTEXT.md` — решения по предоплатам, cancellationType, revenue semantics
- `.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md` — money arithmetic, E2E infrastructure

### Текущий код (дорабатывается)

- `src/actions/reports.ts` — getSalesReport (line 13), getProfitReport (line 164), getInventoryReport (line 276), getSellerReport (line 385), getFundReport (line 458)
- `src/actions/dashboard.ts` — getDashboardData (line 7)
- `src/lib/money.ts` — Decimal helpers (расширяется calcBankingFee)
- `prisma/schema.prisma` — Payment (line 303), PaymentMethod enum (line 333), TradeIn (line 1008)

### Тестовая инфраструктура

- `src/__tests__/helpers/db.ts` — schema-per-worker
- `src/__tests__/helpers/fixtures.ts` — фикстуры
- `src/__tests__/e2e/_template.e2e.test.ts` — шаблон E2E

### Quality

- `/Users/pushkarev/PROD/astore shop/CLAUDE.md` — production-grade, TDD, Awwwards UI

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`@/lib/money` (sum, sub, mul, div, toMoney, toClient)**: единственный способ денежной арифметики. Расширяется `calcBankingFee`.
- **`getFundReport` (reports.ts:458)**: паттерн для группировки CashOperation — reuse для кассового отчёта.
- **`getDashboardData` COGS query (dashboard.ts:62)**: уже правильно фильтрует status=COMPLETED — паттерн для других report fixes.
- **Phase 7 E2E infrastructure**: schema-per-worker, fixtures, template.
- **`requirePermission` / `checkPermission`**: стандартный auth check для отчётов.

### Established Patterns

- **Raw SQL `$queryRaw`** для всех агрегатных отчётов (reports.ts) — не Prisma aggregate для сложных JOIN.
- **Money-guard ESLint**: reports.ts уже под правилом — bare `Number()` на Decimal блокирует коммит.
- **Soft delete `$extends`** (Phase 3): findMany для StoreProduct покрыт, но Product JOIN нужен явный фильтр `deletedAt: null`.
- **`Prisma.sql` template literals** с `${storeFilter}` pattern для optional WHERE (reports.ts:62-78).

### Integration Points

- `reports.ts` → добавляются LEFT JOIN Return, status filter, banking fee SUM
- `dashboard.ts` → добавляется banking fee и trade-in expense для net profit
- `prisma/schema.prisma` → новая модель PaymentFeeConfig, новая колонка Payment.feeAmount
- `src/lib/money.ts` → новая функция calcBankingFee
- POS компоненты → отображение комиссий при безналичной оплате
- Settings UI → настройки процентов комиссий по методам оплаты

</code_context>

<specifics>
## Specific Ideas

- **Обратный процент — стандарт эквайринга** (BUG-012): `commission = amount / (1 - rate) - amount`, НЕ `amount * rate`. Это бизнес-требование от владельца.
- **`Payment.feeAmount` хранит комиссию на момент оплаты** — при изменении ставки не пересчитывать историю. Исторические данные (до Phase 10) — NULL/0.
- **Per-store ставки** — разные магазины могут работать с разными банками-эквайрерами.
- **Кассовый отчёт — сверка с физической кассой** (BUG-019): ожидаемый остаток vs фактический (`CashierShift.actualCash`).
- **Revenue заказа** (из Phase 8): `revenue = prepaidAmount + finalAmount = totalAmount - discount`. Удержанная предоплата (cancellationType='HOLD') — доход магазина.

</specifics>

<deferred>
## Deferred Ideas

- **Разная цена товара в зависимости от метода оплаты** (BUG-012 п.5: "наличные дешевле") — отложено, отдельная фича
- **Per-item commission для продавцов** — Phase 14 (Payroll)
- **IDOR на reports.full storeId проверка** — Phase 12 (Security Fixes)
- **Экспорт отчётов в Excel/PDF** — backlog

</deferred>

---

_Phase: 10-reports-correctness-banking-fees_
_Context gathered: 2026-04-09 (без интерактивной дискуссии — решения собраны из зафиксированных источников)_
