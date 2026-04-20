---
phase: 13-suppliers-debts
plan: 03
subsystem: testing
tags: [e2e, vitest, supplier-debt, partial-payment, cash-operation, prisma]

requires:
  - phase: 13-suppliers-debts
    provides: paySupplierDebt, updateOrderCosts, cancelOrderWithDecision with debt cleanup, SupplierPayment model
  - phase: 07-test-infra
    provides: E2E test infrastructure, schema-per-worker isolation, fixtures
provides:
  - E2E test suite for supplier debt workflows (8 tests)
  - createTestSupplier and createTestOrderWithSupplier test fixtures
affects: [14-payroll, 16-ux-polish]

tech-stack:
  added: []
  patterns:
    - "E2E test fixtures with createDebt option for supplier order scenarios"
    - "Number() comparison for Prisma Decimal fields (avoids trailing zero mismatch)"

key-files:
  created:
    - src/__tests__/e2e/supplier-debts.e2e.test.ts
  modified:
    - src/__tests__/helpers/fixtures.ts

key-decisions:
  - "Use Number() for Decimal comparisons in tests instead of toString() to avoid trailing zero issues"
  - "beforeEach setup instead of beforeAll due to TRUNCATE CASCADE between tests"

patterns-established:
  - "Supplier test fixtures reusable for Phase 14 payroll tests"

requirements-completed: [SUP-01, SUP-04, SUP-05, SUP-06]

duration: 12min
completed: 2026-04-12
---

# Phase 13 Plan 03: Supplier Debts E2E Tests Summary

**8 E2E tests covering supplier debt payment workflows: full/partial payments with CashOperation(WITHDRAW, shiftId=null), auto-close on amount update, cascade cleanup on order cancel, ORDERED without purchasePrice**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-12T13:42:02Z
- **Completed:** 2026-04-12T13:54:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- createTestSupplier and createTestOrderWithSupplier fixtures added for reuse across phases
- 8 E2E tests verifying all critical supplier debt scenarios against real PostgreSQL
- All tests pass, no regressions in existing test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Test fixtures** - `3a45590` (feat)
2. **Task 2: E2E test suite** - `273f5d4` (test)

## Files Created/Modified
- `src/__tests__/helpers/fixtures.ts` - Added createTestSupplier and createTestOrderWithSupplier helpers
- `src/__tests__/e2e/supplier-debts.e2e.test.ts` - 8 E2E tests for supplier debt workflows

## Decisions Made
- Used Number() for Prisma Decimal comparisons in tests (toString() returns "2000" not "2000.00")
- Used beforeEach for test data setup since setup-db.ts TRUNCATE CASCADE runs between tests (beforeAll data gets wiped)
- Payment.create requires shiftId (NOT NULL FK) so tests create a shift in beforeEach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Decimal toString comparison**
- **Found during:** Task 2
- **Issue:** Plan expected `amount.toString()` to return "2000.00", but Prisma Decimal toString() returns "2000" (no trailing zeros)
- **Fix:** Changed comparisons to use `Number(amount)` with numeric expected values
- **Files modified:** src/__tests__/e2e/supplier-debts.e2e.test.ts
- **Committed in:** 273f5d4

**2. [Rule 1 - Bug] Fixed Payment.shiftId requirement**
- **Found during:** Task 2
- **Issue:** Payment model has shiftId NOT NULL (FIN-11), test payments need a shift
- **Fix:** Created shift in beforeEach and passed shiftId to all Payment.create calls
- **Files modified:** src/__tests__/e2e/supplier-debts.e2e.test.ts
- **Committed in:** 273f5d4

**3. [Rule 1 - Bug] Fixed COMPLETED transition requires full payment**
- **Found during:** Task 2
- **Issue:** updateOrderStatus("COMPLETED") validates totalPaid >= totalAmount, test had no payment
- **Fix:** Added full payment before COMPLETED transition in SUP-06 test
- **Files modified:** src/__tests__/e2e/supplier-debts.e2e.test.ts
- **Committed in:** 273f5d4

**4. [Rule 1 - Bug] Used contactName instead of contactPerson**
- **Found during:** Task 1
- **Issue:** Plan used `contactPerson` field name but Supplier model uses `contactName`
- **Fix:** Used correct field name in createTestSupplier fixture
- **Files modified:** src/__tests__/helpers/fixtures.ts
- **Committed in:** 3a45590

---

**Total deviations:** 4 auto-fixed (4 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing test failures in 4 other E2E files (rate-limiting, Decimal precision) remain unrelated to this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All supplier debt backend + tests complete
- Plan 02 (UI components) can proceed independently
- Test fixtures ready for Phase 14 payroll tests

---
*Phase: 13-suppliers-debts*
*Completed: 2026-04-12*
