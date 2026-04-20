---
phase: 11-repair-as-sale
plan: 03
subsystem: api
tags: [prisma, warranty, serial-unit, sale-lookup]

requires:
  - phase: 11-repair-as-sale
    provides: "Repair as Sale foundation (plans 01-02)"
provides:
  - "lookupForWarrantyClaim with SOLD+IN_STOCK filter"
  - "lookupForWarrantyClaim with Sale.number search"
  - "6 E2E tests for warranty lookup (REPAIR-07, REPAIR-08, REPAIR-09)"
affects: [warranty-ui, warranty-claims]

tech-stack:
  added: []
  patterns: ["per-test fixture setup in E2E (no beforeAll for data due to TRUNCATE CASCADE)"]

key-files:
  created:
    - src/__tests__/e2e/warranty-lookup.e2e.test.ts
  modified:
    - src/actions/warranty-claims.ts

key-decisions:
  - "Non-serial sale found by Sale.number returns serialUnitId=null, isUnderWarranty=false"

patterns-established:
  - "Per-test fixture creation: E2E tests use inline setupFixtures() due to beforeEach TRUNCATE CASCADE"

requirements-completed: [REPAIR-07, REPAIR-08, REPAIR-09]

duration: 10min
completed: 2026-04-11
---

# Phase 11 Plan 03: Warranty Lookup Bugs Summary

**Fixed lookupForWarrantyClaim to find IN_STOCK devices and search by Sale.number, with 6 E2E tests covering all warranty lookup requirements**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-11T17:26:25Z
- **Completed:** 2026-04-11T17:36:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- lookupForWarrantyClaim now finds SerialUnit with both SOLD and IN_STOCK status (REPAIR-07)
- lookupForWarrantyClaim searches by Sale.number before returning not_found (REPAIR-09)
- warrantyUntil expiry check verified by E2E tests for both expired and valid cases (REPAIR-08)
- 6 E2E tests all green

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Fix lookupForWarrantyClaim + E2E tests** - `24ec9e9` (feat) -- TDD: tests and implementation shipped together

## Files Created/Modified

- `src/actions/warranty-claims.ts` - Fixed SOLD+IN_STOCK filter, added Sale.number search block
- `src/__tests__/e2e/warranty-lookup.e2e.test.ts` - 6 E2E tests for REPAIR-07, REPAIR-08, REPAIR-09

## Decisions Made

- Non-serial sale found by Sale.number returns serialUnitId=null, isUnderWarranty=false (basic info for repair sales without serial units)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-test fixture creation instead of beforeAll**

- **Found during:** Task 2 (E2E tests)
- **Issue:** Plan used beforeAll for fixture setup, but setup-db.ts runs TRUNCATE CASCADE in beforeEach, wiping all beforeAll data
- **Fix:** Changed to per-test setupFixtures() helper following existing E2E patterns (e.g., order-completion.e2e.test.ts)
- **Files modified:** src/**tests**/e2e/warranty-lookup.e2e.test.ts
- **Verification:** All 6 tests pass

**2. [Rule 3 - Blocking] Added costPrice and storeId to test fixtures**

- **Found during:** Task 2 (E2E tests)
- **Issue:** SerialUnit.costPrice is required (not optional), SerialUnitHistory.storeId is required
- **Fix:** Added costPrice: "500.00" to all serialUnit creates, storeId to history creates
- **Files modified:** src/**tests**/e2e/warranty-lookup.e2e.test.ts
- **Verification:** All FK constraints satisfied, tests pass

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 warranty lookup requirements (REPAIR-07, REPAIR-08, REPAIR-09) verified
- Warranty claims UI can now rely on correct lookupForWarrantyClaim behavior

---

_Phase: 11-repair-as-sale_
_Completed: 2026-04-11_
