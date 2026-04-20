---
phase: 04-zakazy-i-postavshchiki
verified: 2026-04-05T23:44:30Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 04: Заказы и поставщики — Отчёт верификации

**Phase Goal:** Владелец видит реальную прибыль по каждому заказу и контролирует долги поставщикам
**Verified:** 2026-04-05T23:44:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 04-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | При создании заказа продавец может выбрать поставщика из выпадающего списка | VERIFIED | `order-form.tsx:6` импортирует `getSuppliersList`, рендерит `<Select>` на строке 231; `createOrder` принимает `supplierId` (orders.ts:216, 254) |
| 2 | После завершения заказа менеджер может ввести закупочную цену и стоимость доставки | VERIFIED | `updateOrderCosts` (orders.ts:496-537) с guard `order.status !== "COMPLETED"` и permission `orders.manage_costs`; UI-диалог в order-detail.tsx |
| 3 | В карточке заказа отображается чистая прибыль (или "не рассчитана" если нет закупочной цены) | VERIFIED | order-detail.tsx:367-381 вызывает `calculateNetProfit` и рендерит `"не рассчитана"` или цветную сумму |
| 4 | При вводе закупочных данных сумма долга поставщику обновляется автоматически | VERIFIED | orders.ts:527-531 — `tx.supplierDebt.update` в той же транзакции, что и обновление заказа |
| 5 | При выдаче заказа можно применить скидку (не хардкод 0) | VERIFIED | orders.ts:347-399 и 657-688: `discountAmount = extraData?.discountAmount ?? 0` в обоих COMPLETED-флоу |
| 6 | Цена товара в заказе редактируема, totalAmount пересчитывается | VERIFIED | `updateOrderItem` (orders.ts:539-597) обновляет item и пересчитывает totalAmount через агрегацию всех позиций |

### Observable Truths (Plan 04-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Отчет по долгам поставщикам доступен по адресу /dashboard/reports/supplier-debts | VERIFIED | Файл `src/app/(dashboard)/reports/supplier-debts/page.tsx` существует, сервер-компонент с permission check |
| 8 | Отчет показывает поставщика, номер заказа, сумму, дату, статус оплаты | VERIFIED | supplier-debts-client.tsx рендерит таблицу со всеми столбцами + Badge статуса |
| 9 | Отчет фильтруется по поставщику, статусу оплаты и периоду | VERIFIED | supplier-debts-client.tsx:44-78 — state для supplierId, statusFilter, dateFrom, dateTo; передаются в getSupplierDebtsReport |
| 10 | Отчет показывает итоговую задолженность и оплаченную сумму | VERIFIED | `getSupplierDebtsReport` (reports.ts:549-563) возвращает `totalUnpaid`, `unpaidCount`, `totalPaid`, `paidCount` через Prisma aggregate |
| 11 | Комиссия продавца от заказов считается от чистой прибыли (netProfit) | VERIFIED | motivation-calculation.ts:168-311 включает customOrder в запрос и вызывает `calculateOrderItemCommission` с netProfit |
| 12 | Если purchasePrice не введена, комиссия за заказ = 0 | VERIFIED | motivation-utils.ts:22 — `calculateOrderItemCommission` возвращает 0 при `netProfit === null` (для PERCENT basis) |

**Score: 12/12 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | purchasePrice и deliveryCost в CustomOrder | VERIFIED | Строки 556-557: оба поля `Decimal? @db.Decimal(12, 2)` |
| `prisma/migrations/20260405202306_add_order_purchase_costs/` | Миграция БД | VERIFIED | Директория существует |
| `src/lib/order-utils.ts` | Pure functions: calculateNetProfit, calculateOrderTotalAmount, validateDiscountAmount | VERIFIED | Все 4 функции реализованы (+ validateOrderCostsInput), файл 45 строк |
| `src/lib/permissions-list.ts` | orders.manage_costs permission | VERIFIED | Строка 27: `ORDERS_MANAGE_COSTS`, добавлен в owner role (строка 131) |
| `src/actions/orders.ts` | updateOrderCosts, updateOrderItem; supplierId в createOrder; discountAmount в COMPLETED | VERIFIED | Все экспорты присутствуют и реализованы |
| `src/components/orders/order-form.tsx` | Supplier select с getSuppliersList | VERIFIED | Строка 6 — import, строка 231 — Select компонент |
| `src/components/orders/order-detail.tsx` | Net profit display, cost entry dialog, discount fields | VERIFIED | calculateNetProfit импортирован и используется для рендеринга |
| `src/__tests__/order-net-profit.test.ts` | 5 тестов calculateNetProfit | VERIFIED | 5 тестов проходят |
| `src/__tests__/order-costs.test.ts` | 6 тестов validateOrderCostsInput | VERIFIED | 6 тестов проходят |
| `src/__tests__/order-discount.test.ts` | 4 теста validateDiscountAmount | VERIFIED | 4 теста проходят |
| `src/__tests__/order-item-edit.test.ts` | 3 теста calculateOrderTotalAmount | VERIFIED | 3 теста проходят |
| `src/lib/motivation-utils.ts` | calculateOrderItemCommission | VERIFIED | Строка 22 — функция экспортирована |
| `src/actions/motivation-calculation.ts` | Комиссия от netProfit, include customOrder | VERIFIED | Строки 168-311 — полная интеграция |
| `src/__tests__/order-commission.test.ts` | 9 тестов calculateOrderItemCommission | VERIFIED | 9 тестов проходят |
| `src/actions/reports.ts` | getSupplierDebtsReport с фильтрами и агрегацией | VERIFIED | Строка 505 — функция, строка 512 — permission check, строки 534-563 — aggregate |
| `src/app/(dashboard)/reports/supplier-debts/page.tsx` | Страница отчета с permission guard | VERIFIED | 24 строки, server component, redirect при отсутствии доступа |
| `src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx` | Client component с фильтрами и таблицей | VERIFIED | Полная реализация — фильтры, таблица, summary cards, кнопка "Отметить оплаченным" |
| `src/app/(dashboard)/reports/page.tsx` | Ссылка на /reports/supplier-debts | VERIFIED | Строка 31 — `href="/reports/supplier-debts"` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `orders.ts (updateOrderCosts)` | `prisma.supplierDebt.update` | `$transaction` | WIRED | orders.ts:527-531 — update в транзакции |
| `orders.ts (COMPLETED flow)` | `sale.create discountAmount` | `extraData?.discountAmount` | WIRED | orders.ts:347, 399, 657, 688 — в обоих флоу |
| `order-detail.tsx` | `src/lib/order-utils.ts` | `calculateNetProfit import` | WIRED | order-detail.tsx:19 — import, :367 — вызов с рендерингом результата |
| `supplier-debts page` | `getSupplierDebtsReport` | `import + call` | WIRED | supplier-debts-client.tsx:24 — import, :63 — вызов |
| `motivation-calculation.ts` | `customOrder.purchasePrice` | `include в sales query` | WIRED | motivation-calculation.ts:168-169 — `include: { customOrder: { select: ... } }` |
| `reports/page.tsx` | `/dashboard/reports/supplier-debts` | `Link href` | WIRED | reports/page.tsx:31 — href присутствует |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ORD-01 | 04-01 | Выпадающий список поставщиков при создании заказа | SATISFIED | `getSuppliersList` в order-form.tsx, `supplierId` в `createOrder` |
| ORD-02 | 04-01 | Ввод закупочной цены и стоимости доставки после завершения (отдельный permission) | SATISFIED | `updateOrderCosts` с `orders.manage_costs` guard |
| ORD-03 | 04-01 | Расчёт чистой прибыли по заказу (продажа - закупка - доставка) | SATISFIED | `calculateNetProfit` в order-utils.ts, отображение в order-detail.tsx |
| ORD-04 | 04-01 | Автоматический учёт долга поставщику при подтверждении заказа | SATISFIED | `updateOrderCosts` синхронизирует `supplierDebt.amount` в одной транзакции |
| ORD-05 | 04-02 | Отчёт по долгам поставщикам | SATISFIED | `/reports/supplier-debts` с фильтрами и итогами |
| ORD-06 | 04-02 | Комиссия продавца от заказов считается от чистой прибыли | SATISFIED | `calculateOrderItemCommission` в motivation-utils.ts, интегрировано в motivation-calculation.ts |
| ORD-07 | 04-01 | Скидка при выдаче заказа (discountAmount не хардкод 0) | SATISFIED | `extraData?.discountAmount ?? 0` в обоих COMPLETED флоу orders.ts |
| ORD-08 | 04-01 | Редактирование цены товара в заказе (индивидуальная скидка) | SATISFIED | `updateOrderItem` пересчитывает totalAmount; editable price в order-form.tsx |

**Orphaned requirements:** Нет — все 8 IDs из REQUIREMENTS.md покрыты планами 04-01 и 04-02.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | — |

Сканирование ключевых файлов фазы (order-detail.tsx, order-form.tsx, orders.ts, motivation-calculation.ts, supplier-debts-client.tsx, order-utils.ts) не обнаружило заглушек, пустых реализаций или TODO-комментариев в функциональном коде. Все `placeholder` атрибуты — легитимные атрибуты `<input>` в формах.

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| order-net-profit.test.ts | 5/5 | PASSED |
| order-costs.test.ts | 6/6 | PASSED |
| order-discount.test.ts | 4/4 | PASSED |
| order-item-edit.test.ts | 3/3 | PASSED |
| order-commission.test.ts | 9/9 | PASSED |
| **Full suite** | **112/112** | **PASSED** |

TypeScript: `npx tsc --noEmit` — 0 ошибок.

---

## Human Verification Required

### 1. Диалог подтверждения закупочных данных

**Test:** Открыть завершённый заказ, нажать "Ввести закупочные данные", заполнить поля, убедиться в появлении шага подтверждения с суммой долга до финального сохранения.
**Expected:** Двухшаговый ввод: форма → подтверждение с итогами → сохранение.
**Why human:** Поведение UI-диалога нельзя проверить статически.

### 2. Отображение цвета прибыли

**Test:** Создать заказ, ввести закупочные данные, убедиться что прибыль отображается зелёным (>0), красным (<0), или серым курсивом "не рассчитана".
**Expected:** Цветовая индикация прибыли согласно значению.
**Why human:** CSS-классы верифицированы в коде, но визуальное отображение требует ручной проверки.

### 3. Фильтры отчёта по долгам

**Test:** Открыть /reports/supplier-debts, применить каждый фильтр (поставщик, статус, период), убедиться что таблица перефильтровывается корректно.
**Expected:** Фильтрация работает в реальном времени или по кнопке, итоги пересчитываются.
**Why human:** Интерактивное поведение клиентского компонента.

---

## Summary

Все 12 must-have условий подтверждены. Все 8 требований (ORD-01 — ORD-08) выполнены и покрыты кодом. Две ключевые цели фазы достигнуты:

1. **Реальная прибыль по заказам**: `calculateNetProfit` работает, отображается в карточке заказа с цветовой индикацией. Закупочная цена и стоимость доставки вводятся через permission-защищённый action, который синхронно обновляет долг поставщику.

2. **Контроль долгов поставщикам**: Отчёт `/reports/supplier-debts` реализован с фильтрами по поставщику, статусу и периоду, отображает суммарную задолженность и оплаченные суммы. Комиссии продавцов для заказов пересчитаны от чистой прибыли.

Миграция БД применена. TypeScript компилируется без ошибок. 112 тестов проходят.

---

_Verified: 2026-04-05T23:44:30Z_
_Verifier: Claude (gsd-verifier)_
