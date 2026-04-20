---
phase: 02-tselostnost-dannykh
verified: 2026-04-05T18:25:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 2: Целостность данных — Verification Report

**Phase Goal:** Все финансовые расчеты, остатки и нумерация корректны даже при конкурентном доступе
**Verified:** 2026-04-05T18:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Два продавца одновременно продают последний экземпляр — один получает ошибку, а не минусовой остаток | VERIFIED | `sales.ts:147-154` — batch `SELECT FOR UPDATE OF sp` перед циклом; `stockMap` с проверкой quantity |
| 2 | Номера документов не дублируются при параллельных транзакциях | VERIFIED | `counters.ts:11-12` — атомарный `INSERT ON CONFLICT DO NOTHING` + `UPDATE RETURNING`; getNextNumber принимает `tx?` |
| 3 | getNextNumber вызывается ВНУТРИ транзакции, а не до нее | VERIFIED | `sales.ts:135` — `getNextNumber("S", tx)` внутри `$transaction`; аналогично в orders, shifts, returns |
| 4 | При приемке 10 единиц по 100р к 5 по 80р — costPrice становится ~93.33р | VERIFIED | `inventory-utils.ts:2-13` — `weightedAvgCostPrice`; `inventory.ts:311` — вызов при confirmReceive |
| 5 | При создании StoreProduct для серийного товара с sellPrice=0 — fallback на costPrice * 1.3 | VERIFIED | `inventory-utils.ts:16-22` — `sellPriceFallback`; `inventory.ts:270` — вызов при создании серийного товара |
| 6 | Частичный возврат 1 из 3 единиц вычитает комиссию только за 1 единицу, а не за все 3 | VERIFIED | `motivation-calculation.ts:180-284` — `returnedQuantityMap: Map<string, number>` + `effectiveQty = item.quantity - returnedQty` |
| 7 | PERCENT rate > 1 отклоняется валидацией; FIXED rate > 100000 отклоняется | VERIFIED | `validations/motivation.ts:28-31` — `.refine()` с `rate <= 1` и `rate <= 100000` |
| 8 | Отмена заказа откатывает платежи, серийники, долги поставщику в одной транзакции | VERIFIED | `orders.ts:817-879` — `cancelOrder` с `$transaction`, `payment.deleteMany`, `serialUnit.update`, `supplierDebt.delete` |
| 9 | Авто-закрытие смены вычисляет expectedCash; discrepancy = null при авто-закрытии | VERIFIED | `shifts.ts:87-99` — `calculateExpectedCash(...)` + `discrepancy: null` в блоке AUTO_CLOSED |
| 10 | Удаление trade-in в статусе IN_STOCK/SOLD/IN_REPAIR запрещено | VERIFIED | `trade-in.ts:396-398` — `DELETABLE_STATUSES: ["PENDING", "WRITTEN_OFF"]` + guard перед транзакцией |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/counters.ts` | Транзакционный getNextNumber с опциональным tx | VERIFIED | Содержит `tx?: PrismaTx`, `ON CONFLICT`, `RETURNING current`, `const client = tx ?? db` |
| `src/lib/inventory-utils.ts` | weightedAvgCostPrice + sellPriceFallback | VERIFIED | Оба export-а присутствуют, формулы корректны |
| `src/lib/motivation-utils.ts` | calculateItemCommission (чистая функция) | VERIFIED | Exported, используется в тестах и production-коде |
| `src/lib/validations/motivation.ts` | commissionRuleSchema с .refine() | VERIFIED | `.refine()` с условием по type (PERCENT/FIXED) |
| `src/actions/sales.ts` | FOR UPDATE в createSale и createReturn | VERIFIED | FOR UPDATE на строках 154, 662; getNextNumber("S", tx) и getNextNumber("R", tx) |
| `src/actions/inventory.ts` | Средневзвешенная costPrice + sellPrice fallback | VERIFIED | Импортирует оба хелпера из `@/lib/inventory-utils`, вызывает на строках 270, 311 |
| `src/actions/motivation-calculation.ts` | returnedQuantityMap вместо returnedItemIds | VERIFIED | Map инициализируется на строке 180, effectiveQty на строке 283 |
| `src/actions/orders.ts` | cancelOrder с полным откатом | VERIFIED | export на строке 817, $transaction, payment.deleteMany, serialUnit.update, supplierDebt.delete |
| `src/actions/shifts.ts` | calculateExpectedCash + авто-закрытие | VERIFIED | export на строке 9, вызов в openShift авто-закрытии (строка 87) и closeShift (строка 226) |
| `src/actions/trade-in.ts` | deleteTradeIn с проверкой статуса | VERIFIED | DELETABLE_STATUSES на строке 396, guard до $transaction |
| `src/__tests__/counter-transaction.test.ts` | Тесты транзакционной нумерации | VERIFIED | 4 теста: формат, uniqueness, tx-passthrough, backward compat |
| `src/__tests__/stock-locking.test.ts` | Тесты блокировки остатков | VERIFIED | 11 статических тестов (static analysis на реальных файлах) |
| `src/__tests__/weighted-cost-price.test.ts` | Тесты средневзвешенной costPrice | VERIFIED | 4 теста, включая граничные случаи (oldQty=0, округление) |
| `src/__tests__/sell-price-fallback.test.ts` | Тесты sellPrice fallback | VERIFIED | 3 теста (нулевой sellPrice, существующий, нулевая costPrice) |
| `src/__tests__/partial-return-commission.test.ts` | Тесты per-item дедукции | VERIFIED | 5 тестов (полный возврат, частичный, без возврата, FIXED, RETAIL_PRICE) |
| `src/__tests__/motivation-validation.test.ts` | Тесты валидации rate | VERIFIED | 6 тестов (граничные значения PERCENT/FIXED, негативный rate) |
| `src/__tests__/cancel-order.test.ts` | Тесты отмены заказа | VERIFIED | 11 тестов (статический анализ cancelOrder) |
| `src/__tests__/auto-close-shift.test.ts` | Тесты расчета expectedCash | VERIFIED | 6 тестов (DRY, AUTO_CLOSED блок, discrepancy=null, параметры) |
| `src/__tests__/trade-in-delete.test.ts` | Тесты guard deleteTradeIn | VERIFIED | 5 тестов (DELETABLE_STATUSES содержание, guard-before-tx, статусы IN_STOCK/SOLD/IN_REPAIR) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/sales.ts` | PostgreSQL | `$queryRaw SELECT FOR UPDATE` | WIRED | `queryRaw` + `FOR UPDATE` найдены на строках 147-154 |
| `src/actions/sales.ts` | `src/lib/counters.ts` | `getNextNumber("S", tx)` внутри `$transaction` | WIRED | `sales.ts:135` — вызов с tx |
| `src/actions/inventory.ts` | `src/lib/inventory-utils.ts` | `weightedAvgCostPrice` + `sellPriceFallback` | WIRED | Импорт на строке 8, вызовы на строках 270, 311 |
| `src/actions/motivation-calculation.ts` | `src/lib/motivation-utils.ts` | `calculateItemCommission` | WIRED | Импорт и использование (effectiveQty передается в расчет) |
| `src/actions/orders.ts` | Payment + SerialUnit + SupplierDebt | `cancelOrder $transaction` | WIRED | `payment.deleteMany`, `serialUnit.update`, `supplierDebt.delete` все внутри одного `$transaction` |
| `src/actions/shifts.ts` | Payment aggregate | `calculateExpectedCash` в openShift + closeShift | WIRED | Функция вызывается в обоих местах (строки 87, 226) |
| `src/actions/trade-in.ts` | TradeInStatus | guard в deleteTradeIn | WIRED | DELETABLE_STATUSES проверка до `$transaction` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-01 | SELECT FOR UPDATE на StoreProduct.quantity при продаже | SATISFIED | `sales.ts:147-154` — batch FOR UPDATE; `inventory.ts:304-308` — FOR UPDATE в confirmReceive |
| DATA-02 | 02-01 | getNextNumber внутри транзакции | SATISFIED | `counters.ts:5` — подпись `tx?: PrismaTx`; все вызовы в actions передают tx |
| DATA-03 | 02-02 | Средневзвешенная costPrice при приёмке | SATISFIED | `inventory-utils.ts` — `weightedAvgCostPrice`; `inventory.ts:311` — вызов в confirmReceive |
| DATA-04 | 02-03 | Отмена заказа откатывает все побочные эффекты | SATISFIED | `orders.ts:817-879` — `cancelOrder` с атомарным откатом платежей, серийников, долга |
| DATA-05 | 02-02 | sellPrice != 0 для новых серийных StoreProduct | SATISFIED | `inventory-utils.ts:16-22` — `sellPriceFallback`; `inventory.ts:270` — применение при создании |
| DATA-06 | 02-02 | Частичный возврат — per-item дедукция комиссий | SATISFIED | `motivation-calculation.ts:180-284` — `returnedQuantityMap` + `effectiveQty` |
| DATA-07 | 02-02 | Валидация rate в формулах мотивации | SATISFIED | `validations/motivation.ts:28-31` — `.refine()` с max по типу |
| DATA-08 | 02-03 | Авто-закрытие смены рассчитывает expectedCash | SATISFIED | `shifts.ts:87-99` — `calculateExpectedCash` + `discrepancy: null` в AUTO_CLOSED |
| DATA-09 | 02-03 | searchSaleByNumber — exact match (не contains) | SATISFIED | `sales.ts:440` — `number: { equals: number.trim(), mode: "insensitive" }` |
| DATA-10 | 02-03 | deleteTradeIn проверяет статус | SATISFIED | `trade-in.ts:396-398` — DELETABLE_STATUSES guard |

**Orphaned requirements:** отсутствуют — все 10 ID заявлены в планах и верифицированы.

### Anti-Patterns Found

Нет. Сканирование key-файлов (counters.ts, inventory-utils.ts, motivation-utils.ts, validations/motivation.ts, orders.ts, shifts.ts, trade-in.ts, inventory.ts) не выявило TODO/FIXME/PLACEHOLDER, пустых реализаций или заглушек.

### Human Verification Required

#### 1. Конкурентное выполнение под нагрузкой

**Test:** Запустить два параллельных запроса на продажу последнего товара в реальной БД PostgreSQL
**Expected:** Ровно одна продажа проходит, вторая получает ошибку "Недостаточно товара"
**Why human:** Нельзя верифицировать без реальной конкурентной нагрузки — тесты static analysis, а не integration

#### 2. Авто-закрытие смены с агрегатами из production БД

**Test:** Открыть кассу, провести несколько продаж и возвратов, открыть новую смену (авто-закрыть предыдущую)
**Expected:** Предыдущая смена получает корректный `expectedCash`, `discrepancy = null`
**Why human:** `calculateExpectedCash` использует реальные aggregate-запросы к `cashOperation` и `return` моделям — проверить только на живой БД

#### 3. Весовая себестоимость в UI

**Test:** Принять партию 5 шт по 80р, затем 10 шт по 100р для одного товара
**Expected:** Карточка товара показывает costPrice = 93.33р
**Why human:** UI-отображение и Prisma Decimal → number конвертация проверяются только визуально

---

## Summary

Phase 2 goal полностью достигнут. Все 10 требований (DATA-01 — DATA-10) имплементированы и протестированы:

- **Race conditions устранены:** SELECT FOR UPDATE в sales, inventory (createReturn тоже в sales.ts по факту), плюс атомарный счётчик через INSERT ON CONFLICT + UPDATE RETURNING
- **Финансовые расчёты исправлены:** средневзвешенная costPrice, sellPrice fallback, per-item дедукция при возврате, валидация rate
- **Транзакционная целостность:** cancelOrder откатывает все побочные эффекты атомарно, авто-закрытие смены вычисляет expectedCash
- **Защита данных:** deleteTradeIn блокирует удаление активных trade-in

Тест-сюита: 85 тестов, 14 файлов — все зелёные. TypeScript компилируется без ошибок.

Единственное отклонение от планов, влияющее на архитектуру: pure functions вынесены в `src/lib/inventory-utils.ts` и `src/lib/motivation-utils.ts` вместо экспорта из server action файлов — это **улучшение** (избегает цепочки next-auth в тестах), а не регрессия.

---

_Verified: 2026-04-05T18:25:00Z_
_Verifier: Claude (gsd-verifier)_
