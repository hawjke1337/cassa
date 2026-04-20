---
phase: 15-data-integrity-hardening
plan: 05
subsystem: database
tags: [prisma, optimistic-locking, dedup, motivation, device-records, e2e]

requires:
  - phase: 15-02
    provides: VarChar limits and cascade safety on schema
  - phase: 15-03
    provides: Phone normalization and IMEI validation in repairs
provides:
  - Optimistic locking on MotivationScheme via version field
  - Formula validation before save
  - Formula snapshot on MotivationAssignment creation
  - DeviceRecord dedup by imei2 in findOrCreateDeviceRecordTx
affects: [16-ux-polish, motivation-ui]

tech-stack:
  added: []
  patterns: [optimistic-locking-via-version-field, formula-snapshot-on-assignment]

key-files:
  created:
    - src/__tests__/e2e/optimistic-lock-dedup.e2e.test.ts
  modified:
    - prisma/schema.prisma
    - src/actions/motivation-schemes.ts
    - src/actions/motivation-assignments.ts
    - src/actions/device-records.ts
    - src/app/(dashboard)/settings/motivation-schemes/[id]/editor-client.tsx

key-decisions:
  - "expectedVersion parameter is optional for backward compatibility - existing callers without version still work"
  - "DeviceRecord findOrCreateDeviceRecordTx already existed from prior work - enhanced with imei2 search and improved customerId update logic"

patterns-established:
  - "Optimistic locking: updateMany with version WHERE clause, increment on success, count=0 means conflict"
  - "Formula snapshot: store Json copy at assignment creation time, immutable afterward"

requirements-completed: [DATA2-10, DATA2-11, DATA2-12]

duration: 11min
completed: 2026-04-14
---

# Phase 15 Plan 05: Optimistic Locking, Formula Snapshot & DeviceRecord Dedup Summary

**Version-based optimistic locking on MotivationScheme with formula validation, snapshot on assignment, and imei2-enhanced DeviceRecord dedup**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-14T11:07:31Z
- **Completed:** 2026-04-14T11:18:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MotivationScheme has version field with optimistic locking - concurrent edits produce "Данные были изменены другим пользователем" error
- Formula validation prevents saving null/non-object formulas
- Formula snapshot stored immutably on MotivationAssignment at creation time
- DeviceRecord dedup enhanced with imei2 search coverage
- 8 E2E tests covering all scenarios (all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: MotivationScheme version field + optimistic locking + formula validation + snapshot** - `a71cbf9` (feat)
2. **Task 2: DeviceRecord deduplication in createRepair + E2E tests** - `e557625` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added version field to MotivationScheme, formulaSnapshot to MotivationAssignment
- `src/actions/motivation-schemes.ts` - Optimistic locking via expectedVersion, formula validation, version in getMotivationScheme
- `src/actions/motivation-assignments.ts` - Formula snapshot stored on createAssignment
- `src/actions/device-records.ts` - Enhanced findOrCreateDeviceRecordTx with imei2 search and improved customerId logic
- `src/app/(dashboard)/settings/motivation-schemes/[id]/editor-client.tsx` - Passes version to updateMotivationScheme, version in Scheme type
- `src/__tests__/e2e/optimistic-lock-dedup.e2e.test.ts` - 8 E2E tests for locking, snapshot, and dedup

## Decisions Made
- expectedVersion is optional parameter for backward compatibility - callers that don't pass it still work (version increments but no conflict check)
- findOrCreateDeviceRecordTx was already implemented in prior plans (15-03) - enhanced with imei2 search and customerId update when changed (not just when null)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan referenced src/actions/motivation.ts which does not exist**
- **Found during:** Task 1
- **Issue:** Plan referenced `motivation.ts` but actual file is `motivation-schemes.ts` and `motivation-assignments.ts`
- **Fix:** Applied changes to correct files
- **Files modified:** src/actions/motivation-schemes.ts, src/actions/motivation-assignments.ts
- **Verification:** All acceptance criteria met

**2. [Rule 3 - Blocking] Used db push instead of migrate dev due to shadow DB error**
- **Found during:** Task 1 (migration step)
- **Issue:** `prisma migrate dev` failed with P3006 shadow DB error on AuditLog table
- **Fix:** Used `prisma db push` which works without shadow DB
- **Verification:** Schema synced, prisma validate passes

**3. [Rule 1 - Bug] Fixed Customer model usage in E2E test**
- **Found during:** Task 2 (E2E test creation)
- **Issue:** Test used firstName/lastName but Customer model has single `name` field
- **Fix:** Changed to `name: "Иван Иванов"` format
- **Verification:** Test passes

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correct execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All DATA2-10/11/12 requirements complete
- Phase 15 data integrity hardening complete
- Ready for Phase 16 (Inventory Edge Cases & UX Polish)

---
*Phase: 15-data-integrity-hardening*
*Completed: 2026-04-14*
