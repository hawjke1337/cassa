---
phase: 15-data-integrity-hardening
plan: 01
subsystem: database
tags: [postgres, check-constraints, prisma, data-integrity, e2e]

# Dependency graph
requires:
  - phase: 07-test-infrastructure
    provides: E2E test infrastructure with schema-per-worker isolation
  - phase: 08-order-sale-flow
    provides: Payment model with shiftId FK, isExpense flag
provides:
  - DB-level CHECK constraint for Payment exclusivity (exactly one FK or expense)
  - Quantity non-negative CHECK constraints on StoreProduct, SaleItem, StockReceiveItem, ReturnItem
  - SerialUnit partial unique index on (productId, imei)
  - 14 E2E tests proving all constraints reject invalid data
affects: [15-data-integrity-hardening, 16-inventory-edge-cases]

# Tech tracking
tech-stack:
  added: []
  patterns: [raw-sql-check-constraints, e2e-constraint-testing-with-beforeAll-ddl]

key-files:
  created:
    - prisma/migrations/20260414_data_integrity_checks/migration.sql
    - src/__tests__/e2e/data-integrity-constraints.e2e.test.ts
  modified: []

key-decisions:
  - "CHECK constraints applied via raw SQL migration (Prisma doesn't support CHECK natively)"
  - "E2E tests apply constraints in beforeAll since db push doesn't run migrations"
  - "SerialUnit partial unique index (WHERE imei IS NOT NULL) as defense-in-depth alongside global @unique"

patterns-established:
  - "E2E constraint tests: apply CHECK constraints via raw SQL in beforeAll, test violations via $executeRawUnsafe"
  - "Partial unique index pattern for nullable columns with WHERE clause"

requirements-completed: [DATA2-01, DATA2-07, DATA2-09]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 15 Plan 01: Data Integrity CHECK Constraints Summary

**DB-level CHECK constraints for Payment exclusivity (one FK), quantity non-negative, and SerialUnit productId+imei uniqueness -- proven by 14 E2E tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-14T10:39:25Z
- **Completed:** 2026-04-14T10:47:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Payment exclusivity CHECK: isExpense=true requires all FKs NULL; isExpense=false requires exactly 1 FK
- Quantity CHECK constraints: StoreProduct.quantity/reservedQuantity/minQty >= 0, SaleItem/StockReceiveItem/ReturnItem.quantity > 0
- SerialUnit partial unique index on (productId, imei) WHERE imei IS NOT NULL
- 14 E2E tests covering all constraint groups with both positive and negative cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Payment exclusivity CHECK + quantity CHECK constraints migration** - `aceea2e` (feat)
2. **Task 2: SerialUnit unique index + E2E constraint tests** - `5483003` (test)

## Files Created/Modified
- `prisma/migrations/20260414_data_integrity_checks/migration.sql` - CHECK constraints + partial unique index
- `src/__tests__/e2e/data-integrity-constraints.e2e.test.ts` - 14 E2E tests proving constraints work

## Decisions Made
- CHECK constraints applied via raw SQL migration since Prisma doesn't support CHECK constraint syntax natively
- E2E tests apply constraints in `beforeAll` because `prisma db push` (used for test schema creation) doesn't run migration SQL files
- SerialUnit partial unique index uses `WHERE "imei" IS NOT NULL` to allow multiple NULL imei entries while preventing duplicates on non-null values
- No data cleanup needed: pre-migration validation confirmed zero violations in dev DB

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing finalAmount field to Sale creates in tests**
- **Found during:** Task 2 (E2E test creation)
- **Issue:** Sale model requires `finalAmount` (non-nullable Decimal) but test Sale creates omitted it
- **Fix:** Added `finalAmount: "100.00"` to all 5 Sale create calls in tests
- **Files modified:** src/__tests__/e2e/data-integrity-constraints.e2e.test.ts
- **Verification:** All 14 E2E tests pass
- **Committed in:** 5483003 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial fix for missing required field. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data integrity constraints are active in dev DB and tested in E2E
- Ready for remaining Phase 15 plans (Decimal migration sweep, ESLint money-guard expansion)

## Self-Check: PASSED

- migration.sql: FOUND
- data-integrity-constraints.e2e.test.ts: FOUND (451 lines)
- Commit aceea2e: FOUND
- Commit 5483003: FOUND

---
*Phase: 15-data-integrity-hardening*
*Completed: 2026-04-14*
