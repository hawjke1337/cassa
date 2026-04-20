---
phase: 02-tselostnost-dannykh
plan: 03
subsystem: database
tags: [prisma, transactions, rollback, cash-management, trade-in]

# Dependency graph
requires:
  - phase: 02-01
    provides: "getNextNumber with tx, PrismaTx type export"
provides:
  - "cancelOrder with full payment/serial/debt rollback"
  - "calculateExpectedCash reusable function for shift cash calculations"
  - "deleteTradeIn status guard (only PENDING/WRITTEN_OFF deletable)"
affects: [03-biznes-logika, orders, shifts, trade-in]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Extracted shared calculateExpectedCash for DRY", "Status guard pattern with DELETABLE_STATUSES array"]

key-files:
  created:
    - "src/__tests__/cancel-order.test.ts"
    - "src/__tests__/auto-close-shift.test.ts"
    - "src/__tests__/trade-in-delete.test.ts"
  modified:
    - "src/actions/orders.ts"
    - "src/actions/shifts.ts"
    - "src/actions/trade-in.ts"

key-decisions:
  - "calculateExpectedCash uses cashOperation (not payment) for deposits/withdrawals and return for refunds -- matches existing closeShift logic"
  - "Payment model uses orderId not customOrderId for order link"
  - "deleteTradeIn guard is before $transaction for early exit"

patterns-established:
  - "Status guard pattern: define DELETABLE_STATUSES array, check before transaction"
  - "Extracted shared calculation functions with PrismaTx for transaction context"

requirements-completed: [DATA-04, DATA-08, DATA-09, DATA-10]

# Metrics
duration: 6min
completed: 2026-04-05
---

# Phase 2 Plan 3: Cancel/Rollback, Expected Cash, Trade-In Guard Summary

**cancelOrder with full payment/serial/debt rollback, calculateExpectedCash for auto-close shifts, deleteTradeIn status guard blocking IN_STOCK/SOLD/IN_REPAIR deletion**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T15:12:58Z
- **Completed:** 2026-04-05T15:18:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- cancelOrder rolls back payments, serial units, and supplier debts in one atomic $transaction; rejects COMPLETED/CANCELLED
- calculateExpectedCash extracted as reusable function; used in both auto-close and closeShift (DRY)
- deleteTradeIn guards against deleting IN_STOCK/SOLD/IN_REPAIR trade-ins
- 22 new tests (11 cancel-order + 6 auto-close-shift + 5 trade-in-delete), all 85 project tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: cancelOrder with full rollback (DATA-04)** - `2f43b80` (feat)
2. **Task 2: calculateExpectedCash + deleteTradeIn guard (DATA-08, DATA-10)** - `7dcb2fe` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `src/actions/orders.ts` - Added cancelOrder function with atomic rollback
- `src/actions/shifts.ts` - Extracted calculateExpectedCash, updated auto-close and closeShift
- `src/actions/trade-in.ts` - Added DELETABLE_STATUSES guard in deleteTradeIn
- `src/__tests__/cancel-order.test.ts` - 11 static analysis tests for cancelOrder
- `src/__tests__/auto-close-shift.test.ts` - 6 tests for calculateExpectedCash
- `src/__tests__/trade-in-delete.test.ts` - 5 tests for deleteTradeIn status guard

## Decisions Made
- calculateExpectedCash matches existing closeShift aggregation logic (cashOperation for deposits/withdrawals, return for refunds) rather than plan template (all via payment)
- Payment.orderId confirmed via schema (not customOrderId as plan initially suggested)
- deleteTradeIn guard placed before $transaction for early exit pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed payment.deleteMany field name**
- **Found during:** Task 1 (cancelOrder)
- **Issue:** Plan used `customOrderId` but Payment model uses `orderId`
- **Fix:** Changed to `{ where: { orderId } }`
- **Files modified:** src/actions/orders.ts
- **Verification:** TypeScript compiles, tests pass
- **Committed in:** 2f43b80

**2. [Rule 1 - Bug] Fixed calculateExpectedCash aggregate sources**
- **Found during:** Task 2 (calculateExpectedCash)
- **Issue:** Plan template used payment.aggregate for deposits/withdrawals/refunds, but actual code uses cashOperation and return models
- **Fix:** Used cashOperation.aggregate for DEPOSIT/WITHDRAW and return.aggregate for CASH refunds (matches existing closeShift)
- **Files modified:** src/actions/shifts.ts
- **Verification:** All 85 tests pass, TypeScript compiles
- **Committed in:** 7dcb2fe

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Целостность данных) fully complete: all 3 plans executed
- DATA-01 through DATA-10 requirements addressed
- Ready for Phase 3 (Бизнес-логика)

---
*Phase: 02-tselostnost-dannykh*
*Completed: 2026-04-05*
