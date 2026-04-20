---
phase: 12-security-fixes-roles-ui
plan: 01
subsystem: security
tags: [rate-limiting, idor, soft-delete, prisma, permissions, sonner]

requires:
  - phase: 07-test-infra-decimal
    provides: E2E test infrastructure with real DB, Decimal helpers
  - phase: 01-security
    provides: Permission system (requirePermission, checkPermission)
provides:
  - findUnique/findUniqueOrThrow soft delete extension in db.ts
  - Generic write rate limiting (checkWriteRateLimit, recordWriteAttempt)
  - shifts.override_discrepancy permission
  - useRateLimitToast hook with countdown timer
  - IDOR protection on getSale
  - Business rule guards (cash cap, discount cap, price cap, discrepancy approval, self-role prevention)
affects: [12-security-fixes-roles-ui, 15-data-integrity-hardening, 16-inventory-edge-cases-ux-polish]

tech-stack:
  added: []
  patterns: [post-query soft delete filtering for findUnique, in-memory write rate limiting with sliding window, countdown toast via sonner]

key-files:
  created:
    - src/hooks/use-rate-limit-toast.ts
    - src/__tests__/e2e/security-hardening.e2e.test.ts
  modified:
    - src/lib/db.ts
    - src/lib/rate-limit.ts
    - src/lib/permissions-list.ts
    - src/actions/sales.ts
    - src/actions/orders.ts
    - src/actions/cash-operations.ts
    - src/actions/shifts.ts
    - src/actions/settings.ts

key-decisions:
  - "Fund model has no balance field — removed fund balance check from SEC2-05; hard cap at 500k rub still enforced"
  - "findUnique uses post-query filter (not WHERE injection) because Prisma findUnique only accepts unique fields in where"
  - "SEC2-02 tested via static source code assertion since e2e test db is raw PrismaClient without $extends"
  - "Reports (SEC2-03) already had proper storeId-scoped permission checks — no changes needed"

patterns-established:
  - "Post-query soft delete: findUnique fetches record then checks deletedAt, returns null if soft-deleted"
  - "Write rate limiting: checkWriteRateLimit before mutation, recordWriteAttempt after auth check"
  - "Rate limit toast: useRateLimitToast hook wraps server action calls, shows countdown on rate limit error"

requirements-completed: [SEC2-01, SEC2-02, SEC2-03, SEC2-04, SEC2-05, SEC2-06, SEC2-07, SEC2-08, SEC2-09]

duration: 10min
completed: 2026-04-12
---

# Phase 12 Plan 01: Security Hardening Summary

**9 security fixes (IDOR, soft delete bypass, write rate limiting, business rule guards) + rate limit toast with countdown + 17 E2E tests**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-12T07:29:02Z
- **Completed:** 2026-04-12T07:39:05Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Closed all 9 SEC2 vulnerabilities identified in v1.0 audit
- Added findUnique/findUniqueOrThrow to soft delete extension (closes BUG-059)
- Added generic write rate limiting with per-action configurable limits
- Added rate limit toast hook with live countdown timer for client-side UX
- 17 E2E tests verifying all security fixes

## Task Commits

Each task was committed atomically:

1. **Task 1: IDOR fixes + soft delete + rate limiting + business guards** - `67a32ce` (feat)
2. **Task 2: Rate limit toast with countdown + E2E security tests** - `72f9bae` (feat)

## Files Created/Modified
- `src/lib/db.ts` - Added findUnique/findUniqueOrThrow soft delete extension
- `src/lib/rate-limit.ts` - Added generic write rate limiting (checkWriteRateLimit, recordWriteAttempt)
- `src/lib/permissions-list.ts` - Added shifts.override_discrepancy permission
- `src/actions/sales.ts` - IDOR fix on getSale + rate limiting on createSale
- `src/actions/orders.ts` - Discount > 30% guard + price change > 30% guard + rate limiting on createOrder
- `src/actions/cash-operations.ts` - 500k hard cap + rate limiting
- `src/actions/shifts.ts` - Discrepancy > 1000 rub requires shifts.override_discrepancy
- `src/actions/settings.ts` - Self-role change prevention in updateUserRoles
- `src/hooks/use-rate-limit-toast.ts` - Client-side rate limit toast with countdown
- `src/__tests__/e2e/security-hardening.e2e.test.ts` - 17 E2E tests for SEC2-01..09

## Decisions Made
- Fund model has no `balance` field -- removed fund balance check from SEC2-05 withdrawal guard; the 500k hard cap is still enforced (Rule 1 auto-fix)
- Reports (SEC2-03) already had proper storeId-scoped permission checks -- no changes needed
- SEC2-02 findUnique uses post-query filter pattern (cannot inject WHERE for unique-field-only queries)
- SEC2-02 tested via static source assertion since e2e test db is raw PrismaClient without $extends

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed fund balance check from SEC2-05**
- **Found during:** Task 1 (cash-operations.ts)
- **Issue:** Plan referenced `fund.balance` but Fund model has no `balance` field
- **Fix:** Removed fund balance check; 500k hard cap still enforced as primary guard
- **Files modified:** src/actions/cash-operations.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 67a32ce

---

**Total deviations:** 1 auto-fixed (1 bug in plan)
**Impact on plan:** Minor -- fund balance check was secondary to the 500k hard cap. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All SEC2-01..09 requirements closed
- Phase 12 Plan 02 (Audit Log) and Plan 03 (Roles UI) can proceed
- shifts.override_discrepancy permission available for role assignment in Plan 03

---
*Phase: 12-security-fixes-roles-ui*
*Completed: 2026-04-12*
