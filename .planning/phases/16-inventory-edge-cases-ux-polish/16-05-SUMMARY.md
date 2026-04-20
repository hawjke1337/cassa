---
phase: 16-inventory-edge-cases-ux-polish
plan: 05
subsystem: ui
tags: [react, nextjs, base-ui, prisma, pos, forms, validation]

# Dependency graph
requires:
  - phase: 16-inventory-edge-cases-ux-polish
    provides: "CategoryForm + identifierType schema + IMEI utils + POS interface + trade-in form (from 16-01..16-04)"
provides:
  - "CategoryForm renders IMEI/SN/BOTH selector; admin override UX clarified (amber warning, not 'disabled')"
  - "POS category grid click filters products by Product.categoryId (via searchPosProducts categoryId param)"
  - "POS mobile floating cart Sheet now opens correctly (fixed Base UI render-prop pattern)"
  - "validateSerialOrThrow util: identifierType-aware validation (IMEI strict Luhn, SN/BOTH soft)"
  - "Trade-in deviceImei accepts any serial (SN or IMEI) with soft validation"
affects: [post-v1.1, orders-ux, customer-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Base UI Trigger render prop: children must live INSIDE render element (not after)"
    - "identifierType-aware validation: strict Luhn only for IMEI, SN/BOTH accept any non-empty"
    - "Category-only POS queries: guard 'if (!search && !categoryId) return []' — не early-return на empty search"

key-files:
  created: []
  modified:
    - "src/components/catalog/category-form.tsx"
    - "src/components/pos/pos-interface.tsx"
    - "src/actions/sales.ts"
    - "src/lib/imei-utils.ts"
    - "src/components/serial/imei-scanner-input.tsx"
    - "src/actions/trade-in.ts"

key-decisions:
  - "Base UI != Radix: project uses @base-ui/react/dialog, так что SheetTrigger принимает render prop, не asChild (plan suggested asChild)"
  - "Trade-in soft validation: deviceImei = universal serial field (IMEI or SN). Категория товара ещё не существует на момент формы, поэтому применяем Luhn только если выглядит как IMEI (15 цифр)"
  - "ImeiScannerInput Luhn strictness narrowed: только identifierType='IMEI' применяет Luhn; 'BOTH' для dual-SIM accepts non-standard serials; 'SN' — no format restriction"

patterns-established:
  - "Base UI render-prop: <SheetTrigger render={<Button>...children...</Button>} /> — children WRAPPED in render element, not siblings"
  - "POS category filter: separate useEffect triggered by selectedCategoryId + empty search loads products via searchPosProducts(storeId, '', categoryId)"
  - "CategoryForm validation guard: submit disabled when isSerialized && !identifierType"

requirements-completed: [INV-01, UX2-17, UX2-08, INV-06]

# Metrics
duration: 6min
completed: 2026-04-18
---

# Phase 16 Plan 05: UAT Gap Closure Summary

**4 UAT regressions fixed: admin category override (IMEI/SN selector missing), POS category filter broken, mobile Sheet не открывался, и IMEI/SN валидация игнорировала identifierType категории.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-18T15:10:34Z
- **Completed:** 2026-04-18T15:16:24Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **Gap 1 (BLOCKER, INV-01)** closed: CategoryForm теперь рендерит IMEI/SN/BOTH selector при `isSerialized=true`; admin видит amber-warning "override доступен" вместо misleading disabled-текста; Save блокирована пока identifierType не выбран.
- **Gap 2 (major, UX2-17)** closed: Клик по категории в POS устанавливает `selectedCategoryId`, отдельный useEffect грузит товары через `searchPosProducts(storeId, "", categoryId)`; back-button "← Все категории" возвращает к сетке.
- **Gap 3 (major, UX2-08)** closed: Root cause mobile Sheet — в Base UI render-prop children должны быть ВНУТРИ render-элемента, не siblings. Иконка + текст жили вне Button → trigger был пустой → клик не ловился.
- **Gap 4 (major, INV-06)** closed: `validateSerialOrThrow(value, identifierType)` в imei-utils; ImeiScannerInput применяет Luhn только для `identifierType='IMEI'`; trade-in `deviceImei` принимает любой серийник (soft Luhn если 15 цифр).

## Task Commits

1. **Task 1: CategoryForm identifierType selector + admin override UX** — `4da9510` (feat)
2. **Task 2: POS category filter + mobile Sheet + sales.ts guard** — `502840a` (fix)
3. **Task 3: Soft IMEI/SN validation by identifierType** — `4a893c6` (fix)

## Files Created/Modified

- `src/components/catalog/category-form.tsx` — added IMEI/SN/BOTH selector; admin amber-warning instead of misleading disabled-текст; submit guard `isSerialized && !identifierType`.
- `src/components/pos/pos-interface.tsx` — added `selectedCategoryId` state; separate useEffect for category load; back-button "← Все категории"; header shows "Категория: X (N)" when active; fixed Base UI SheetTrigger (children inside render-element).
- `src/actions/sales.ts` — `searchPosProducts` accepts optional `categoryId` param; early-return guard changed to `if (!search?.trim() && !categoryId) return []`; Prisma where conditionally adds categoryId + search OR.
- `src/lib/imei-utils.ts` — added `validateSerialOrThrow(value, identifierType, fieldName)` — IMEI strict Luhn, SN/BOTH any non-empty. Existing `isValidImei` + `validateImeiOrThrow` unchanged.
- `src/components/serial/imei-scanner-input.tsx` — Luhn validation narrowed: только `identifierType === "IMEI"` triggers Luhn+15digits; SN/BOTH no restriction.
- `src/actions/trade-in.ts` — replaced `validateImeiOrThrow` (unconditional) with soft validation: throws only if 15-digit number fails Luhn; 12-digit SN like `982893192939` теперь принимается. Import updated to `isValidImei`.

## Decisions Made

1. **Base UI, not Radix shadcn/ui** — плановый `<SheetTrigger asChild>` не компилировался. Project uses `@base-ui/react/dialog` which requires `render` prop. Моя fix-версия возвращает `render` syntax, но кладёт children (иконка + текст) ВНУТРЬ render-Button — previously they were rendered как children of the primitive trigger, делая видимую кнопку пустой. Это корневая причина, почему mobile Sheet не открывался.
2. **Trade-in form не знает identifierType** — товара (Product) ещё нет, когда оператор принимает trade-in. Поэтому нельзя применить identifierType-specific валидацию. Solution: soft heuristic — если 15 цифр, проверяем Luhn (скорее всего IMEI); иначе принимаем как SN.
3. **Luhn narrowing from `!== 'SN'` to `=== 'IMEI'`** — для `BOTH` (dual-SIM) поле imei может содержать нестандартные серийники (некоторые производители). Требовать Luhn для BOTH — излишне строго.
4. **searchPosProducts early-return fix — критический для UX2-17** — оригинальный guard `if (!search) return []` отвергал любые category-only вызовы ещё до Prisma. Изменено на `if (!search?.trim() && !categoryId) return []` — теперь category-only запросы доходят до БД.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's `SheetTrigger asChild` не компилировалась — codebase uses Base UI**

- **Found during:** Task 2 (TSC verification)
- **Issue:** Plan suggested `<SheetTrigger asChild>` + sibling children — но `src/components/ui/sheet.tsx` импортирует `@base-ui/react/dialog`, которая не имеет `asChild` prop. Base UI использует `render` prop.
- **Fix:** Вернул `render={<Button>...</Button>}` syntax, но критически исправил underlying defect — children (ShoppingCart icon + text) теперь ВНУТРИ render-Button, а не siblings. Previously children rendered as primitive-trigger children → visible Button childless → клик на visible Button не ловился.
- **Files modified:** `src/components/pos/pos-interface.tsx`
- **Verification:** TSC clean; pattern matches `SheetPrimitive.Close` use in `sheet.tsx` (lines 63-76 — render={<Button />} with children INSIDE).
- **Committed in:** `502840a` (Task 2)
- **Note:** Acceptance criterion `grep "SheetTrigger asChild"` не удовлетворяется — заменён на правильный Base UI pattern. Это не regression — это correction against codebase convention.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — plan inconsistency with codebase UI library)
**Impact on plan:** Fix was essential — без него Sheet вообще бы не открывался (критичнее acceptance-criteria pattern-match). Правильная Base UI семантика сохранена, plan intent (mobile cart Sheet работает при 768px) достигнут.

## Issues Encountered

- **Pre-existing TSC error** в `src/actions/trade-in.ts:181` (`shiftId: string | null → string | undefined`) — документировано ранее в `.planning/phases/16-inventory-edge-cases-ux-polish/deferred-items.md`. Out of scope for this plan (error существовал до моих правок — просто сдвинулся по строке из-за добавленных комментариев). Не трогал.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Gap 5 (customer picker в форме заказа, UX2-18 кандидат)** — `deferred`, не в scope Phase 16. Отправится в dedicated Orders UX фазу или после v1.1 закрытия (см. plan 16-05 section `## Deferred from this plan`).
- **UAT re-run рекомендуется** — все 4 исправленных gap требуют ручной Playwright проверки:
  1. Admin → Редактировать "Аксессуары" → IMEI/SN/BOTH selector видим.
  2. POS → клик на "Аксессуары" → товары категории загружаются + back-button видима.
  3. POS @768px → floating cart button → клик открывает Sheet.
  4. Trade-in → deviceImei "982893192939" (12 цифр) → принято; "000000000000000" (15 цифр, невалидная Luhn) → ошибка с понятным сообщением.

## Self-Check

Verifying all claims before state update:

- Commit `4da9510` exists: FOUND (task 1)
- Commit `502840a` exists: FOUND (task 2)
- Commit `4a893c6` exists: FOUND (task 3)
- File `src/components/catalog/category-form.tsx` modified: FOUND
- File `src/components/pos/pos-interface.tsx` modified: FOUND
- File `src/actions/sales.ts` modified: FOUND
- File `src/lib/imei-utils.ts` modified: FOUND
- File `src/components/serial/imei-scanner-input.tsx` modified: FOUND
- File `src/actions/trade-in.ts` modified: FOUND

## Self-Check: PASSED

---

_Phase: 16-inventory-edge-cases-ux-polish_
_Plan: 05 (gap closure)_
_Completed: 2026-04-18_
