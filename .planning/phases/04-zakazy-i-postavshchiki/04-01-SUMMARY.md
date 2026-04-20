---
phase: 04-zakazy-i-postavshchiki
plan: 01
subsystem: orders
tags: [prisma, orders, net-profit, supplier-debt, discount, permissions]

requires:
  - phase: 03-skhema-bd
    provides: "CustomOrder, SupplierDebt models with indexes and constraints"
provides:
  - "purchasePrice and deliveryCost fields on CustomOrder"
  - "orders.manage_costs permission"
  - "calculateNetProfit, calculateOrderTotalAmount, validateDiscountAmount pure functions"
  - "updateOrderCosts server action with debt sync"
  - "updateOrderItem server action with totalAmount recalc"
  - "discountAmount support in COMPLETED flow"
  - "Supplier select in order form, editable prices, cost entry dialog, net profit display"
affects: [04-zakazy-i-postavshchiki, reports, suppliers]

tech-stack:
  added: []
  patterns:
    - "Pure validation functions in src/lib/*-utils.ts for testability"
    - "Confirmation dialog pattern for financial data entry"

key-files:
  created:
    - src/lib/order-utils.ts
    - src/__tests__/order-net-profit.test.ts
    - src/__tests__/order-costs.test.ts
    - src/__tests__/order-discount.test.ts
    - src/__tests__/order-item-edit.test.ts
    - prisma/migrations/20260405202306_add_order_purchase_costs/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/permissions-list.ts
    - src/actions/orders.ts
    - src/components/orders/order-form.tsx
    - src/components/orders/order-detail.tsx

key-decisions:
  - "Pure functions for profit/discount/costs validation -- same pattern as Phase 2 utils"
  - "orders.manage_costs separate from orders.costs -- view vs edit distinction"
  - "Purchaser role gets orders.manage_costs by default"
  - "Confirmation step in cost entry dialog -- financial data requires double-check"

patterns-established:
  - "Financial data entry with confirmation dialog before submit"
  - "Permission-gated sections in order detail (canManageCosts)"

requirements-completed: [ORD-01, ORD-02, ORD-03, ORD-04, ORD-07, ORD-08]

duration: 11min
completed: 2026-04-05
---

# Phase 04 Plan 01: Orders Management Summary

**Order purchase costs, net profit calculation, discount support, supplier selection, and editable item prices with 18 unit tests**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-05T20:21:32Z
- **Completed:** 2026-04-05T20:33:29Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Schema migration adding purchasePrice and deliveryCost to CustomOrder, with Prisma client regeneration
- Pure utility functions (calculateNetProfit, calculateOrderTotalAmount, validateDiscountAmount, validateOrderCostsInput) with 18 TDD tests
- Server actions: updateOrderCosts (with supplier debt auto-sync), updateOrderItem (with totalAmount recalc), discountAmount in COMPLETED flow
- UI: supplier dropdown in order form, editable prices, net profit display, cost entry dialog with confirmation, discount fields in completion dialogs

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + permissions + pure utils + tests** - `22911b5` (feat, TDD)
2. **Task 2: Server actions + UI** - `9ce493c` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added purchasePrice, deliveryCost to CustomOrder
- `prisma/migrations/20260405202306_add_order_purchase_costs/` - DB migration
- `src/lib/permissions-list.ts` - Added orders.manage_costs permission + purchaser role
- `src/lib/order-utils.ts` - Pure functions: calculateNetProfit, calculateOrderTotalAmount, validateDiscountAmount, validateOrderCostsInput
- `src/__tests__/order-net-profit.test.ts` - 5 tests for net profit calculation
- `src/__tests__/order-costs.test.ts` - 6 tests for costs validation
- `src/__tests__/order-discount.test.ts` - 4 tests for discount validation
- `src/__tests__/order-item-edit.test.ts` - 3 tests for order total calculation
- `src/actions/orders.ts` - updateOrderCosts, updateOrderItem actions; supplierId in createOrder; discountAmount in COMPLETED
- `src/components/orders/order-form.tsx` - Supplier select dropdown, editable price inputs
- `src/components/orders/order-detail.tsx` - Net profit display, cost entry dialog, discount fields, CompleteWithDiscountDialog

## Decisions Made
- Pure functions for profit/discount/costs validation -- same pattern as Phase 2 utils
- orders.manage_costs separate from orders.costs -- view vs edit distinction
- Purchaser role gets orders.manage_costs by default
- Confirmation step in cost entry dialog -- financial data requires double-check
- supplierId passed directly (unchecked Prisma style) matching existing storeId/sellerId pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regeneration after schema change**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** TypeScript errors because purchasePrice/deliveryCost not in Prisma types
- **Fix:** Ran `npx prisma generate` to regenerate client
- **Verification:** tsc --noEmit passes
- **Committed in:** 9ce493c (Task 2 commit)

**2. [Rule 1 - Bug] Fixed supplier connect pattern in createOrder**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Using `{ supplier: { connect: { id } } }` incompatible with unchecked create input style
- **Fix:** Changed to `supplierId: data.supplierId || null` matching existing pattern
- **Verification:** tsc --noEmit passes
- **Committed in:** 9ce493c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- File path encoding with Russian characters caused Edit tool failures -- resolved via /tmp symlink

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Order management foundation complete with financial tracking
- Ready for Phase 04-02 (supplier management extensions or remaining order features)
- All 103 tests pass (18 new + 85 existing)

---
*Phase: 04-zakazy-i-postavshchiki*
*Completed: 2026-04-05*

## Self-Check: PASSED

All 11 files verified present. Both commits found. All 7 content checks passed.
