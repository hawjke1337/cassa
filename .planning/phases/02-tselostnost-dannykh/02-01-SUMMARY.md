---
phase: 02-tselostnost-dannykh
plan: 01
subsystem: database
tags: [postgresql, prisma, select-for-update, pessimistic-locking, race-condition, raw-sql]

# Dependency graph
requires:
  - phase: 01-security
    provides: Validated actions structure with Zod, permissions, server-side price resolution
provides:
  - "SELECT FOR UPDATE pessimistic locking on StoreProduct.quantity in sales, returns, receives, audits"
  - "Transactional getNextNumber(prefix, tx) with atomic INSERT ON CONFLICT + UPDATE RETURNING"
  - "PrismaTx type export for consistent transaction typing"
  - "All document numbering moved inside $transaction blocks across all action files"
affects: [02-tselostnost-dannykh, inventory, sales, orders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pessimistic locking via raw SQL SELECT FOR UPDATE before quantity changes"
    - "Batch row locking with ANY(ids::text[]) for multi-item operations"
    - "Atomic counter with INSERT ON CONFLICT DO NOTHING + UPDATE RETURNING"
    - "Transaction client passthrough: getNextNumber(prefix, tx)"

key-files:
  created:
    - src/__tests__/counter-transaction.test.ts
    - src/__tests__/stock-locking.test.ts
  modified:
    - src/lib/counters.ts
    - src/actions/sales.ts
    - src/actions/inventory.ts
    - src/actions/shifts.ts
    - src/actions/orders.ts
    - src/actions/repairs.ts
    - src/actions/trade-in.ts
    - src/actions/warranty-claims.ts

key-decisions:
  - "Raw SQL for locking instead of Prisma findUnique -- Prisma has no FOR UPDATE support"
  - "Batch lock with ANY() array instead of per-item locks -- reduces lock overhead for multi-item sales"
  - "FOR UPDATE OF sp (table alias) in JOINed queries to lock only StoreProduct, not Product"
  - "All getNextNumber calls moved inside transactions, even for non-stock-affecting documents (consistency)"

patterns-established:
  - "Stock mutation pattern: SELECT FOR UPDATE -> validate -> update with decrement/increment"
  - "Document numbering pattern: getNextNumber(prefix, tx) inside $transaction"
  - "Static analysis tests: readFileSync + regex to verify code patterns"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 9min
completed: 2026-04-05
---

# Phase 2 Plan 1: Stock Locking & Transactional Numbering Summary

**Pessimistic locking (SELECT FOR UPDATE) on all stock mutations + atomic transactional document numbering across 8 action files**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-05T12:38:17Z
- **Completed:** 2026-04-05T12:47:39Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Eliminated race condition where two concurrent sales could sell the last item (SELECT FOR UPDATE on StoreProduct)
- Eliminated duplicate document numbers from parallel transactions (getNextNumber inside $transaction with atomic SQL)
- Updated all 8 action files (sales, inventory, shifts, orders, repairs, trade-in, warranty-claims) for consistency
- Added 15 new tests (4 counter unit tests + 11 static analysis tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Transactional getNextNumber and tests (DATA-02)** - `8d9b7a6` (feat)
2. **Task 2: SELECT FOR UPDATE + transactional numbering in all actions (DATA-01)** - `3df93a4` (feat)

## Files Created/Modified

- `src/lib/counters.ts` - Rewritten with raw SQL atomic counter, optional tx param, PrismaTx type export
- `src/actions/sales.ts` - FOR UPDATE in createSale (batch), FOR UPDATE in createReturn, getNextNumber with tx
- `src/actions/inventory.ts` - FOR UPDATE in confirmReceive and confirmAudit, all getNextNumber calls with tx
- `src/actions/shifts.ts` - getNextNumber("SH", tx) inside existing transaction
- `src/actions/orders.ts` - getNextNumber("CO", tx) and getNextNumber("S", tx) wrapped in transactions
- `src/actions/repairs.ts` - getNextNumber("REP", tx) moved inside transaction
- `src/actions/trade-in.ts` - getNextNumber("TI", tx) and getNextNumber("REP", tx) moved inside transactions
- `src/actions/warranty-claims.ts` - getNextNumber("WC", tx) wrapped in transaction
- `src/__tests__/counter-transaction.test.ts` - 4 tests for counter backward compat, tx usage, format, uniqueness
- `src/__tests__/stock-locking.test.ts` - 11 static analysis tests verifying FOR UPDATE and tx patterns

## Decisions Made

- Used raw SQL for locking because Prisma ORM has no SELECT FOR UPDATE support
- Batch lock with ANY(ids::text[]) for multi-item sales instead of per-item locks (fewer round-trips)
- FOR UPDATE OF sp (table alias) when JOINing StoreProduct with Product to only lock the stock row
- Extended scope beyond plan to include repairs.ts, trade-in.ts, warranty-claims.ts for full consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended getNextNumber tx to repairs, trade-in, warranty-claims**

- **Found during:** Task 2
- **Issue:** Plan only listed sales.ts, inventory.ts, shifts.ts, orders.ts, returns.ts for getNextNumber updates, but repairs.ts, trade-in.ts, and warranty-claims.ts also call getNextNumber outside transactions
- **Fix:** Updated all three additional files to move getNextNumber inside $transaction with tx
- **Files modified:** src/actions/repairs.ts, src/actions/trade-in.ts, src/actions/warranty-claims.ts
- **Verification:** grep -r "getNextNumber" shows all calls now pass tx
- **Committed in:** 3df93a4

**2. [Rule 1 - Bug] returns.ts does not exist as separate file**

- **Found during:** Task 2
- **Issue:** Plan references src/actions/returns.ts but createReturn lives in src/actions/sales.ts
- **Fix:** Applied changes to createReturn in sales.ts instead
- **Files modified:** src/actions/sales.ts
- **Committed in:** 3df93a4

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both deviations necessary for correctness and consistency. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stock locking foundation complete for all quantity-modifying operations
- Ready for Plan 02 (weighted average cost price) and Plan 03 (inventory reconciliation)
- All 63 tests pass (Phase 1 + Phase 2)
- TypeScript compiles clean

---

_Phase: 02-tselostnost-dannykh_
_Completed: 2026-04-05_
