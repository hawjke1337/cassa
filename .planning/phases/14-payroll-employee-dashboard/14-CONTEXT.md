# Phase 14: Payroll & Employee Dashboard - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправить per-item комиссию по заказам (CustomOrder), добавить историю расчётных листов по месяцам и группировку по сменам в личном кабинете сотрудника. Co-seller отложен на будущее.

</domain>

<decisions>
## Implementation Decisions

### Co-seller
- **ОТЛОЖЕН** — в 99% случаев один продавец в смене, co-seller не нужен сейчас
- Не добавлять coSellerId в Sale, не менять схему
- Вернуться когда реально понадобится (отдельная фаза)

### Per-item комиссия (PAYROLL-01)
- Проблема в заказах (CustomOrder): комиссия считается от общего netProfit заказа, а не per-item
- `orderItemCommissionDec` получает netProfit от `calculateNetProfit(totalAmount, discount, purchasePrice, deliveryCost)` — это общая прибыль по всему заказу
- Нужно: per-item расчёт для заказов так же как для обычных продаж (sellPrice - costPrice на каждую позицию)
- Проверить и исправить расчёт, покрыть E2E тестами

### Личный кабинет ЗП — история по месяцам (PAYROLL-05)
- Добавить таблицу расчётных листов (payroll records) в /my/motivation
- Столбцы: период, тип (аванс/итого), сумма, статус (черновик/подтверждён/выплачен)
- Клик на строку → расшифровка (переиспользовать существующий EarningsBreakdown)
- Скачивание PDF из таблицы

### Личный кабинет ЗП — группировка по сменам (PAYROLL-03, PAYROLL-04)
- Расшифровка комиссии группируется по сменам (складные секции)
- Каждая смена: дата, количество продаж, итого комиссия
- Разворачивается в список продаж с товарами: товар, цена, прибыль, %, сумма комиссии
- Привязка Sale к Shift через shiftId (уже есть в Sale)

### Безопасность данных (PAYROLL-06)
- Сотрудник видит ТОЛЬКО свои данные (userId из сессии)
- storeId scope: только магазины, к которым назначен
- Существующий checkPermission("motivation.payroll.own") уже работает

### Claude's Discretion
- Точная компоновка таблицы истории и складных секций
- Сортировка и пагинация истории
- Обработка пустых состояний

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Расчёт комиссий
- `src/actions/motivation-calculation.ts` — Текущий расчёт per-item комиссии, orderItemCommissionDec (проблемное место)
- `src/lib/order-utils.ts` — calculateNetProfit (используется для заказов)
- `src/lib/money.ts` — Decimal-safe арифметика (sum, sub, mul, toMoney)
- `src/lib/motivation-utils.ts` — Helper функции мотивации

### Payroll система
- `src/actions/motivation-payroll.ts` — CRUD payroll: generate, confirm, pay, delete, PDF
- `src/lib/validations/motivation.ts` — MotivationFormula тип, generatePayrollSchema
- `src/components/motivation/earnings-breakdown.tsx` — Компонент расшифровки (переиспользовать)
- `src/components/motivation/payroll-pdf-document.tsx` — PDF генерация

### Личный кабинет
- `src/app/(dashboard)/my/motivation/page.tsx` — Страница сотрудника (серверная)
- `src/app/(dashboard)/my/motivation/my-motivation-client.tsx` — Клиент (текущий UI)

### Схема БД
- `prisma/schema.prisma` — Sale.sellerId (единственный), Shift, Payroll model, CustomOrder

### Требования
- `.planning/REQUIREMENTS.md` — PAYROLL-01..PAYROLL-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EarningsBreakdown` компонент: полная расшифровка комиссии по продажам — переиспользовать для детализации по сменам
- `PayrollPdfDocument`: PDF генерация расчётного листа — уже работает
- `getPayrolls()`: получение списка payroll records с фильтрами — основа для истории
- `getMyEarnings()`: расчёт для текущего пользователя с scope check
- `useCurrentStore()` хук: выбор текущего магазина

### Established Patterns
- Все денежные расчёты через `src/lib/money.ts` (Decimal-safe)
- Permission check через `requirePermission()` / `checkPermission()`
- Payroll statuses: DRAFT → CONFIRMED → PAID
- Мотивационная схема: dailyRate + commissionRules (по группам товаров) + crossSellBonuses + repairBonus

### Integration Points
- Sale.shiftId — связь продажи со сменой (для группировки)
- MotivationAssignment — связь пользователь↔схема↔магазин
- getPayrollPdfData() — данные для PDF (уже scope-safe)

</code_context>

<specifics>
## Specific Ideas

- Пользователь отметил что проблема именно в заказах, не в обычных продажах — purchasePrice вводится при заказе и расчёт от общей прибыли может быть некорректным
- Складные секции для смен — как accordeon, компактно по умолчанию

</specifics>

<deferred>
## Deferred Ideas

- **Co-seller (PAYROLL-02)** — поддержка нескольких продавцов в одной продаже, split комиссии. Отложен: в 99% случаев один продавец в смене
- **Кастомные методы оплаты** — CRUD, комиссии, названия (записано в memory)

</deferred>

---

*Phase: 14-payroll-employee-dashboard*
*Context gathered: 2026-04-13*
