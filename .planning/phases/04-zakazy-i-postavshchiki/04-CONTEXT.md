# Phase 4: Заказы и поставщики - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Доработать workflow заказов: выбор поставщика, ввод закупочной цены и доставки после завершения, расчёт чистой прибыли, автоматический учёт долга поставщику, отчёт по долгам, комиссия продавца от чистой прибыли, скидка при выдаче заказа, редактирование цены товара в заказе.

</domain>

<decisions>
## Implementation Decisions

### Выбор поставщика при создании заказа (ORD-01)
- Выпадающий список поставщиков (Supplier) при создании CustomOrder
- supplierId уже есть в модели CustomOrder — нужно только UI (Select компонент)
- Поставщик опциональный (можно создать заказ без поставщика)
- Список поставщиков из getSuppliers (уже есть action) — фильтровать по deletedAt: null (Phase 3 soft delete)

### Ввод закупочной цены и доставки (ORD-02)
- Отдельное действие ПОСЛЕ статуса COMPLETED (товар выдан)
- Новые поля в CustomOrder: `purchasePrice Decimal?`, `deliveryCost Decimal?`
- Permission: `orders.manage_costs` — отдельный от `orders.create`
- UI: кнопка "Ввести закупочные данные" в карточке заказа → модальное окно
- Закупочная цена и доставка вводятся на ВЕСЬ заказ (не per-item) — простота для первой итерации

### Расчёт чистой прибыли (ORD-03)
- `netProfit = totalAmount - discountAmount - (purchasePrice ?? 0) - (deliveryCost ?? 0)`
- Отображать в карточке заказа: "Чистая прибыль: X руб" (зелёный/красный)
- Если purchasePrice не введена — показывать "Прибыль: не рассчитана" (серый текст)
- Вычисляемое поле (не хранить в БД) — считать на лету

### Автоматический долг поставщику (ORD-04)
- SupplierDebt УЖЕ создаётся при статусе ORDERED (orders.ts:435)
- Сумма долга = purchasePrice + deliveryCost (обновлять при вводе ORD-02)
- Если purchasePrice не введена, долг = totalAmount заказа (приблизительно)
- Пометка "Оплачен" через markSupplierDebtPaid (уже есть action)
- При cancelOrder долг удаляется (уже реализовано в Phase 2)

### Отчёт по долгам поставщикам (ORD-05)
- Новая страница: /dashboard/reports/supplier-debts
- Таблица: Поставщик | Заказ # | Сумма | Дата | Статус (Оплачен/Не оплачен)
- Фильтры: поставщик, статус, период
- Итоги: общая задолженность, оплачено за период
- Server action: getSupplierDebtsReport(filters) — SQL агрегация (не загрузка всех в память)

### Комиссия от чистой прибыли (ORD-06)
- В calculateEarnings (motivation-calculation.ts): для заказов использовать netProfit вместо sellPrice - costPrice
- Формула: `commission = netProfit * rate` (для PROFIT basis)
- Если purchasePrice не введена — комиссия = 0 (не начислять пока неизвестна прибыль)
- Только для заказов (Sale с orderId != null), обычные продажи — без изменений

### Скидка при выдаче заказа (ORD-07)
- discountAmount в Sale при статусе COMPLETED уже есть (сейчас хардкод 0)
- Передавать discountAmount из формы выдачи заказа
- Валидация: discountAmount >= 0 и discountAmount <= totalAmount
- Пересчёт netProfit с учётом скидки

### Редактирование цены товара в заказе (ORD-08)
- В CustomOrderItem: разрешить редактирование price при создании/редактировании заказа
- UI: поле цены в строке товара заказа — editable
- Валидация: price > 0
- При изменении цены → пересчёт totalAmount заказа

### Claude's Discretion
- Точный layout карточки заказа (расположение блоков)
- Нужен ли confirmation dialog при вводе закупочных данных
- Формат отчёта по долгам (compact vs detailed)
- Нужен ли export отчёта (CSV/PDF) — скорее нет для Phase 4

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (ORD-01..ORD-08).

### Ключевые файлы для изменения
- `src/actions/orders.ts` — createOrder, updateOrderStatus, cancelOrder (уже с Phase 2 откатом)
- `src/actions/motivation-calculation.ts` — calculateEarnings, calculateItemCommission
- `src/actions/reports.ts` — существующие отчёты (паттерн для нового)
- `prisma/schema.prisma` — CustomOrder (добавить purchasePrice, deliveryCost)
- `src/app/(dashboard)/orders/` — UI страницы заказов

### Контекст из предыдущих фаз
- `.planning/phases/01-security/01-CONTEXT.md` — requirePermission паттерны
- `.planning/phases/02-tselostnost-dannykh/02-CONTEXT.md` — SELECT FOR UPDATE, транзакции, cancelOrder
- `.planning/phases/03-skhema-bd/03-CONTEXT.md` — soft delete ($extends), onDelete, CHECK constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `markSupplierDebtPaid(debtId, comment?)` — уже существует в orders.ts
- `SupplierDebt` модель — уже создаётся при ORDERED, удаляется при cancel
- `getSuppliers()` — action для списка поставщиков
- `netProfit` — уже считается в reports.ts (другая формула, но паттерн есть)
- `discountAmount` — поле в Sale, хардкодится 0 в orders.ts (строки 384, 571)
- `calculateItemCommission` — уже вынесена в motivation-utils.ts (Phase 2)

### Established Patterns
- Server actions: requirePermission первой строкой
- Prisma transactions для мутаций
- shadcn/ui Select для выпадающих списков
- TanStack Table для таблиц отчётов
- formatMoney() для денежных значений

### Integration Points
- `updateOrderStatus` в orders.ts — точка для SupplierDebt обновления при вводе costs
- `createSaleFromOrder` — внутри updateOrderStatus при COMPLETED — передать discountAmount
- `calculateEarnings` — добавить ветку для заказов vs обычных продаж

</code_context>

<specifics>
## Specific Ideas

- purchasePrice/deliveryCost на ВЕСЬ заказ, не per-item — простота первой итерации
- Комиссия = 0 если purchasePrice не введена — защита от некорректных начислений
- SupplierDebt.amount обновлять при вводе реальных закупочных данных

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-zakazy-i-postavshchiki*
*Context gathered: 2026-04-05 via auto-mode*
