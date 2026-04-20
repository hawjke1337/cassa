---
phase: 13-suppliers-debts
plan: 01
subsystem: payments
tags: [prisma, supplier-debt, partial-payment, cash-operation, audit-log, permissions]

requires:
  - phase: 08-order-sale-flow
    provides: CashOperation model, Payment flow patterns
  - phase: 04-orders-suppliers
    provides: SupplierDebt model, CustomOrder supplier relation
provides:
  - SupplierPayment model with cascade delete from SupplierDebt
  - paySupplierDebt action with partial payment support + CashOperation tracking
  - Payment-aware updateOrderCosts with auto-close on full payment
  - suppliers.pay permission
  - Audit logging for debt lifecycle (creation, payment, amount change)
affects: [13-suppliers-debts, 14-payroll, 16-ux-polish]

tech-stack:
  added: []
  patterns:
    - "Administrative CashOperation with shiftId=null (no shift required)"
    - "Partial payment tracking via SupplierPayment aggregate"
    - "Audit trail for financial entity lifecycle events"

key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/actions/orders.ts
    - src/lib/permissions-list.ts
    - src/components/orders/order-detail.tsx
    - src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
    - src/actions/reports.ts

key-decisions:
  - "CashOperation.shiftId nullable for administrative supplier payments outside shifts"
  - "Partial payment: gte(totalPaid, debtAmount) auto-closes debt (isPaid=true)"
  - "suppliers.pay added to purchaser role preset (not just owner/director)"

patterns-established:
  - "Administrative financial ops use shiftId=null on CashOperation"
  - "Debt payment = SupplierPayment + CashOperation(WITHDRAW) in single transaction"

requirements-completed: [SUP-01, SUP-04, SUP-05, SUP-06]

duration: 9min
completed: 2026-04-12
---

# Phase 13 Plan 01: Supplier Debts Backend Summary

**SupplierPayment model with partial payment tracking, CashOperation integration (shiftId=null for admin ops), payment-aware cost recalculation, and audit logging across debt lifecycle**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-12T13:28:37Z
- **Completed:** 2026-04-12T13:37:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SupplierPayment model added to schema with cascade delete from SupplierDebt, CashOperation.shiftId made nullable
- paySupplierDebt replaces markSupplierDebtPaid: creates SupplierPayment + CashOperation(WITHDRAW, shiftId=null) in transaction with partial payment support
- updateOrderCosts now recalculates remaining debt considering existing payments, auto-closes if fully paid
- Audit logging added for debt creation (at ORDERED), payment, and amount change
- suppliers.pay permission registered and added to owner, director, and purchaser presets

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + permission** - `f5cb8db` (feat)
2. **Task 2: Refactor paySupplierDebt + updateOrderCosts + cancelOrderWithDecision + audit** - `2b05d3c` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added SupplierPayment model, made CashOperation.shiftId nullable, added reverse relations
- `src/actions/orders.ts` - paySupplierDebt with partial payments, payment-aware updateOrderCosts, cascade-aware cancel, audit logging
- `src/lib/permissions-list.ts` - Added SUPPLIERS_PAY permission, included in purchaser preset
- `src/components/orders/order-detail.tsx` - Updated MarkDebtPaidButton to pass debtAmount
- `src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx` - Updated handleMarkPaid to pass amount
- `src/actions/reports.ts` - Fixed nullable shift access after CashOperation.shiftId change

## Decisions Made
- CashOperation.shiftId made nullable to support administrative supplier payments outside of shifts (aligns with plan)
- suppliers.pay added to purchaser role preset since purchasers handle supplier interactions
- Used Prisma.Decimal `.gte()` method directly instead of non-existent `gte()` helper from money.ts (plan interface was incorrect)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed callers of markSupplierDebtPaid after signature change**
- **Found during:** Task 2
- **Issue:** order-detail.tsx and supplier-debts-client.tsx called markSupplierDebtPaid with 1 arg, but new paySupplierDebt requires paymentAmount
- **Fix:** Updated callers to pass debt.amount / order.debtAmount for full payment (preserves old behavior)
- **Files modified:** src/components/orders/order-detail.tsx, src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
- **Committed in:** 2b05d3c

**2. [Rule 1 - Bug] Fixed nullable shift access in reports.ts**
- **Found during:** Task 2
- **Issue:** CashOperation.shiftId now nullable, so op.shift.store.name fails with TS18047
- **Fix:** Changed to op.shift?.store.name ?? "Bez magazina"
- **Files modified:** src/actions/reports.ts
- **Committed in:** 2b05d3c

**3. [Rule 3 - Blocking] Ran prisma generate after schema change**
- **Found during:** Task 2
- **Issue:** TypeScript errors because Prisma client was not regenerated after adding SupplierPayment model
- **Fix:** Ran pnpm prisma generate
- **Committed in:** implicit (generated files not committed)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Plan's interface section listed `gte(a, b)` as a money.ts export, but it does not exist. Used Prisma.Decimal's native `.gte()` method instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend complete for supplier debt partial payments
- Plan 02/03 can build UI components on top of paySupplierDebt action
- Pre-existing TSC errors in repairs.ts, trade-in.ts, test files remain (unrelated to this plan)

---
*Phase: 13-suppliers-debts*
*Completed: 2026-04-12*
