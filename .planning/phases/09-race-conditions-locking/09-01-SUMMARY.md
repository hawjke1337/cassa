---
phase: 09-race-conditions-locking
plan: 01
subsystem: database
tags: [postgres, prisma, for-update, pessimistic-locking, race-conditions]

requires:
  - phase: 08-order-sale-flow
    provides: decrementStockForItems helper in stock-helpers.ts
provides:
  - lockSerialUnits batch helper for pessimistic SerialUnit locking
  - createSale hardened with FOR UPDATE on SerialUnit + batch stock decrement
  - createWriteOff hardened with FOR UPDATE on StoreProduct and SerialUnit
affects: [10-reports-banking-fees, 11-repair-as-sale, 15-data-integrity-hardening]

tech-stack:
  added: []
  patterns:
    [
      pessimistic-locking-for-update,
      batch-serial-lock-with-deadlock-prevention,
      lock-ordering-by-id-asc,
    ]

key-files:
  created: []
  modified:
    - src/lib/stock-helpers.ts
    - src/actions/sales.ts
    - src/actions/inventory.ts

key-decisions:
  - "lockSerialUnits uses ORDER BY id ASC to prevent deadlocks (single canonical lock order)"
  - "tx as any cast for lockSerialUnits calls — Prisma extended client vs TransactionClient type mismatch (same pattern as decrementStockForItems)"
  - "Serialized items explicitly decrement StoreProduct.quantity in createSale (mirrors completeOrder pattern for counter consistency)"

patterns-established:
  - "Batch lock via lockSerialUnits before any SerialUnit status mutation"
  - "Raw SQL FOR UPDATE on StoreProduct before quantity decrement in write-off operations"

requirements-completed: [LOCK-01, LOCK-03, LOCK-05]

duration: 4min
completed: 2026-04-09
---

# Phase 9 Plan 01: Pessimistic Locking Summary

**SELECT FOR UPDATE locking on SerialUnit and StoreProduct in createSale and createWriteOff to eliminate race conditions on concurrent sales and write-offs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T11:52:16Z
- **Completed:** 2026-04-09T11:56:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- lockSerialUnits batch helper with FOR UPDATE + ORDER BY id ASC (deadlock prevention) added to stock-helpers.ts
- createSale refactored: SerialUnit locked via lockSerialUnits instead of findUnique; stock decrement via decrementStockForItems batch helper
- createWriteOff hardened: non-serialized items use raw SQL FOR UPDATE on StoreProduct; serialized items use lockSerialUnits before WRITTEN_OFF

## Task Commits

Each task was committed atomically:

1. **Task 1: lockSerialUnits helper + createSale SerialUnit FOR UPDATE + batch stock decrement** - `95bbf2a` (feat)
2. **Task 2: createWriteOff FOR UPDATE hardening (LOCK-05)** - `13a2b17` (feat)

## Files Created/Modified

- `src/lib/stock-helpers.ts` - Added lockSerialUnits batch helper (SELECT FOR UPDATE + ORDER BY id ASC + status/storeId validation)
- `src/actions/sales.ts` - createSale uses lockSerialUnits for serial items, decrementStockForItems for batch stock decrement
- `src/actions/inventory.ts` - createWriteOff uses FOR UPDATE raw SQL on StoreProduct and lockSerialUnits on SerialUnit

## Decisions Made

- lockSerialUnits uses ORDER BY id ASC to establish canonical lock ordering and prevent deadlocks across concurrent transactions
- Used `tx as any` cast for lockSerialUnits/decrementStockForItems calls due to Prisma extended client type mismatch with TransactionClient (established pattern from Phase 8)
- Kept existing quantity check in createSale resolution loop as defense-in-depth (StoreProduct already locked via FOR UPDATE above)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Prisma TransactionClient type mismatch**

- **Found during:** Task 1 (lockSerialUnits call in createSale)
- **Issue:** `tx` from `db.$transaction` is extended client type, not compatible with `Prisma.TransactionClient` parameter type
- **Fix:** Added `as any` cast on `tx` parameter (same pattern used by decrementStockForItems in Phase 8)
- **Files modified:** src/actions/sales.ts, src/actions/inventory.ts
- **Verification:** `npx tsc --noEmit` passes with no errors in modified files
- **Committed in:** 95bbf2a (Task 1), 13a2b17 (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Trivial type cast, no scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LOCK-01 (SerialUnit FOR UPDATE in createSale), LOCK-03 (batch stock decrement), LOCK-05 (createWriteOff FOR UPDATE) all complete
- Ready for LOCK-02 (transfer locking), LOCK-04 (receive locking), LOCK-06 (inventory count locking) in subsequent plans

---

_Phase: 09-race-conditions-locking_
_Completed: 2026-04-09_
