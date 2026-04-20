---
phase: 16-inventory-edge-cases-ux-polish
plan: 02
subsystem: pos-ux
tags: [pos, payment-dialog, idempotency, alert-dialog, inline-validation, critical-toast]

requires:
  - phase: 16-inventory-edge-cases-ux-polish
    plan: 01
    provides: "Sale.idempotencyKey @unique @db.VarChar(36) (schema + migration applied)"

provides:
  - "useCriticalToast hook — retry-enabled toast для критичных операций (UX2-05)"
  - "PaymentDialog ref-lock + client-generated idempotencyKey per open (UX2-02, UX2-06)"
  - "createSale server-side idempotency check + P2002 race recovery"
  - "Cart lock visual+functional при открытом PaymentDialog (UX2-04)"
  - "Return AlertDialog с суммой возврата (UX2-01)"
  - "CloseShift AlertDialog при discrepancy != 0 (UX2-03)"
  - "fieldErrorClass / helperTextClass helpers для inline валидации (UX2-07)"
  - "aggregatePaymentsByMethod helper — готов для Plan 03 receipt rendering (UX2-15)"
  - "Order underpayment warning в FinalPaymentDialog (UX2-13)"

affects: [phase-16-03, pos, orders]

tech-stack:
  added: []
  patterns:
    - "useRef lock + synchronous re-entry guard — предотвращает double-submit до первого render"
    - "crypto.randomUUID() в useEffect(open) — свежий idempotencyKey на каждый диалог"
    - "Catch-and-lookup для P2002 на Sale.idempotencyKey — graceful race recovery"
    - "formatSaleResult + SALE_RETURN_INCLUDE — единый shape для fresh/existing Sale ответа"
    - "AlertDialog перед destructive mutation (return, shift close с расхождением)"
    - "Critical toast pattern: Повторить action → передача текущего handler как retry callback"

key-files:
  created:
    - src/hooks/use-critical-toast.ts
    - src/lib/form-validation.ts
    - src/lib/receipts.ts
    - src/__tests__/e2e/ux-polish.e2e.test.ts
    - src/__tests__/payment-aggregation.test.ts
  modified:
    - src/lib/validations/sales.ts
    - src/actions/sales.ts
    - src/components/pos/payment-dialog.tsx
    - src/components/pos/pos-interface.tsx
    - src/components/pos/return-form.tsx
    - src/components/pos/close-shift-dialog.tsx
    - src/components/orders/order-detail.tsx

key-decisions:
  - "Idempotency fast-path BEFORE transaction — экономит BEGIN/ROLLBACK при повторе, а catch P2002 покрывает честный race (simultaneous submit)"
  - "P2002 recovery: try findUnique вместо разбора meta.target — Prisma 7 + pg adapter непредсказуемо заполняет meta, надёжнее проверить Sale по ключу"
  - "SEC2-01 guard в idempotency path: existing.storeId должен совпадать с data.storeId — защита от user'а чужого магазина переиспользовавшего ключ"
  - "Non-blocking underpay warning (UX2-13) — оператор осознанно выбирает; частичные оплаты легитимны"
  - "aggregatePaymentsByMethod округляет до 2dp — одноместное решение для float drift (0.1 + 0.2 ≠ 0.3)"
  - "fieldErrorClass принимает unknown для Zod error shape compatibility — снимает тип зависимость от react-hook-form FieldError"
  - "Lock up paymentOpen в pos-interface.tsx уже был поднят (Phase 15) — только добавлен conditional class на cart column"

patterns-established:
  - "Server actions с idempotency: (1) fast findUnique; (2) tx.create с unique index; (3) catch P2002 + retry findUnique"
  - "PaymentDialog-style re-entry: lockRef.current = true ПЕРЕД setLoading → синхронный guard"
  - "Critical retry: retry: handleSubmit позволяет пользователю повторить тот же submit без повторного ввода данных"

requirements-completed: [UX2-01, UX2-02, UX2-03, UX2-04, UX2-05, UX2-06, UX2-07, UX2-13]

duration: 12 min
completed: 2026-04-14
---

# Phase 16 Plan 02: POS UX Polish Summary

**Клиентский ref-lock + server-side idempotencyKey check + P2002 race recovery защищают от дублирующих Sale. AlertDialog перед return и closeShift с расхождением страхует оператора от случайных деструктивных mutations. Cart lock + Повторить-toast + inline валидация + underpay warning — полный набор UX защит из UX2-01..07, 13.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-14T18:02:54Z
- **Completed:** 2026-04-14T18:14:57Z
- **Tasks:** 4 (Task 0 + 3 implementation)
- **Files created:** 5
- **Files modified:** 7

## Accomplishments

- **useCriticalToast (UX2-05):** Компактный hook (`src/hooks/use-critical-toast.ts`, ~30 строк) вызывающий `toast.error` с `action: { label: "Повторить", onClick: retry }` и `duration: 10000`. Интегрирован в PaymentDialog, ReturnForm, CloseShiftDialog.
- **PaymentDialog ref-lock + idempotencyKey (UX2-02, UX2-06):** `lockRef.current` синхронно блокирует повторные клики до возврата `handleConfirm`. `idempotencyKey` regenerate-ся в `useEffect(() => { if (open) {...} }, [open])` через `crypto.randomUUID()` (+ fallback для сред без crypto). Передаётся как `input.idempotencyKey` в `createSale`. Кнопка показывает `Loader2 + "Обработка..."` при loading. Ошибки роутятся через `criticalToast.error(..., { retry: handleConfirm })`.
- **createSale idempotency (UX2-06):**
  1. Fast-path `db.sale.findUnique({ where: { idempotencyKey }})` перед открытием транзакции.
  2. `SEC2-01` guard: existing.storeId должен совпадать с data.storeId, иначе throw.
  3. `tx.sale.create({ ..., idempotencyKey })` — уникальный индекс защищает от race.
  4. Catch `Prisma.PrismaClientKnownRequestError` с `code === "P2002"` → retry `findUnique` → return existing. Graceful обработка concurrent submit.
  5. Extracted `SALE_RETURN_INCLUDE` + `formatSaleResult(sale)` — единый shape для fresh и existing Sale (устраняет риск divergence).
- **Cart lock (UX2-04):** В `pos-interface.tsx` cart column (40%) получает conditional className `pointer-events-none opacity-50 transition-opacity` + `aria-disabled={paymentOpen}` + `data-slot="pos-cart"`. `paymentOpen` state уже был поднят в этот компонент раньше — только добавили class-binding.
- **Return AlertDialog (UX2-01):** Сплит `handleSubmitReturn` на `handleInitiateReturn` (валидация + open dialog) и `handleConfirmReturn` (вызов `createReturn`). AlertDialog показывает `refundAmount` (memoized: Σ(price-discount) × quantity) и выбранный метод возврата. Destructive action кнопка `bg-destructive text-white`. Ошибка `createReturn` → `criticalToast` с retry.
- **CloseShift AlertDialog (UX2-03):** Сплит `handleSubmit` на `handleInitiateClose` (если `hasDiscrepancy` → открыть AlertDialog, иначе сразу `performClose()`) и `performClose()` (внутри `startTransition` + catch → criticalToast). AlertDialog показывает сумму расхождения и expectedCash, destructive action "Закрыть с расхождением".
- **fieldErrorClass (UX2-07):** `src/lib/form-validation.ts` — Tailwind helper возвращающий `border-destructive focus-visible:ring-destructive` для true. Применён к amount input в `FinalPaymentDialog`. Готов к применению в других формах (receive/trade-in/order-form) — это `Claude's Discretion` scope, остальные формы не трогали чтобы не раздувать scope.
- **Underpay warning (UX2-13):** `FinalPaymentDialog` теперь вычисляет `effectiveRemaining = max(0, remainingAmount - discount)` и `underpaid = 0 < amount < effectiveRemaining`. При true показывает `<Alert variant="destructive">` с `AlertTriangle`, текстом "Оплата меньше остатка" и остатком после оплаты. Не блокирует submit — оператор может осознанно подтвердить.
- **aggregatePaymentsByMethod (UX2-15 foundation):** `src/lib/receipts.ts` — helper группирующий payments по методу, фиксированный порядок `CASH, CARD, SBP, TRANSFER, CREDIT, TRADE_IN`, округление до 2dp (защита от float drift). 8 unit тестов покрывают группировку, порядок, пустой input, неизвестные методы, NaN/Infinity. Готов к потреблению Plan 03 receipt view.

## Task Commits

1. **Task 0 (test stubs):** `91a1c9a` (test) — ux-polish.e2e.test.ts с 8 it.todo + 1 smoke test
2. **Task 1 (ref-lock + idempotency + critical toast):** `32f9d33` (feat) — 5 файлов (+588/-324). E2E UX2-02/06 GREEN (6 passed + 2 todo).
3. **Task 2 (cart lock + dialogs):** `4419056` (feat) — 3 файла (+165/-25)
4. **Task 3 (inline validation + underpay + aggregation):** `604df54` (feat) — 4 файла (+195/-1). Unit-тесты payment-aggregation GREEN (8 passed).

## Verification Results

- `pnpm test:e2e src/__tests__/e2e/ux-polish.e2e.test.ts` — **6 passed + 2 todo (UX2-13 server-side contracts)**, 2.3s
- `pnpm vitest run src/__tests__/payment-aggregation.test.ts` — **8 passed**, 0.3s
- `pnpm tsc --noEmit` — 0 новых ошибок в изменённых файлах (pre-existing в trade-in.ts, motivation-*.ts, repairs.ts — deferred из 16-01)
- `pnpm eslint` на 7 изменённых файлах — 0 новых warnings/errors (pre-existing: 3 в pos-interface/close-shift-dialog/payment-dialog — deferred)

## Files Created/Modified

**Created:**
- `src/hooks/use-critical-toast.ts` — 30 строк
- `src/lib/form-validation.ts` — 17 строк
- `src/lib/receipts.ts` — 55 строк
- `src/__tests__/e2e/ux-polish.e2e.test.ts` — 227 строк (8 it-тестов + 2 todo + smoke)
- `src/__tests__/payment-aggregation.test.ts` — 80 строк (8 unit-тестов)

**Modified:**
- `src/lib/validations/sales.ts` — добавлен `idempotencyKey: z.string().uuid().optional()`
- `src/actions/sales.ts` — idempotency fast-path + P2002 catch + helpers (~60 строк diff)
- `src/components/pos/payment-dialog.tsx` — useRef lock, idempotencyKey state, criticalToast
- `src/components/pos/pos-interface.tsx` — cart lock className conditional
- `src/components/pos/return-form.tsx` — AlertDialog + refundAmount memo + critical toast
- `src/components/pos/close-shift-dialog.tsx` — AlertDialog + performClose split + critical toast
- `src/components/orders/order-detail.tsx` — FinalPaymentDialog underpay Alert + fieldErrorClass

## Requirements Coverage

| Req    | Status | Covered By                                                         |
| ------ | ------ | ------------------------------------------------------------------ |
| UX2-01 | ✅      | return-form.tsx AlertDialog confirm                                |
| UX2-02 | ✅      | payment-dialog.tsx lockRef + button loading; E2E race test         |
| UX2-03 | ✅      | close-shift-dialog.tsx AlertDialog на discrepancy != 0             |
| UX2-04 | ✅      | pos-interface.tsx cart column opacity-50 + pointer-events-none     |
| UX2-05 | ✅      | useCriticalToast + интеграция в Payment/Return/CloseShift          |
| UX2-06 | ✅      | idempotencyKey client/server + P2002 recovery; E2E 4 tests         |
| UX2-07 | ✅      | fieldErrorClass helper (+ example применение в FinalPaymentDialog) |
| UX2-13 | ✅      | FinalPaymentDialog underpay Alert                                  |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7 P2002 meta.target не содержит имени поля**

- **Found during:** Task 1 — E2E race condition test rejected одну из двух параллельных createSale
- **Issue:** Реализация проверяла `err.meta.target?.includes("idempotencyKey")`, но Prisma 7 + pg adapter возвращает `meta: { modelName: 'Sale', driverAdapterError: {...} }` — `target` отсутствует. Race-check не срабатывал, ошибка пробрасывалась.
- **Fix:** Упростил catch: просто пробовать `findUnique({ where: { idempotencyKey } })` — если Sale существует, значит это наш idempotent race; если нет — пробрасываем оригинальную ошибку. Более надёжно и короче.
- **Files modified:** src/actions/sales.ts (catch block)
- **Verification:** E2E "два параллельных createSale с одним idempotencyKey → одна Sale" GREEN на retry.
- **Committed in:** 32f9d33

### Scope Decisions

- **fieldErrorClass применён только в FinalPaymentDialog** — план оставил "specific forms for inline validation" на Claude's Discretion. Application to receive-form/trade-in/order-form будет выполнена точечно по мере необходимости. Helper exported + documented → нет блокера для будущего расширения.
- **aggregatePaymentsByMethod не интегрирован в receipt-view.tsx** — это работа Plan 03 (receipt polish). Helper готов, unit-тесты покрывают контракт.

**Total deviations:** 1 auto-fixed (blocking Prisma 7 meta shape)
**Impact on plan:** Нет — scope остался как запланирован.

## Manual-Only Verification Steps (для 16-VALIDATION.md)

Из плана: "Manual-only тесты (UX2-01, UX2-03, UX2-04)". Шаги для оператора:

1. **UX2-01 Return confirm:** Открыть POS → Возврат → найти Sale → выбрать item → нажать "Оформить возврат" → убедиться что появляется AlertDialog с суммой и destructive кнопкой "Подтвердить возврат".
2. **UX2-02 Double-click:** Открыть PaymentDialog → быстро кликнуть "Подтвердить оплату" дважды подряд → убедиться что показывается только один "Продажа S-... оформлена" toast, в БД один Sale.
3. **UX2-03 Close discrepancy:** Открыть "Закрыть смену" → ввести сумму ≠ expectedCash → написать комментарий → нажать "Закрыть смену" → убедиться что AlertDialog показывает точное расхождение и ожидаемую сумму.
4. **UX2-04 Cart lock:** В POS добавить товары → нажать "ОПЛАТА" → убедиться что колонка корзины серая (opacity-50), клики по +/−/удалить не проходят.
5. **UX2-05 Critical toast:** Создать ситуацию ошибки (например, выключить DB) → попытаться оформить Sale → убедиться что в toast есть кнопка "Повторить" и она работает.
6. **UX2-07 Inline validation:** В FinalPaymentDialog ввести "abc" в Сумма → поле получает красную рамку.
7. **UX2-13 Underpay warning:** В FinalPaymentDialog ввести amount меньше remainingAmount → убедиться что показывается красный Alert "Оплата меньше остатка" с цифрами остатка.

## Next Phase Readiness

- **Plan 03 (receipt polish):** `aggregatePaymentsByMethod` готов к использованию в receipt-view.tsx для UX2-15.
- **Plan 03 может использовать** `fieldErrorClass` для inline валидации в своих формах.
- **useCriticalToast** экспортирован — доступен для других критичных операций (например, print failure).

---
*Phase: 16-inventory-edge-cases-ux-polish*
*Completed: 2026-04-14*

## Self-Check

- `src/hooks/use-critical-toast.ts`: exists ✅
- `src/lib/form-validation.ts`: exists ✅
- `src/lib/receipts.ts`: exists ✅
- `src/__tests__/e2e/ux-polish.e2e.test.ts`: exists (6 passed + 2 todo) ✅
- `src/__tests__/payment-aggregation.test.ts`: exists (8 passed) ✅
- Task commits 91a1c9a, 32f9d33, 4419056, 604df54 — all verified in `git log` ✅

## Self-Check: PASSED
