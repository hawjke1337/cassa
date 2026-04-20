---
phase: 01-security
plan: 03
subsystem: auth
tags: [permissions, store-scope, rbac, payroll, server-actions]

# Dependency graph
requires:
  - phase: 01-security/01-01
    provides: requirePermission function with storeId support
  - phase: 01-security/01-02
    provides: JWT permission reload, auth hardening
provides:
  - Store-scoped permission checks in all server actions (trade-in, reports, shifts)
  - Granular payroll permissions (manage/confirm/pay split)
  - Permission checks in getDocumentData for RECEIVE_DOC and WRITE_OFF_DOC
  - 13 regression tests verifying PERM-01..PERM-05
affects: [motivation, reports, trade-in, shifts, document-templates]

# Tech tracking
tech-stack:
  added: []
  patterns: [store-scoped-permissions, permission-per-operation, static-analysis-tests]

key-files:
  created:
    - src/__tests__/permissions-store-scope.test.ts
  modified:
    - src/lib/permissions-list.ts
    - src/actions/trade-in.ts
    - src/actions/reports.ts
    - src/actions/motivation-payroll.ts
    - src/actions/shifts.ts
    - src/actions/document-templates.ts

key-decisions:
  - "Static analysis tests (readFileSync + regex) for permission verification -- lightweight, no mocking needed"
  - "Reports without storeId require reports.full -- prevents cross-store data leaks for non-owners"
  - "checkOpenShift also gets shifts.view check -- consistency with getCurrentShift"

patterns-established:
  - "Pattern: load entity first, then requirePermission with entity.storeId -- for actions taking only id parameter"
  - "Pattern: if (storeId) requirePermission(specific, storeId) else requirePermission(reports.full) -- for optional store scope"

requirements-completed: [PERM-01, PERM-02, PERM-03, PERM-04, PERM-05]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 1 Plan 3: Store-Scoped Permissions Summary

**Store-scoped requirePermission in all server actions + granular payroll permissions (manage/confirm/pay) + getDocumentData access control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T10:38:24Z
- **Completed:** 2026-04-05T10:43:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All trade-in actions (9 requirePermission calls) now pass storeId -- seller in store A cannot operate on store B trade-ins
- Reports check storeId when provided, require reports.full for cross-store queries
- Payroll permissions split: view (read-only), manage (generate/delete), confirm, pay
- getDocumentData checks inventory.receive for RECEIVE_DOC and inventory.writeoff for WRITE_OFF_DOC
- getCurrentShift and checkOpenShift now require shifts.view with storeId
- 13 static analysis tests verify all PERM-01..PERM-05 patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Payroll permissions + store-scoped checks in trade-in, reports, shifts** - `38e3be1` (feat)
2. **Task 2: Permission check in getDocumentData + tests** - `2f75407` (feat)

## Files Created/Modified
- `src/lib/permissions-list.ts` - Added MOTIVATION_PAYROLL_MANAGE, CONFIRM, PAY permission codes
- `src/actions/trade-in.ts` - All 9 requirePermission calls now include storeId
- `src/actions/reports.ts` - Store-scoped checks in getSalesReport, getProfitReport, getInventoryReport, getSellerReport, getFundReport
- `src/actions/motivation-payroll.ts` - Split permissions: manage, confirm, pay
- `src/actions/shifts.ts` - Added requirePermission("shifts.view", storeId) to getCurrentShift and checkOpenShift
- `src/actions/document-templates.ts` - Permission checks for RECEIVE_DOC and WRITE_OFF_DOC in getDocumentData
- `src/__tests__/permissions-store-scope.test.ts` - 13 static analysis tests for PERM-01..PERM-05

## Decisions Made
- Static analysis tests (readFileSync + regex matching) instead of runtime mocking -- lightweight, fast, verifies code patterns directly
- Reports without storeId require reports.full instead of no check -- prevents cross-store data leaks
- checkOpenShift also gets shifts.view check for consistency with getCurrentShift
- For trade-in actions that take only id: load entity first to get storeId, then check permission before proceeding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added permission check to checkOpenShift**
- **Found during:** Task 1 (shifts.ts review)
- **Issue:** checkOpenShift(storeId) had no permission check, similar to getCurrentShift
- **Fix:** Added `await requirePermission("shifts.view", storeId)` 
- **Files modified:** src/actions/shifts.ts
- **Verification:** Test confirms pattern exists
- **Committed in:** 38e3be1

**2. [Rule 2 - Missing Critical] Added reports.full fallback for getFundReport**
- **Found during:** Task 1 (reports.ts review)
- **Issue:** getFundReport used shifts.view_all without store scope, cross-store access unchecked
- **Fix:** Added store-scoped check with reports.full fallback for all-stores case
- **Files modified:** src/actions/reports.ts
- **Verification:** grep confirms pattern
- **Committed in:** 38e3be1

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for security completeness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Security) complete -- all 3 plans executed
- All server actions now have proper permission checks with store scoping
- 30 tests total across 5 test files -- all passing
- Ready to proceed to Phase 2

---
*Phase: 01-security*
*Completed: 2026-04-05*
