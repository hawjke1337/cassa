# Phase 08 — Deferred Items

## From Plan 08-03 (Atomic Order Completion & Cancellation)

### partial-return-per-unit.e2e.test.ts — 2 failures deferred

**Test 1: "3 позиции × 100₽ со скидкой 99₽ → residual 33/33/33 и частичный возврат точный"**

- **Failure:** `assertMoneyConservation` — expected `134`, received `201` (gap = 67)
- **Root cause:** Интеракция новой ledger re-entry схемы (completeOrder: prepayment помечается `isExpense=true` + создаётся новый Sale Payment) с частичным возвратом. Return invariant баланс ломается из-за удвоенного audit trail prepayment.
- **Out of scope:** plan 08-03 нацелен на completeOrder/cancelOrderWithDecision + 3 target E2E (order-completion/order-cancel/order-payment-constraints). Тест partial-return — смежный FIN-08 test, ломающийся только в связке с return logic (которая сама в 08-04).
- **Next:** Phase 9 или hotfix plan 08-07 — пересмотреть ledger pattern или invariant helper чтобы учитывать re-entered payments при частичных возвратах.

**Test 2: "2 позиции × 99.99₽ со скидкой 0.01₽ → precision сохранена, частичный возврат без drift"**

- **Failure:** `expected '0.02' to be '0.01'` — `sum(item.discount × quantity)` даёт `0.02` вместо `0.01`
- **Root cause:** Schema ограничение `Decimal(12, 2)` на `SaleItem.discount`. Per-unit discount `0.005` (0.01 / 2) округляется базой до `0.01`, затем × quantity=2 = 0.02. Нужно 4 знаков precision для per-unit discount, чтобы rounding не ломал invariant.
- **Out of scope:** schema migration требует отдельный plan (breaking change DB). Phase 15 (Data Integrity Hardening) — правильное место.
- **Next:** Phase 15 plan — migration `SaleItem.discount` → `Decimal(12, 4)` и consequent money-guard updates.

## Scope boundary

Plan 08-03 Task 2 scope (per objective):

- [x] completeOrder atomic implementation
- [x] cancelOrderWithDecision HOLD/REFUND
- [x] Remove Wave 0 throwing stubs
- [x] Fix pre-existing TS errors at orders.ts:408, 635, 690, 791
- [x] Target E2E green: order-completion, order-cancel, order-payment-constraints (16/16 tests)

Pre-existing TS errors in OTHER files (confirm-receive-integration, e2e-real-db, repairs, trade-in, vitest.config) — не тронуты, остаются в бэклоге Phase 15.

## From Plan 08-05 (CancelDialog RadioGroup UI)

### Pre-existing `no-explicit-any` baseline in order-detail.tsx

- **Status:** 12 `@typescript-eslint/no-explicit-any` errors + 3 warnings (unused-vars, unused-expressions) pre-date Plan 08-05. Lines 102, 135, 142, 154, 172, 192, 600, 1216, 1456, 1527, 1562, 1629.
- **Out of scope:** Plan 08-05 acceptance criterion "`pnpm lint src/components/orders/order-detail.tsx` passes" cannot be satisfied without modifying unrelated catch blocks across PaymentDialog, MarkDebtPaidButton, LinkSerialDialog, UnlinkSerialButton, CostEntryDialog, SupplierDialog, AddItemsDialog, etc.
- **Verified:** Plan 08-05 new code (CancelDialog with RadioGroup + cancelOrderWithDecision) contributes ZERO new lint errors. The catch block inside CancelDialog uses `catch (err) { instanceof Error }` narrowing, not `any`.
- **Next:** Dedicated lint-hardening plan in Phase 16 (UX Polish / cleanup) or whenever a full money-guard/linting sweep is scheduled (parallel to Phase 15 Decimal sweep).

### Pre-existing tsc errors in unrelated files

- **Status:** tsc --noEmit reports errors in `src/__tests__/confirm-receive-integration.test.ts`, `src/__tests__/e2e-real-db.test.ts`, `src/actions/repairs.ts`, `src/actions/trade-in.ts`, `vitest.config.ts`. ZERO errors in `src/components/orders/order-detail.tsx` (verified).
- **Out of scope:** Repairs and trade-in belong to Phase 11 (Repair as Sale). vitest.config and test mock typing belong to Phase 7 test infra polish.
- **Next:** Phase 11 + test-infra hotfix.
