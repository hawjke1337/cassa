---
phase: 06-ux
plan: 03
subsystem: ui
tags: [dashboard, breadcrumbs, formatting, shadcn, profit, metrics]

requires:
  - phase: 06-ux-02
    provides: shadcn Select pattern, POS improvements
provides:
  - Dashboard profit/margin cards with COGS SQL query
  - Ready repairs count card with navigation link
  - formatDuration utility for Xч Yм time formatting
  - Breadcrumbs for all 15 routes
  - Toast error handling on dashboard load
  - shadcn Select in trade-in-detail
affects: []

tech-stack:
  added: []
  patterns: [inline COGS SQL in dashboard action, StatCard description/valueClassName props]

key-files:
  created:
    - src/__tests__/format-duration.test.ts
    - src/__tests__/dashboard-metrics.test.ts
  modified:
    - src/lib/format.ts
    - src/components/dashboard/dashboard-content.tsx
    - src/components/dashboard/stat-card.tsx
    - src/actions/dashboard.ts
    - src/components/layout/header.tsx
    - src/app/(dashboard)/shifts/[id]/shift-detail-client.tsx
    - src/app/(dashboard)/trade-in/[id]/trade-in-detail-client.tsx

key-decisions:
  - "Inline COGS SQL in getDashboardData instead of calling getProfitReport -- avoids reports.profit permission requirement for dashboard"
  - "StatCard extended with description and valueClassName props for flexible display"

patterns-established:
  - "formatDuration for human-readable duration display across the app"
  - "Dashboard profit via inline SQL COGS query -- no permission dependency on reports module"

requirements-completed: [UX-10, UX-11, UX-12, UX-13, UX-14, UX-15]

duration: 5min
completed: 2026-04-06
---

# Phase 6 Plan 3: Dashboard & Navigation Summary

**Dashboard profit/margin with COGS SQL, ready repairs card, breadcrumbs for 15 routes, formatDuration utility, toast errors, shadcn Select**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T15:09:35Z
- **Completed:** 2026-04-06T15:14:27Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Dashboard shows today's profit with margin percentage, color-coded (green/red)
- Ready repairs count displayed with navigation to /repairs?status=READY
- Breadcrumbs cover all 15 routes including customers, repairs, shifts, trade-in, warranty, motivation, profile
- Shift duration displayed as "Xч Yм" instead of "N мин"
- Dashboard errors shown via toast instead of silently swallowed
- Native select replaced with shadcn Select in trade-in detail
- 9 new tests (5 formatDuration + 4 dashboard-metrics margin)

## Task Commits

Each task was committed atomically:

1. **Task 1: formatDuration + dashboard-metrics tests + breadcrumbs + native select** - `e41b066` (feat)
2. **Task 2: Dashboard profit/margin, ready repairs, toast errors, shift duration** - `97fb770` (feat)

_Note: Task 1 was TDD (RED -> GREEN in single commit since formatDuration is a pure function)_

## Files Created/Modified

- `src/lib/format.ts` - Added formatDuration utility
- `src/__tests__/format-duration.test.ts` - 5 test cases for formatDuration
- `src/__tests__/dashboard-metrics.test.ts` - 4 test cases for margin calculation
- `src/components/layout/header.tsx` - Extended pageTitles with 7 new routes
- `src/app/(dashboard)/trade-in/[id]/trade-in-detail-client.tsx` - shadcn Select instead of native
- `src/actions/dashboard.ts` - Added COGS SQL query, profit/margin in response
- `src/components/dashboard/dashboard-content.tsx` - Profit card, ready repairs card, toast error, 4+3 grid layout
- `src/components/dashboard/stat-card.tsx` - Added description and valueClassName props
- `src/app/(dashboard)/shifts/[id]/shift-detail-client.tsx` - formatDuration for shift time

## Decisions Made

- Used inline COGS SQL in getDashboardData instead of calling getProfitReport to avoid reports.profit permission requirement
- Extended StatCard with description and valueClassName props rather than creating a separate ProfitCard component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Select onValueChange type mismatch**

- **Found during:** Task 1 (native select replacement)
- **Issue:** base-ui Select onValueChange passes `string | null`, not `string` -- TypeScript error
- **Fix:** Wrapped handler: `(v) => setCategoryId(v ?? "")`
- **Files modified:** src/app/(dashboard)/trade-in/[id]/trade-in-detail-client.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** e41b066 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary type fix for base-ui Select API. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 (UX) complete -- all 3 plans executed
- All 6 phases of v1.0 milestone complete (17/17 plans)

---

_Phase: 06-ux_
_Completed: 2026-04-06_
