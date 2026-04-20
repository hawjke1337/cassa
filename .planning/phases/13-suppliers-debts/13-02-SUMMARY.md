---
phase: 13-suppliers-debts
plan: 02
subsystem: ui
tags: [next.js, shadcn-ui, alert-dialog, supplier-debt, partial-payment, dashboard]

requires:
  - phase: 13-suppliers-debts
    provides: paySupplierDebt action, SupplierPayment model, suppliers.pay permission
  - phase: 08-order-sale-flow
    provides: CashOperation model, order detail patterns
provides:
  - DebtPaymentDialog component (AlertDialog with partial payment support)
  - Order detail 3-amount display (client price / purchase / profit) with permission guard
  - /suppliers/debts page for debt management
  - Dashboard StatCard for supplier debts aggregate
  - Sidebar "Долги" navigation item
  - Supplier card payment history table
  - Reports page with payment columns (Оплачено/Остаток) + DebtPaymentDialog
affects: [16-ux-polish]

tech-stack:
  added: []
  patterns:
    - "DebtPaymentDialog as reusable AlertDialog component for partial debt payments"
    - "Permission guard on financial UI (orders.costs) for cost visibility"

key-files:
  created:
    - src/components/suppliers/debt-payment-dialog.tsx
    - src/app/(dashboard)/suppliers/debts/page.tsx
  modified:
    - src/components/orders/order-detail.tsx
    - src/components/suppliers/supplier-detail.tsx
    - src/actions/suppliers.ts
    - src/actions/dashboard.ts
    - src/components/dashboard/dashboard-content.tsx
    - src/components/layout/app-sidebar.tsx
    - src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
    - src/actions/reports.ts

key-decisions:
  - "Reuse SupplierDebtsClient component from reports for /suppliers/debts page (same filters and table)"
  - "Added totalPaid field to getSupplierDebtsReport for partial payment visibility in table"

patterns-established:
  - "DebtPaymentDialog accepts debtAmount/totalPaid as strings, computes remaining internally"
  - "Dashboard supplier debts card conditionally shown only when supplierDebtsCount > 0"

requirements-completed: [SUP-03, SUP-04, SUP-07, SUP-08, SUP-09]

duration: 5min
completed: 2026-04-13
---

# Phase 13 Plan 02: Supplier Debts UI Summary

**Order 3-amount display with profit calculation, DebtPaymentDialog with AlertDialog for partial payments, /suppliers/debts page, dashboard StatCard, sidebar navigation, and reports payment columns**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-13T15:54:35Z
- **Completed:** 2026-04-13T15:59:24Z
- **Tasks:** 2/3 (Task 3 is checkpoint:human-verify)
- **Files modified:** 10

## Accomplishments
- Order detail card shows 3 amounts (client price, purchase, profit) with "He рассчитана" for missing purchasePrice, guarded by orders.costs permission
- DebtPaymentDialog (AlertDialog) enables partial debt payments with amount validation, remaining computation, and optional comment
- /suppliers/debts page created with permission guard, reusing SupplierDebtsClient from reports
- Dashboard shows supplier debts StatCard in red when unpaid debts exist, with link to /suppliers/debts
- Sidebar has "Долги" item under Поставщики with orders.costs permission guard
- Reports page updated with Оплачено/Остаток columns and DebtPaymentDialog replacing inline "Оплачен" button
- Supplier card shows payment history table with date, amount, order #, comment, operator

## Task Commits

Each task was committed atomically:

1. **Task 1: Order detail card + DebtPaymentDialog + supplier payment history** - `e937fe8` (feat)
2. **Task 2: Debts page + dashboard card + sidebar nav + reports payment columns** - `9d375af` (feat)
3. **Task 3: Visual verification** - checkpoint:human-verify (pending)

## Files Created/Modified
- `src/components/suppliers/debt-payment-dialog.tsx` - AlertDialog for partial debt payment with amount/comment fields
- `src/app/(dashboard)/suppliers/debts/page.tsx` - New debts management page with permission guard
- `src/components/orders/order-detail.tsx` - 3 amounts display + supplier city + "Не рассчитана" for missing profit
- `src/components/suppliers/supplier-detail.tsx` - Payment history table + DebtPaymentDialog on unpaid debts
- `src/actions/suppliers.ts` - getSupplier includes debt payments with user and order relations
- `src/actions/dashboard.ts` - supplierDebts aggregate query with orders.costs permission check
- `src/components/dashboard/dashboard-content.tsx` - StatCard for supplier debts with red styling
- `src/components/layout/app-sidebar.tsx` - "Долги" nav item with orders.costs permission
- `src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx` - Added Оплачено/Остаток columns, DebtPaymentDialog, 3-way status badges
- `src/actions/reports.ts` - Added totalPaid computation from payments in getSupplierDebtsReport

## Decisions Made
- Reused SupplierDebtsClient from reports for /suppliers/debts page instead of creating duplicate component
- Added totalPaid to report data to support Оплачено/Остаток columns and proper DebtPaymentDialog initialization

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken markSupplierDebtPaid import in supplier-debts-client.tsx**
- **Found during:** Task 2
- **Issue:** Reports client imported `markSupplierDebtPaid` from orders.ts which was removed in Plan 01 (replaced by `paySupplierDebt`)
- **Fix:** Replaced inline "Оплачен" button with DebtPaymentDialog component (which correctly uses paySupplierDebt)
- **Files modified:** src/app/(dashboard)/reports/supplier-debts/supplier-debts-client.tsx
- **Committed in:** 9d375af

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correctness -- markSupplierDebtPaid no longer exists. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete supplier debt UI ready for visual verification (Task 3 checkpoint)
- After verification, Plan 03 (E2E tests) can proceed

---
*Phase: 13-suppliers-debts*
*Completed: 2026-04-13*
