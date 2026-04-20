# Phase 6: UX - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Финальная полировка UX: POS-интерфейс (debounce, персистентная корзина, штрихкод EAN-13, fix Escape), оплата (сдача в чеке/БД, защита от двойного клика, комментарий, печать возврата, история продаж), дашборд (прибыль/маржа, готовые ремонты, время смены, breadcrumbs, toast ошибки, shadcn Select).

</domain>

<decisions>
## Implementation Decisions

### Debounce поиска POS (UX-01)

- Debounce уже используется в некоторых компонентах (customers, trade-in, pos)
- Проверить pos-interface.tsx — если debounce уже есть, убедиться что время >= 300ms
- Добавить debounce на поля поиска в заказах и складе (если нет)
- Использовать один паттерн: `useDebouncedCallback` из use-debounce или кастомный хук

### Персистентная корзина POS (UX-02)

- `use-cart.ts` уже использует Zustand — проверить есть ли persist middleware
- Если нет — добавить `persist` middleware с localStorage
- Ключ: `astore-pos-cart`
- Очищать при успешном оформлении продажи (уже должно быть)
- НЕ синхронизировать между вкладками (один POS на один компьютер)

### Escape конфликт (UX-04)

- Escape на Dialog (shadcn) закрывает диалог
- Escape на POS корзине очищает корзину
- Проблема: Escape в открытом PaymentDialog очищает корзину ЗА диалогом
- Решение: event.stopPropagation() на Dialog overlay/escape handler, или проверять isDialogOpen перед очисткой

### Штрихкод EAN-13 (UX-05)

- Текущий scanner ищет только IMEI (15 цифр)
- EAN-13: 13 цифр — добавить в обработчик ввода
- Логика: если 13 цифр → искать по barcode (Product.barcode), если 15 → искать по IMEI (SerialUnit.imei)
- Авто-добавление в корзину при нахождении товара

### Сумма наличных и сдача (UX-03)

- В PaymentDialog: поле "Получено" (cashReceived) для наличных
- Автоматический расчёт сдачи: change = cashReceived - totalAmount
- Сохранять в БД: новые поля Sale.cashReceived и Sale.changeAmount (Decimal?)
- Отображать в чеке (print) и в карточке продажи
- Для безналичных — поля не нужны

### Защита от двойного клика (UX-08)

- В PaymentDialog: disabled кнопка после первого клика
- useTransition или useState isPending
- Визуальный feedback: спиннер на кнопке
- Серверная защита: уже есть через транзакцию (Phase 2), но клиентская нужна для UX

### Комментарий к продаже (UX-06)

- Текстовое поле в PaymentDialog (необязательное)
- Сохранять в Sale.comment (поле уже должно быть или добавить)
- Отображать в карточке продажи и в чеке

### Печатная форма возврата (UX-07)

- Аналогично чеку продажи — страница /print/return/[id]
- Данные: номер возврата, дата, товары, суммы, продавец
- Формат: A4 или термопринтер (как чек продажи)

### История продаж в POS (UX-09)

- Кнопка "История" в POS-интерфейсе
- Показывает последние 20 продаж текущей смены
- Поиск по номеру продажи (searchSaleByNumber уже есть с exact match из Phase 1)
- Клик → карточка продажи

### Прибыль и маржа на дашборде (UX-10)

- Карточка с прибылью за сегодня/неделю/месяц
- Данные из отчёта (getProfitReport уже SQL-оптимизирован в Phase 5)
- Маржа = прибыль / выручка \* 100%
- Цвет: зелёный если > 0, красный если < 0

### Breadcrumbs (UX-11)

- breadcrumb.tsx компонент уже есть
- header.tsx уже использует breadcrumbs — проверить покрытие
- Добавить на все 14 маршрутов если не покрыты
- Формат: Главная > Раздел > Подраздел

### Ошибки дашборда через toast (UX-12)

- try/catch на server actions в dashboard page
- Показывать через toast (shadcn toast уже есть)
- Не ломать весь дашборд — показывать частичные данные + toast с ошибкой

### readyRepairsCount на дашборде (UX-13)

- Данные уже есть (getRepairsCount или аналог)
- Добавить карточку "Готовые ремонты: N" на дашборд
- Клик → переход на /repairs?status=READY

### Время смены (UX-14)

- Сейчас в минутах — перевести в "Xч Yм"
- Утилита: formatDuration(minutes) → "2ч 15м"
- Применить в shift-detail и shifts-page

### Shadcn Select вместо native (UX-15)

- trade-in detail: нативный select → shadcn Select
- return-form: нативный select → shadcn Select
- Может быть и другие — проверить grep

### Claude's Discretion

- Точный layout истории продаж (modal vs sidebar vs drawer)
- Дизайн карточек дашборда (размер, иконки)
- Нужен ли отдельный route для печати возврата или модификация существующего
- Порядок карточек на дашборде

</decisions>

<canonical_refs>

## Canonical References

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (UX-01..UX-15).

### Ключевые файлы

- `src/components/pos/pos-interface.tsx` — основной POS UI (debounce, scanner, корзина)
- `src/hooks/use-cart.ts` — Zustand store корзины (persist check)
- `src/components/pos/payment-dialog.tsx` — оплата (сдача, двойной клик, комментарий)
- `src/app/(dashboard)/page.tsx` — дашборд (метрики, карточки)
- `src/components/layout/header.tsx` — breadcrumbs
- `src/components/pos/return-form.tsx` — нативный select (UX-15)
- `src/app/(dashboard)/trade-in/[id]/trade-in-detail-client.tsx` — нативный select (UX-15)

### Контекст из предыдущих фаз

- Phase 1: searchSaleByNumber exact match (UX-09 использует)
- Phase 2: SELECT FOR UPDATE, транзакции (серверная защита от дублей)
- Phase 5: SQL-оптимизированные отчёты (UX-10 использует), error boundaries (UX-12 дополняет)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `use-cart.ts` — Zustand store (проверить persist)
- `breadcrumb.tsx` — готовый компонент
- `searchSaleByNumber` — exact match из Phase 1
- `getProfitReport` — SQL-оптимизирован в Phase 5
- `formatMoney()` — для денежных значений
- shadcn toast, Dialog, Select — готовые компоненты

### Established Patterns

- POS: pos-interface.tsx управляет всем workflow
- Печать: /print/sale/[id], /print/shift/[id] — есть паттерн
- Дашборд: карточки с метриками (sales today, orders count)

### Integration Points

- PaymentDialog → Sale.cashReceived, Sale.changeAmount (новые поля)
- pos-interface.tsx → EAN-13 handler рядом с IMEI handler
- dashboard page.tsx → новые карточки (прибыль, ремонты)

</code_context>

<specifics>
## Specific Ideas

- EAN-13 handler: длина ввода 13 → barcode, 15 → IMEI
- formatDuration: `${Math.floor(min/60)}ч ${min%60}м`
- Корзина persist: один ключ localStorage, очистка при оформлении

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 06-ux_
_Context gathered: 2026-04-06 via auto-mode_
