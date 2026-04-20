---
phase: 14-payroll-employee-dashboard
plan: 03
subsystem: ui
tags: [react, tailwind, accordion, payroll, motivation, shifts]

requires:
  - phase: 14-01
    provides: per-item order commission fix
  - phase: 14-02
    provides: shift data in SaleCommission + getMyPayrolls server action

provides:
  - Shift-grouped EarningsBreakdown with two-level accordion (shift -> sales -> items)
  - PayrollHistory table with status badges, type labels, PDF download
  - Full integration into /my/motivation employee dashboard page

affects: [16-ux-polish]

tech-stack:
  added: []
  patterns: [shift-grouped accordion, payroll history table with expandable rows]

key-files:
  created:
    - src/components/motivation/payroll-history.tsx
  modified:
    - src/components/motivation/earnings-breakdown.tsx
    - src/app/(dashboard)/my/motivation/my-motivation-client.tsx

key-decisions:
  - "Two-level accordion for commissions: Level 1 = shift, Level 2 = individual sales with item tables"
  - "PayrollHistory uses HTML table with Tailwind (consistent with app patterns, not shadcn Table)"

patterns-established:
  - "Shift grouping pattern: groupByShift() helper with ShiftGroup interface, null-shift as 'Vne smen'"
  - "Payroll record expansion: click row to show summary breakdown inline"

requirements-completed: [PAYROLL-04, PAYROLL-03]

duration: 5min
completed: 2026-04-13
---

# Phase 14 Plan 03: Shift-grouped Employee Dashboard UI Summary

**Shift-grouped commission breakdown accordion + payroll history table with PDF download integrated into /my/motivation page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-13T21:26:09Z
- **Completed:** 2026-04-13T21:45:30Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- EarningsBreakdown now groups commissions by shift with collapsible accordion sections (shift date, sales count, total)
- PayrollHistory component renders payroll records table with period, type (Advance/Total), amount, status badges, and PDF download
- Employee dashboard page loads payroll history via getMyPayrolls and provides inline PDF generation
- Visual verification approved by user

## Task Commits

Each task was committed atomically:

1. **Task 1: Shift-grouped EarningsBreakdown + PayrollHistory component** - `9fcf0ee` (feat)
2. **Task 2: Integrate PayrollHistory + shift breakdown into /my/motivation page** - `7d5b7b9` (feat)
3. **Task 3: Visual verification** - checkpoint:human-verify (approved, no commit)

## Files Created/Modified
- `src/components/motivation/payroll-history.tsx` - PayrollHistory table component with status badges, type labels, expandable rows, PDF download button
- `src/components/motivation/earnings-breakdown.tsx` - Added shift grouping with groupByShift() helper, two-level accordion (shift -> sales -> items), "Vne smen" fallback
- `src/app/(dashboard)/my/motivation/my-motivation-client.tsx` - Integrated PayrollHistory, added getMyPayrolls loading, handleDownloadPdf handler

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 (Payroll & Employee Dashboard) is now complete: all 3 plans delivered
- PAYROLL-01 through PAYROLL-06 covered (PAYROLL-02 co-seller deferred by user decision)
- Ready for Phase 15 (Data Integrity Hardening)

---
*Phase: 14-payroll-employee-dashboard*
*Completed: 2026-04-13*

## Self-Check: PASSED
- All 3 source files confirmed present on disk
- Both task commits (9fcf0ee, 7d5b7b9) verified in git log
