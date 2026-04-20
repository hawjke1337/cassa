---
phase: 04-zakazy-i-postavshchiki
plan: 02
subsystem: reports, motivation
tags: [prisma, commission, netProfit, supplier-debts, reports, shadcn]

requires:
  - phase: 04-zakazy-i-postavshchiki/04-01
    provides: calculateNetProfit, CustomOrder model, SupplierDebt model, markSupplierDebtPaid
provides:
  - getSupplierDebtsReport server action with filters and aggregation
  - calculateOrderItemCommission for order-based sales
  - Supplier debts report page at /reports/supplier-debts
affects: [motivation, reports, orders]

tech-stack:
  added: []
  patterns: [order-based commission from netProfit, report page with client component pattern]

key-files:
  created:
    - src/__tests__/order-commission.test.ts
    - src/app/(dashboard)/reports/supplier-debts/page.tsx
    - src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
  modified:
    - src/lib/motivation-utils.ts
    - src/actions/motivation-calculation.ts
    - src/actions/reports.ts
    - src/app/(dashboard)/reports/page.tsx

key-decisions:
  - "Order commission uses netProfit directly (per-order), not per-item -- simpler and more accurate for custom orders"
  - "Sale.customOrder reverse relation exists in Prisma -- no need for separate batch query"
  - "Select onValueChange nullable handled with fallback to 'all' for type safety"

patterns-established:
  - "Order-based commission: calculateOrderItemCommission uses netProfit for PROFIT basis, falls back to 0 when purchasePrice is null"
  - "Report page pattern: server page with permission check + client component with filters"

requirements-completed: [ORD-05, ORD-06]

duration: 4min
completed: 2026-04-05
---

# Phase 4 Plan 2: Supplier Debts Report & Order Commission Summary

**Supplier debts report with filters/aggregation + order commission recalculated from netProfit instead of sellPrice-costPrice**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T20:36:17Z
- **Completed:** 2026-04-05T20:40:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- calculateOrderItemCommission uses netProfit for order-based sales; purchasePrice=null yields 0 commission
- Supplier debts report page with filters (supplier, status, date range) and summary cards (unpaid/paid totals)
- Link to supplier debts report added on reports index page
- 9 new tests for calculateOrderItemCommission, all 112 tests green

## Task Commits

1. **Task 1: Order commission from netProfit (TDD)** - `51331d4` (feat)
2. **Task 2: Supplier debts report** - `0f28125` (feat)

## Files Created/Modified
- `src/lib/motivation-utils.ts` - Added calculateOrderItemCommission function
- `src/actions/motivation-calculation.ts` - Include customOrder in sales query, use netProfit for order commission
- `src/__tests__/order-commission.test.ts` - 9 tests for calculateOrderItemCommission
- `src/actions/reports.ts` - Added getSupplierDebtsReport with Prisma aggregate
- `src/app/(dashboard)/reports/supplier-debts/page.tsx` - Server page with orders.costs permission
- `src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx` - Client component with filters/table/mark-paid
- `src/app/(dashboard)/reports/page.tsx` - Added link to supplier debts report

## Decisions Made
- Sale model has `customOrder CustomOrder?` reverse relation -- used include directly instead of batch query
- orderNetProfit set to `undefined` for regular sales vs `null` for orders without purchasePrice -- clear distinction
- Select component onValueChange nullable type fixed with fallback to "all"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Select onValueChange type mismatch**
- **Found during:** Task 2 (Supplier debts client component)
- **Issue:** shadcn Select onValueChange passes `string | null` but state setter expects `string`
- **Fix:** Wrapped with `(v) => setSupplierId(v ?? "all")` fallback
- **Files modified:** src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 0f28125 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix required for TypeScript strict mode. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Orders & Suppliers) complete
- Ready for Phase 5

---
*Phase: 04-zakazy-i-postavshchiki*
*Completed: 2026-04-05*

## Self-Check: PASSED
