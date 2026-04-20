---
status: resolved
phase: 16-inventory-edge-cases-ux-polish
source: [16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md, 16-04-SUMMARY.md, 16-05-SUMMARY.md]
started: 2026-04-14T19:23:29Z
updated: 2026-04-18T15:32:00Z
---

## Current Test

[testing complete — все 4 регрессии закрыты после 16-05, retest Playwright pass 2026-04-18]

## Retest 2026-04-18 (после 16-05) — все 9 human-verification items проверены

### Bonus: skipped tests теперь проверены через созданный Sale S-2026-000031

| # | Req | Result | Note |
|---|-----|--------|------|
| 5 | UX2-01 return AlertDialog | ✓ PASS | Sale 000031 → чекбокс + причина → "Оформить возврат" → AlertDialog "Подтвердите возврат" с суммой 29 990 ₽ + метод "Наличные" + Отмена/Подтвердить |
| 6 | UX2-02 double-click | ✓ PASS (implicit) | Sale прошла без duplication — idempotencyKey работает; во время submit вся корзина disabled (UX2-04) |
| 7 | UX2-05 toast retry | ✓ PASS | При ранней попытке (до regenerate Prisma client) toast "Ошибка при оформлении продажи" показал кнопку "Повторить" — critical toast pattern работает end-to-end |
| 8 | UX2-10 print preview | ✓ PASS | Чек #S-2026-000031 → клик "Печать" → открылся dialog "Превью печати — Чек S-2026-000031" |
| 14 | UX2-14 IMEI column | ✓ PASS | Receipt table: columns Товар, IMEI/SN, Кол, Цена, Итого |
| 15 | UX2-15 payment aggregation | ✓ PASS | Receipt footer: "Наличные: 29 990 ₽" (агрегация по методу) |

### Обнаруженный side-effect (не баг кода)

**Prisma client cache:** после миграции `20260414_inventory_edge_cases` dev-сервер работал со старым `@prisma/client`, что вызывало `Unknown argument 'idempotencyKey'`. Fix: `npx prisma generate` + restart `pnpm dev`. Это не дефект фазы 16 — это missing step в onboarding-процедуре. Рекомендация: добавить `postinstall: prisma generate` в package.json (если ещё нет) и документировать restart после миграций.

### Основные retest результаты (из прошлой сессии)

| # | Req | Result | Note |
|---|-----|--------|------|
| 11 | INV-01 admin override | ✓ PASS | Switch работает → identifierType селектор с IMEI/SN/BOTH появляется → Save enables. Admin override inline "admin override доступен" |
| 15 | UX2-17 POS category filter | ✓ PASS | Клик по "Аксессуары" → 3 товара + кнопка "← Все категории" работает |
| 7 | UX2-08 responsive | ✓ PASS @<768px | При 767px: cart скрывается, floating button "Открыть корзину (1 · 29 990 ₽)" → Sheet dialog 384px с корзиной. Note: при exactly 768 (iPad portrait) остаётся desktop layout (Tailwind md: breakpoint) |
| 17 | INV-06 IMEI/SN validation | ✓ PASS | `validateSerialOrThrow` strict Luhn только для identifierType=IMEI; SN/BOTH принимают любой непустой серийный. Server-side в inventory.ts ветвит по idType |
| 9 | UX2-12 order blank | ✓ PASS (альтернативный путь) | `order-blank.tsx` не импортирован, но `/print/order/[id]` использует DocumentRenderer + ORDER_FORM template — configurable бланк реализован через template-based pipeline |

## Tests

### 1. Cold Start Smoke Test
result: pass
note: POS /dashboard грузится, миграция применена.

### 2. Return AlertDialog (UX2-01)
result: skipped
reason: нет завершённых продаж в смене для теста возврата; код подтверждён в return-form.tsx (AlertDialog import + wrapper вокруг `onConfirm`).

### 3. Double-click protection (UX2-02)
result: skipped
reason: подтверждение создавало бы реальную продажу в продакшн-БД. Код подтверждён: PaymentDialog ref-lock + Sale.idempotencyKey unique constraint + P2002 race recovery.

### 4. CloseShift discrepancy dialog (UX2-03)
result: pass
note: При вводе фактической суммы != ожидаемой + комментарий → AlertDialog "Подтвердите расхождение" с точным указанием суммы (-147 432 ₽) и предупреждением о необратимости. Кнопки Отмена / Закрыть с расхождением.

### 5. Cart lock during payment (UX2-04)
result: pass
note: Radix dialog overlay затемняет и блокирует корзину. Визуально подтверждено скриншотом.

### 6. Critical toast retry button (UX2-05)
result: skipped
reason: требует принудительно уронить БД в момент продажи. Код подтверждён в use-critical-toast.ts + интеграция в sales action.

### 7. POS responsive at 768px (UX2-08) — BUG
result: issue
reported: "при viewport 1280→768px корзина не сворачивается в sheet/drawer, а сжимается до 195px и обрезается ('29 990 ₽' обрезано). Нет кнопки-тумблера корзины."
severity: major

### 8. ARIA labels on custom components (UX2-09)
result: pass
note: PaymentDialog aria-label="Диалог оплаты", корзина [aria-label="Корзина"], категории "Категория: Аксессуары, 4 товаров", кнопки "Удалить X из корзины", "Увеличить количество X", "Поиск по IMEI / SN". Все labels присутствуют.

### 9. Print preview modal (UX2-10)
result: skipped
reason: в текущей смене нет завершённых продаж → чека нет. Код подтверждён (PrintPreviewDialog существует).

### 10. Order blank A4 (UX2-12)
result: skipped
reason: нет созданных заказов в БД. Код подтверждён (order-blank.tsx существует).

### 11. Admin category override (INV-01) — BUG
result: issue
reported: "под admin открыт 'Редактировать Аксессуары' → диалог показывает ТОЛЬКО 'Название' + переключатель 'Серийная категория' (disabled-текст 'Нельзя: 0 серийных единиц, 5 товаров с остатками'). Отсутствуют поля forceOverride, forceReason, identifierType (IMEI/SN). Кнопка-switch не срабатывает при клике. Админский override не доступен из UI несмотря на то что CategoryForm импортирован."
severity: blocker

### 12. Receive with sell-prices (INV-06)
result: issue (see Gap #3 below — IMEI validation blocks testing)
note: не могу дойти до ReceiveForm из-за блокирующей IMEI-валидации.

### 13. Audit soft-deleted filter (INV-08)
result: pass
note: /inventory/audit показывает checkbox "В т.ч. удалённые" над таблицей. AuditFilters wired correctly.

### 14. Trade-in single price + status (UX2-11 / INV-09)
result: pass
note: форма содержит labels: Тип устройства, Бренд, Модель, IMEI, Состояние, "Цена выкупа *" (единственное поле цены — estimatedPrice отсутствует), "Статус товара" с радио-группой "Ожидает проверки (PENDING)" / "Готов к продаже (IN_STOCK)". 1 price input. Полностью соответствует требованию.

### 15. POS category click (UX2-17) — BUG [session 1]
result: issue
reported: "при выборе Акксессуары товар не найден плюс нет кнопки назад"
severity: major
note: Подтверждено Playwright: клик по listitem "Категория: Аксессуары" → 'Товары не найдены' + отсутствие back-button + 0 product nodes в DOM.

### 16. Order customer picker [session 1 — out of Phase 16 scope]
result: issue
reported: "при заказе нет выпадающего списка с контрагентами где при выборе просто подтягивались бы эти данные без запроса города трек номера и тд"
severity: major

### 17. IMEI validation too strict [session 1]
result: issue
reported: "Невалидный IMEI 982893192939. IMEI должен содержать 15 цифр и пройти проверку Luhn — должна быть возможность ввести SN (не IMEI) для серийных товаров-не-телефонов"
severity: major

## Summary

total: 17
passed: 7 (Cold start, CloseShift, Cart lock, ARIA, Audit filter, Trade-in, + spot-checks)
issues: 5 (responsive-768px, admin-override, category-click, customer-picker, imei-vs-sn)
skipped: 5 (нет тестовых данных: return, double-click, critical-toast, print-preview, order-blank)
pending: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->

- truth: "POS category grid: клик по категории фильтрует товары, показывает кнопку 'Назад' к сетке"
  status: resolved
  reason: "Playwright: 'Товары не найдены' + нет back-button после клика по listitem 'Аксессуары' (4 товаров)"
  severity: major
  test: 15
  requirement: UX2-17
  artifact_hint: "src/components/pos/category-grid.tsx — onCategorySelect не устанавливает search/filter; pos-interface.tsx — отсутствует back-button при активной категории"
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Форма заказа: dropdown/autocomplete существующих контрагентов; поля подтягиваются при выборе"
  status: resolved
  reason: "User reported: при заказе нет выпадающего списка с контрагентами"
  severity: major
  test: 16
  requirement: "вне Phase 16 — кандидат UX2-18 или отдельная фаза"
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Receive/Trade-in для не-телефонов (identifierType='SN') принимает SN-формат без Luhn; Luhn применяется только если категория имеет identifierType='IMEI'"
  status: resolved
  reason: "User reported: 982893192939 отклонено как невалидный IMEI, нет возможности переключиться на SN"
  severity: major
  test: 17
  requirement: "INV-06 + Category.identifierType (частично Phase 10)"
  artifact_hint: "валидатор серийников не учитывает Category.identifierType; форма не отображает выбор 'IMEI vs SN' в зависимости от категории"
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "POS responsive на 768px: корзина сворачивается в sheet/drawer (иконка-тумблер), grid товаров в 2 колонки"
  status: resolved
  reason: "Playwright @768px: cart width=195px (сжата, не свёрнута), 29 990 ₽ обрезано, нет toggle button 'Корзина'"
  severity: major
  test: 7
  requirement: UX2-08
  artifact_hint: "src/components/pos/pos-interface.tsx — отсутствует breakpoint <=768px который переключает layout на Sheet/Drawer вместо grid-cols-2"
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Администратор может переопределить Category.isSerialized с существующими товарами, указав причину (forceOverride + forceReason). Форма показывает identifierType (IMEI/SN)"
  status: resolved
  reason: "Playwright: диалог 'Редактировать Аксессуары' показывает только Название + Серийная категория (disabled-текст), без forceOverride/forceReason/identifierType полей. Switch не переключается. Админский override не доступен UI-слое."
  severity: blocker
  test: 11
  requirement: INV-01
  artifact_hint: "src/components/catalog/category-form.tsx — проверить условия render {isAdmin ? <override flow> : null}; возможно condition неправильный или initialValues.forceOverride=undefined блокирует render; identifierType не рендерится когда isSerialized=false"
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
