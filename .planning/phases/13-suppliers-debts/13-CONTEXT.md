# Phase 13: Suppliers & Debts - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Долг поставщику считается от закупочной цены, оплачивается через кассу с явным учётом (частичная оплата, CashOperation, SupplierPayment), владелец видит сводку и историю платежей. Обновление существующих страниц + новые страницы и компоненты.

</domain>

<decisions>
## Implementation Decisions

### Оплата долга через кассу (SUP-06)
- markSupplierDebtPaid переделывается: создаёт **SupplierPayment** + **CashOperation(WITHDRAWAL, shiftId=null)**
- Оплата **без открытой смены** — это административная операция, CashOperation.shiftId = null (нужна миграция: сделать shiftId nullable)
- **Частичная оплата**: оператор вводит сумму, долг закрывается когда sum(payments) >= debt.amount
- **Пермишн**: новый `suppliers.pay` (отдельно от orders.manage)
- **AlertDialog** перед оплатой: показывает сумму, остаток, поле комментария
- **Новая модель SupplierPayment**: (debtId, amount, paidAt, comment, cashOperationId?, userId)
- isPaid на SupplierDebt — вычисляется: sum(payments) >= amount, или обновляется автоматически после каждого платежа

### purchasePrice и формирование долга (SUP-01, SUP-02)
- purchasePrice вводится **AFTER COMPLETED** (без изменений, как в Phase 4)
- **Без блокировки ORDERED** — purchasePrice не требуется для перевода в ORDERED
- Долг создаётся от **costPrice * qty** при ORDERED (как сейчас), обновляется при вводе purchasePrice через updateOrderCosts
- purchasePrice на **весь заказ** (не per-item) — решение Phase 4 сохраняется
- Если purchasePrice не введён — прибыль: "Не рассчитана" (серый текст)

### Обновление суммы долга (SUP-05)
- Через **updateOrderCosts** (пермишн orders.manage_costs) — автоматическое обновление debt.amount
- Если часть долга уже оплачена и сумма меняется — **разрешить**: remaining = newAmount - sum(payments). Если remaining <= 0 — долг закрывается автоматически

### Отображение цен в карточке заказа (SUP-03, SUP-04)
- Три суммы: **Цена клиенту / Закуп / Прибыль** — видны только с пермишном **orders.costs**
- Город поставщика **подтягивается из Supplier.city** (не хранится в заказе), отображается в UI
- Прибыль если purchasePrice не введён: **"Не рассчитана"** (серый текст)

### Дашборд и сводка долгов (SUP-07, SUP-08, SUP-09)
- Страница долгов в **обоих местах**: /reports/supplier-debts (существует) + /suppliers/debts (новая)
- Навигация: **подпункт "Долги"** в разделе "Поставщики" в сайдбаре
- Карточка на дашборде: "Долги поставщикам: X ₽ (N неоплаченных)" — видна только с **orders.costs**
- История платежей в карточке поставщика: **таблица SupplierPayment[]** (дата, сумма, заказ #, комментарий)

### Audit log интеграция
- createAuditEntry на: **оплату долга**, **изменение суммы долга**, **создание долга**
- Использовать инфраструктуру из Phase 12 (createAuditEntry helper)

### E2E тесты
- Критичные сценарии:
  - Оплата долга → SupplierPayment + CashOperation(WITHDRAWAL, shiftId=null) создаются
  - Две частичных оплаты → долг закрывается когда sum >= amount
  - Обновление суммы после частичной оплаты → remaining пересчитан
  - Отмена заказа с частично оплаченным долгом → корректная очистка

### Claude's Discretion
- Точный layout карточки долга на странице /suppliers/debts
- Нужен ли pagination на странице /suppliers/debts или infinite scroll
- Формат комментария при оплате (свободный текст или предустановленные варианты)
- Нужна ли группировка долгов по поставщику на /suppliers/debts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Существующий код долгов и оплат
- `src/actions/orders.ts` — markSupplierDebtPaid (переделать), updateOrderCosts (обновляет debt.amount), SupplierDebt create при ORDERED
- `src/actions/suppliers.ts` — CRUD поставщиков, getSupplier (уже считает unpaidDebts)
- `src/app/(dashboard)/reports/supplier-debts/` — существующая страница долгов (дополнить частичной оплатой)
- `src/components/orders/order-detail.tsx` — карточка заказа (добавить три суммы)
- `src/app/(dashboard)/suppliers/[id]/` — карточка поставщика (добавить историю платежей)

### Модели и схема
- `prisma/schema.prisma` — SupplierDebt (строка 655), CashOperation (shiftId → сделать nullable), добавить SupplierPayment

### Phase 12 инфраструктура
- `src/lib/audit.ts` — createAuditEntry helper для audit log
- `src/lib/rate-limit.ts` — checkWriteRateLimit для rate limiting на write actions

### Контекст предыдущих фаз
- `.planning/phases/04-zakazy-i-postavshchiki/04-CONTEXT.md` — решения по purchasePrice/deliveryCost, SupplierDebt workflow
- `.planning/REQUIREMENTS.md` §SUP-01..09 — все 9 requirements этой фазы

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `markSupplierDebtPaid(debtId, comment?)` — существует, но только ставит isPaid=true. Переделать: создавать SupplierPayment + CashOperation
- `updateOrderCosts(orderId, {purchasePrice, deliveryCost})` — уже обновляет debt.amount через updateOrderCosts
- `getSupplierDebtsReport(filters)` — server action для /reports/supplier-debts. Дополнить частичной оплатой
- `getSupplier(id)` — уже считает unpaidDebts aggregate. Добавить историю SupplierPayment[]
- `createAuditEntry(entityType, entityId, action, details)` — Phase 12 helper
- `InlineAuditHistory` — Phase 12 компонент (можно использовать как reference)
- `SupplierDebtsClient` — существующий компонент таблицы долгов с фильтрами

### Established Patterns
- Server actions: requirePermission первой строкой
- CashOperation создаётся через createCashOperation(shiftId, type, amount, reason) — нужно адаптировать для shiftId=null
- Prisma transactions для мутаций с побочными эффектами
- formatMoney() для денежных значений

### Integration Points
- **CashOperation.shiftId**: сейчас NOT NULL (FK). Нужна миграция: ALTER TABLE сделать nullable
- **markSupplierDebtPaid**: рефакторинг основной entry point
- **Dashboard page** (`src/app/(dashboard)/page.tsx`): добавить карточку долгов
- **Sidebar navigation**: добавить подпункт "Долги" в раздел "Поставщики"
- **permissions-list.ts**: добавить suppliers.pay permission

</code_context>

<specifics>
## Specific Ideas

- Оплата долга — административная операция (без смены), а не POS-операция
- Частичная оплата критична для бизнеса — поставщики часто оплачиваются частями
- Город поставщика подтягивается автоматически из Supplier.city, не хранится в заказе
- SupplierPayment отдельная таблица (не Payment) — не ломает CHECK constraint из Phase 15

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-suppliers-debts*
*Context gathered: 2026-04-12*
