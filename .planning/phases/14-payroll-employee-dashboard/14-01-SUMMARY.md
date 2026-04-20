---
phase: 14-payroll-employee-dashboard
plan: 01
subsystem: payroll
tags: [motivation, commission, decimal, prisma, e2e]

requires:
  - phase: 07-test-infrastructure
    provides: E2E test infrastructure with schema-per-worker isolation
  - phase: 08-order-sale-flow
    provides: completeOrder populates SaleItem.costPrice from CustomOrderItem.costPrice
provides:
  - "Fixed per-item commission for order-based sales (PAYROLL-01)"
  - "E2E regression test proving per-item vs whole-order commission"
affects: [14-payroll-employee-dashboard, 15-data-integrity-hardening]

tech-stack:
  added: []
  patterns:
    - "Unified itemCommissionDec for all sale types (regular + order)"

key-files:
  created:
    - src/__tests__/e2e/order-commission-peritem.e2e.test.ts
  modified:
    - src/actions/motivation-calculation.ts

key-decisions:
  - "Removed orderItemCommissionDec entirely -- SaleItem.costPrice already populated per-item via completeOrder"
  - "PAYROLL-02 (co-seller) DEFERRED per user decision"
  - "Used direct number assertions instead of toEqualDecimal due to pre-existing Decimal cross-module identity issue (Phase 15 scope)"

patterns-established:
  - "All sale commission calculations use unified itemCommissionDec regardless of sale origin"

requirements-completed: [PAYROLL-01]

duration: 9min
completed: 2026-04-13
---

# Phase 14 Plan 01: Per-Item Order Commission Fix Summary

**Fixed per-item commission bug for order-based sales -- uses itemCommissionDec(sellPrice, costPrice) instead of whole-order netProfit, with 4 E2E regression tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-13T21:15:47Z
- **Completed:** 2026-04-13T21:24:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed buggy orderItemCommissionDec that applied whole-order netProfit to every item (inflating commission by N items)
- Unified all commission calculation through itemCommissionDec (SaleItem.costPrice is already populated per-item)
- Added 4 E2E tests: 3-item order, single-item order, costPrice=0 fallback, mixed regular+order sales

## Task Commits

Each task was committed atomically:

1. **Task 1: E2E test for per-item order commission (RED)** - `e041a2a` (test)
2. **Task 2: Fix per-item commission + GREEN tests** - `779cf49` (fix)

_Note: motivation-calculation.ts fix was included in f75b800 (14-02 commit that ran concurrently) -- 779cf49 contains test assertion updates for GREEN._

## Files Created/Modified
- `src/__tests__/e2e/order-commission-peritem.e2e.test.ts` - 4 E2E tests proving per-item commission correctness
- `src/actions/motivation-calculation.ts` - Removed orderItemCommissionDec, unified to itemCommissionDec for all sales

## Decisions Made
- Removed orderItemCommissionDec function entirely (only used in motivation-calculation.ts)
- Removed calculateNetProfit import (no longer needed in this file)
- Removed customOrder include from Sale query (replaced with shift include in 14-02)
- Used `toBe(number)` assertions instead of `toEqualDecimal` due to pre-existing Decimal cross-module identity bug (Phase 15 scope)
- PAYROLL-02 (co-seller commission) acknowledged as DEFERRED per user decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Prisma relation syntax for Sale.customOrder**
- **Found during:** Task 1 (E2E test creation)
- **Issue:** Used `customOrderId` scalar field instead of `customOrder: { connect: { id } }` relation syntax
- **Fix:** Changed to relation connect syntax
- **Files modified:** src/__tests__/e2e/order-commission-peritem.e2e.test.ts
- **Verification:** Tests run without Prisma validation errors
- **Committed in:** e041a2a

**2. [Rule 3 - Blocking] Fixed test assertions for Decimal compatibility**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `toEqualDecimal` matcher fails on `toMoney(number)` due to cross-module Decimal identity (pre-existing Phase 15 issue)
- **Fix:** Used `toBe(number)` assertions since `totals.commissions` already returns `number`
- **Files modified:** src/__tests__/e2e/order-commission-peritem.e2e.test.ts
- **Verification:** All 4 tests pass GREEN
- **Committed in:** 779cf49

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for test execution. No scope creep.

## Issues Encountered
- motivation-precision.e2e.test.ts has pre-existing failures from toEqualDecimal cross-module Decimal issue -- NOT caused by this plan's changes (confirmed by testing with and without changes). Routed to Phase 15.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PAYROLL-01 complete, per-item commission verified with E2E tests
- PAYROLL-02 (co-seller) DEFERRED
- Ready for remaining payroll plans (14-02, 14-03)

---
*Phase: 14-payroll-employee-dashboard*
*Completed: 2026-04-13*
