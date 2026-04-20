---
phase: 01-security
plan: 02
subsystem: auth
tags: [jwt, rate-limit, bcryptjs, next-auth, prisma, permissions]

# Dependency graph
requires:
  - phase: 01-security/01
    provides: vitest config, test stubs, sales validation schema
provides:
  - "In-memory rate limiter (5 attempts / 15 min lockout)"
  - "Version-based JWT permission reload (permissionsVersion field)"
  - "writeSerialHistory extracted from server actions to internal helper"
  - "Password minimum length hardened to 8 characters"
  - "Session maxAge: 900 (15 min JWT expiry)"
affects: [01-security/03, auth, serial-units, settings]

# Tech tracking
tech-stack:
  added: []
  patterns: [version-based-permission-invalidation, in-memory-rate-limiting]

key-files:
  created:
    - src/lib/rate-limit.ts
    - src/lib/serial-history.ts
    - src/__tests__/auth-jwt.test.ts
  modified:
    - prisma/schema.prisma
    - src/lib/auth.ts
    - src/lib/auth.config.ts
    - src/actions/serial-units.ts
    - src/actions/settings.ts
    - src/__tests__/rate-limit.test.ts
    - src/__tests__/password-validation.test.ts

key-decisions:
  - "In-memory rate limiting (Map) sufficient for single-instance ePRM deployment"
  - "permissionsVersion increment on role change and deactivation for immediate JWT invalidation"
  - "writeSerialHistory moved to src/lib/ without 'use server' to prevent server action exposure"

patterns-established:
  - "Version-based permission invalidation: increment permissionsVersion on any permission-affecting change"
  - "Internal helpers in src/lib/ (not src/actions/) to avoid server action exposure"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 1 Plan 2: Auth Hardening Summary

**JWT version-based permission reload, brute-force rate limiting (5/15min), 8-char password minimum, writeSerialHistory extracted from server actions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T10:30:10Z
- **Completed:** 2026-04-05T10:35:40Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- JWT callback reloads permissions on every request when permissionsVersion changes (AUTH-01)
- Rate limiting blocks login after 5 failed attempts for 15 minutes, per username (AUTH-02)
- Password minimum length hardened from 4 to 8 characters in createUser, resetUserPassword, changePassword (AUTH-03)
- writeSerialHistory extracted to src/lib/serial-history.ts as internal helper, no longer exposed as server action (AUTH-04)
- Deactivated users get empty permissions on next JWT refresh
- Session maxAge set to 900 seconds (15 minutes)
- All 17 tests green, TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + rate-limit + serial-history + password hardening** - `8d4ea19` (feat)
2. **Task 2: JWT callback with permission reload + rate limiting in authorize** - `b387dbb` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added permissionsVersion Int @default(1) to User model
- `src/lib/rate-limit.ts` - In-memory rate limiter: checkRateLimit, recordFailedAttempt, clearAttempts
- `src/lib/serial-history.ts` - writeSerialHistory extracted from server actions (no "use server")
- `src/lib/auth.ts` - Rate limiting in authorize, version-based permission reload in JWT callback
- `src/lib/auth.config.ts` - Added maxAge: 900 to session config
- `src/actions/serial-units.ts` - Imports writeSerialHistory from lib instead of exporting it
- `src/actions/settings.ts` - Password length 4->8, permissionsVersion increment on toggle/role change
- `src/__tests__/rate-limit.test.ts` - 5 tests for rate limiting logic
- `src/__tests__/password-validation.test.ts` - 3 tests for password validation
- `src/__tests__/auth-jwt.test.ts` - 3 tests for version-based permission reload concept

## Decisions Made
- In-memory rate limiting (Map) is sufficient for single-instance ePRM deployment; no Redis needed
- permissionsVersion field enables immediate permission invalidation without session store
- writeSerialHistory moved to src/lib/ to prevent unintended server action exposure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regeneration required**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** After adding permissionsVersion to schema, Prisma types were stale -- TypeScript could not find permissionsVersion on User type
- **Fix:** Ran `npx prisma generate` to regenerate client types
- **Files modified:** src/generated/prisma/ (auto-generated)
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** b387dbb (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TS2367 in auth-jwt test**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Vitest test comparing literal number types caused TS2367 "comparison appears unintentional"
- **Fix:** Added explicit `: number` type annotations to test variables
- **Files modified:** src/__tests__/auth-jwt.test.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** b387dbb (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth hardening complete, ready for Plan 03 (permission enforcement middleware)
- permissionsVersion infrastructure enables immediate role/access revocation
- Rate limiting protects login endpoint from brute force

---
*Phase: 01-security*
*Completed: 2026-04-05*
