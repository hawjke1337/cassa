---
phase: 02-tselostnost-dannykh
plan: 02
subsystem: database
tags: [prisma, vitest, zod, financial-calculations, inventory, motivation]

requires:
  - phase: 01-security
    provides: "Permission checks, validated schemas"
provides:
  - "Weighted average costPrice calculation on stock receive"
  - "sellPrice fallback (costPrice * 1.3) for serialized products"
  - "Per-item commission deduction on partial returns"
  - "Commission rate validation (PERCENT <= 1, FIXED <= 100000)"
affects: [03-serialization, 04-motivation, 05-reports]

tech-stack:
  added: []
  patterns: ["Pure utility extraction for testability (inventory-utils, motivation-utils)"]

key-files:
  created:
    - src/lib/inventory-utils.ts
    - src/lib/motivation-utils.ts
    - src/__tests__/weighted-cost-price.test.ts
    - src/__tests__/sell-price-fallback.test.ts
    - src/__tests__/partial-return-commission.test.ts
    - src/__tests__/motivation-validation.test.ts
  modified:
    - src/actions/inventory.ts
    - src/actions/motivation-calculation.ts
    - src/lib/validations/motivation.ts

key-decisions:
  - "Pure functions extracted to src/lib/*-utils.ts to avoid server action import chain in tests"
  - "sellPrice fallback uses 1.3x costPrice multiplier for serialized products at creation time only"
  - "returnedQuantityMap accumulates across both in-period and cross-period returns"

patterns-established:
  - "Pure business logic in src/lib/*-utils.ts, imported by server actions"
  - "Weighted average formula for costPrice across multiple stock receives"

requirements-completed: [DATA-03, DATA-05, DATA-06, DATA-07]

duration: 5min
completed: 2026-04-05
---

# Phase 2 Plan 02: Financial Calculations Fix Summary

**Weighted avg costPrice on receive, sellPrice fallback for serialized products, per-item return deductions, commission rate validation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T12:38:12Z
- **Completed:** 2026-04-05T12:43:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- confirmReceive now calculates weighted average costPrice instead of overwriting with last batch price
- New serialized StoreProducts get sellPrice = costPrice * 1.3 instead of 0
- Partial returns deduct commission proportionally per-item (not all-or-nothing per SaleItem)
- commissionRuleSchema validates rate bounds: PERCENT max 1 (100%), FIXED max 100000

## Task Commits

Each task was committed atomically:

1. **Task 1: Weighted costPrice and sellPrice fallback** - `9df47c2` (feat)
2. **Task 2: Per-item return deductions and rate validation** - `7f36370` (feat)

## Files Created/Modified
- `src/lib/inventory-utils.ts` - weightedAvgCostPrice and sellPriceFallback pure functions
- `src/lib/motivation-utils.ts` - calculateItemCommission pure function (extracted from server action)
- `src/actions/inventory.ts` - Uses weighted avg in confirmReceive, sellPrice fallback for serialized
- `src/actions/motivation-calculation.ts` - returnedQuantityMap Map instead of returnedItemIds Set
- `src/lib/validations/motivation.ts` - commissionRuleSchema with .refine() for rate bounds
- `src/__tests__/weighted-cost-price.test.ts` - 4 tests for weighted average formula
- `src/__tests__/sell-price-fallback.test.ts` - 3 tests for sellPrice fallback
- `src/__tests__/partial-return-commission.test.ts` - 5 tests for commission calculation
- `src/__tests__/motivation-validation.test.ts` - 6 tests for rate validation

## Decisions Made
- Extracted pure functions to `src/lib/*-utils.ts` instead of keeping in server action files -- server actions import `db`, `auth`, `next-auth` which break vitest imports. Separate utility files keep business logic testable without mocking the entire framework chain.
- sellPrice fallback applies only on StoreProduct creation (not update) to preserve admin-set prices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted pure functions to separate utility files**
- **Found during:** Task 1 (test creation)
- **Issue:** Plan specified adding pure functions to `src/actions/inventory.ts` and exporting from there, but importing that file in tests pulls in `next-auth` -> `next/server` chain which fails in vitest
- **Fix:** Created `src/lib/inventory-utils.ts` and `src/lib/motivation-utils.ts` for pure functions, imported them in the server action files
- **Files modified:** src/lib/inventory-utils.ts, src/lib/motivation-utils.ts
- **Verification:** All 18 tests pass, TypeScript compiles clean
- **Committed in:** 9df47c2 (Task 1), 7f36370 (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking import chain)
**Impact on plan:** Better separation of concerns. Pure business logic is now independently testable. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `src/__tests__/counter-transaction.test.ts` (unrelated to this plan)
- Pre-existing test failures in `stock-locking.test.ts` for `shifts.ts`, `orders.ts`, and `inventory.ts` getNextNumber tx passing (unrelated, from Phase 2 Plan 01 scope)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Financial calculation formulas are now correct and tested
- Ready for Phase 2 Plan 03+ or Phase 3 serialization work
- 18 new unit tests provide regression safety for costPrice, sellPrice, and commission logic

---
*Phase: 02-tselostnost-dannykh*
*Completed: 2026-04-05*
