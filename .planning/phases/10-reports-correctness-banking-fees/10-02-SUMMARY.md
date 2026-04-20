---
phase: 10-reports-correctness-banking-fees
plan: 02
subsystem: reports
tags: [cash-report, payment-methods, shift-reconciliation, prisma-raw-sql]

# Dependency graph
requires:
  - phase: 08-order-sale-flow
    provides: Payment model with isExpense, Shift model with openingCash/closingCash/expectedCash
provides:
  - getCashReport server action with per-shift payment method breakdown
  - CashReport UI component with summary strip, shift cards, period totals
  - New "Кассовый отчёт" tab in reports page
affects: [10-reports-correctness-banking-fees]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      per-shift payment aggregation via raw SQL GROUP BY shiftId+method,
      cash reconciliation from CashOperation DEPOSIT/WITHDRAW,
    ]

key-files:
  created:
    - src/components/reports/cash-report.tsx
  modified:
    - src/actions/reports.ts
    - src/app/(dashboard)/reports/reports-page-client.tsx

key-decisions:
  - "getCashReport uses raw SQL for payment aggregation (consistent with other report actions pattern)"
  - "Cash tab requires store selection (not 'all stores') since reconciliation is per-shift per-store"

patterns-established:
  - "CashReport component follows profit-report.tsx pattern: useTransition fetch, skeleton, error, empty, data"

requirements-completed: [REP-07]

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 10 Plan 02: Cash Report Summary

**Per-shift cash report with 5 payment method breakdown (CASH/CARD/SBP/TRANSFER/CREDIT), cash reconciliation (expected vs actual vs discrepancy), and period totals**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T19:41:43Z
- **Completed:** 2026-04-09T19:44:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- getCashReport server action returns per-shift payment breakdown with 5 methods and cash reconciliation
- CashReport component with summary strip cards, per-shift breakdown tables, and period totals
- New "Кассовый отчёт" tab integrated into reports page with store-required guard

## Task Commits

Each task was committed atomically:

1. **Task 1: getCashReport server action** - `9df6bea` (feat)
2. **Task 2: CashReport component + reports page tab** - `25381e5` (feat)

## Files Created/Modified

- `src/actions/reports.ts` - Added getCashReport with raw SQL payment aggregation and CashOperation queries
- `src/components/reports/cash-report.tsx` - New CashReport component with summary, shift cards, reconciliation display
- `src/app/(dashboard)/reports/reports-page-client.tsx` - Added CashReport import and "Кассовый отчёт" tab

## Decisions Made

- getCashReport uses raw SQL for payment aggregation (consistent with existing report actions pattern in reports.ts)
- Cash tab requires specific store selection (not "all stores") since reconciliation is per-shift per-store
- Used &mdash; entity for title separators in shift cards (proper typography)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cash report backend and UI complete
- Ready for Phase 10 plans 03/04 (banking fees, E2E tests)

---

_Phase: 10-reports-correctness-banking-fees_
_Completed: 2026-04-09_
