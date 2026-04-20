# Phase 16: Inventory Edge Cases & UX Polish - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Закрыть последние inventory edge cases (audit, transfer, category change, trade-in) и накопленный UX долг из QA: double-click protection, чеки/бланки, POS каталог, responsive, accessibility.

</domain>

<decisions>
## Implementation Decisions

### Category.isSerialized (INV-01)
- **Guard + админ override**: обычный пользователь не может сменить isSerialized если есть Products с SerialUnits. Админ может принудительно сменить с предупреждением и логированием
- UI показывает "Нельзя: есть N серийных товаров" для обычных, AlertDialog с предупреждением для админа

### Audit MISSING серийники (INV-02)
- При закрытии audit: ненайденные серийники → статус MISSING
- Следующий audit: если опять не найден → WRITTEN_OFF (списание)
- Можно вручную списать (WRITTEN_OFF) сразу из UI

### Audit expected qty (INV-03)
- **Пересчёт при закрытии**: expected qty считается НА МОМЕНТ закрытия audit, учитывая все продажи/возвраты/приёмы с момента открытия
- Расхождение = actualQty - expectedQty (на момент закрытия)

### StoreProductHistory (INV-04)
- **Отдельная модель** в Prisma: storeProductId, quantityBefore, quantityAfter, reason (SALE, RETURN, RECEIVE, TRANSFER, AUDIT, WRITE_OFF), userId, createdAt
- Заполняется в коде (не триггером) — есть userId из сессии

### Stock Transfer null sourceSp (INV-05)
- **Валидация + блок**: если товара нет на складе-источнике — ошибка "Товар не найден на складе". Нельзя создать transfer с несуществующим источником

### Receive sellPrice (INV-06)
- **Обязательный ввод вручную**: при создании нового StoreProduct из Receive — sellPrice обязательное поле, без auto-расчёта. Оператор вводит сам

### Trade-In agreedPrice=0 (INV-07)
- **Warning + пометка**: при agreedPrice=0 показать warning "Бесплатный приём — уверены?". В отчётах trade-in с ценой 0 помечаются как "Бесплатный приём". Не блокируем, но обращаем внимание

### Soft-deleted в audit (INV-08)
- **Фильтр "В т.ч. удалённые"**: по умолчанию скрыты. Toggle включает показ deleted-товаров с пометкой "Удалён" и визуальным отличием (серый/прозрачный)

### Trade-In из IN_STOCK (INV-09)
- **IN_STOCK + PENDING**: товар из trade-in можно создать с любым статусом. Оператор решает когда товар готов к продаже

### Trade-In UX (UX2-11)
- **Одно поле "Цена выкупа"**: вместо двух полей (Оценка/Согласовано) — одно итоговое поле. Упрощает форму для оператора

### createReturn confirmation (UX2-01)
- AlertDialog "Подтвердите возврат" перед выполнением. Кнопки: "Подтвердить возврат" (красная) / "Отмена"

### PaymentDialog double-click (UX2-02)
- **ref-lock + disable**: кнопка "Оплатить" дизейблится сразу при клике через useRef lock. Визуально: spinner + "Обработка...". Lock снимается только после ответа сервера

### closeShift расхождение (UX2-03)
- **AlertDialog + сумма**: при расхождении > 0 — AlertDialog "Подтвердите расхождение X₽?". Кнопки: "Подтвердить" (красная) / "Отмена"

### Блокировка корзины (UX2-04)
- **Вся корзина блокируется**: пока PaymentDialog открыт — корзина серая, нельзя добавлять/удалять/менять товары. Исключает рассинхрон между корзиной и оплатой

### Toast "Повторить" (UX2-05)
- **Критичные операции**: продажа, оплата, возврат, закрытие смены. Остальные — обычный toast без "Повторить"

### Idempotency-key (UX2-06)
- **Клиент UUID**: клиент генерирует UUID при открытии PaymentDialog. Сервер проверяет: если Sale с этим key уже есть — возвращает существующую. Поле idempotencyKey добавляется в модель Sale

### Inline валидация (UX2-07)
- Красные рамки + helper text для невалидных полей. Claude's Discretion: конкретные формы и поля

### POS responsive (UX2-08)
- **iPad/Android 10"**: breakpoint ~768px. Корзина схлопывается в выдвижную панель, товары в 2 колонки

### ARIA labels (UX2-09)
- Добавить aria-label на кастомные компоненты (SerialUnitPicker, PaymentDialog и др.). Claude's Discretion: конкретные компоненты

### Print preview (UX2-10)
- **Модальное окно перед печатью**: перед window.print() показать модальное окно с превью. Кнопки: "Печать" / "Отмена"

### IMEI в чеке (UX2-14)
- **Отдельная колонка в таблице чека**: Наименование | IMEI/SN | Кол | Цена. Для не-серийных — прочерк (—). Dual-SIM: оба IMEI через запятую

### Агрегация платежей в чеке (UX2-15)
- **По методу оплаты**: 3 платежа наличными → одна строка "Наличные: 75 000 ₽". Trade-in отдельной строкой

### Бланк заказа (UX2-12)
- **Полный бланк**: наименование товара, цвет/вариант, цена, предоплата, остаток, данные клиента (имя, телефон), условия заказа, сроки, место для подписи клиента

### Оплата заказа < остатка (UX2-13)
- Предупреждение при приёме оплаты меньше остатка. Claude's Discretion: формат предупреждения

### Каталог категорий в POS (UX2-17)
- **Сетка категорий**: когда поиск пустой — показать сетку категорий (iPhone, Samsung, Аксессуары...). Клик на категорию → фильтр товаров

### Объединение каталога и склада (UX2-16)
- **Один раздел "Товары"**: вместо двух пунктов меню (Каталог + Склад) — один "Товары". Tabs/toggle для переключения Каталог/Склад. Кнопка "Продать" в карточке товара

### Claude's Discretion
- Конкретные формы для inline валидации (UX2-07)
- Конкретные компоненты для ARIA labels (UX2-09)
- Формат предупреждения при оплате < остатка (UX2-13)
- Порядок миграций и разбивка на планы
- StoreProductHistory: какие операции помимо основных логировать

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Inventory & Audit
- `src/actions/audit.ts` — Текущая логика audit (open/close/count)
- `src/actions/inventory.ts` — Inventory management, receive, transfer, write-off
- `src/actions/trade-in.ts` — Trade-in flow, agreedPrice handling
- `src/actions/serial-units.ts` — SerialUnit status management
- `prisma/schema.prisma` — StoreProduct, SerialUnit, InventoryAudit, Category models

### POS & Payment
- `src/components/pos/payment-dialog.tsx` — PaymentDialog (double-click target)
- `src/components/pos/pos-interface.tsx` — POS layout (cart + product search)
- `src/components/pos/receipt-view.tsx` — Чек продажи (IMEI, payment aggregation)
- `src/components/pos/return-form.tsx` — Return form (AlertDialog target)
- `src/components/pos/close-shift-dialog.tsx` — Close shift (расхождение)
- `src/actions/sales.ts` — createSale (idempotency-key target)

### Print & Documents
- `src/components/print/print-layout.tsx` — Print layout component
- `src/actions/document-templates.ts` — Document templates (бланк заказа)

### Navigation & Layout
- `src/components/layout/app-sidebar.tsx` — Sidebar navigation (каталог/склад merge)
- `src/app/(dashboard)/catalog/` — Catalog pages
- `src/app/(dashboard)/inventory/` — Inventory pages

### Soft delete
- `src/lib/db.ts` — SOFT_DELETE_MODELS list, soft delete middleware

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/money.ts`: Decimal-safe арифметика — использовать для расчётов в audit/transfer
- `src/lib/imei-utils.ts`: IMEI validation — уже покрывает все точки входа (Phase 15)
- `src/lib/phone-utils.ts`: Phone normalization — уже применён (Phase 15)
- `src/lib/timezone.ts`: MSK timezone utilities — для date filtering в audit (Phase 15)
- `src/components/ui/`: shadcn/ui компоненты — AlertDialog, Toast, Dialog доступны

### Established Patterns
- Server actions с `requirePermission()` — все точки входа через server actions
- Prisma soft delete middleware — для фильтрации deletedAt
- `idempotencyKey` паттерн из Phase 9 — Race conditions & locking

### Integration Points
- POS interface: `pos-interface.tsx` → payment-dialog → sales action
- Sidebar navigation: `app-sidebar.tsx` → каталог/склад пункты меню
- Audit flow: `audit.ts` → inventory page → audit detail page
- Print: document-templates → print-layout → window.print()

</code_context>

<specifics>
## Specific Ideas

- IMEI/SN в чеке как отдельная колонка таблицы, не подстрока — пользователь хочет чистый табличный формат
- Бланк заказа — полный формат с условиями и местом для подписи клиента
- Объединение каталога и склада — один раздел "Товары" с tabs для переключения

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-inventory-edge-cases-ux-polish*
*Context gathered: 2026-04-14*
