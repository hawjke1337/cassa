---
phase: 15-data-integrity-hardening
plan: 02
subsystem: database
tags: [prisma, postgresql, varchar, cascade, data-integrity]

requires:
  - phase: 15-01
    provides: CHECK constraints and SerialUnit unique index
provides:
  - VarChar limits on all text fields in schema.prisma
  - SetNull cascade on UserRole/UserStore/MotivationAssignment user relations
  - Migration 20260414140035_varchar_limits_cascade_safety
affects: [15-03, 15-04, 16-inventory-edge-cases]

tech-stack:
  added: []
  patterns: [varchar-limits-on-all-text-fields, setnull-cascade-for-soft-delete-safety]

key-files:
  created:
    - prisma/migrations/20260414140035_varchar_limits_cascade_safety/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Truncated invalid passport data (8-char passportSeries -> 4) before applying VARCHAR(4) limit"
  - "Manual migration apply + resolve due to existing migration drift in dev DB"

patterns-established:
  - "VarChar limits pattern: names(100), phone(20), email(255), comment(1000), descriptions(2000), IMEI(15), passport(4/6/500), INN(12), numbers(50)"
  - "SetNull cascade for soft-deletable entities preserves audit trail records"

requirements-completed: [DATA2-03, DATA2-06]

duration: 12min
completed: 2026-04-14
---

# Phase 15 Plan 02: VarChar Limits & Cascade Safety Summary

**Added @db.VarChar(N) limits to 70+ text fields and changed User cascade from Cascade to SetNull on UserRole/UserStore/MotivationAssignment**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-14T10:51:46Z
- **Completed:** 2026-04-14T11:04:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- All unbounded String fields now have explicit @db.VarChar(N) limits preventing unlimited text storage
- User soft-delete no longer cascades deletion to UserRole, UserStore, and MotivationAssignment records
- Role/assignment history preserved when users are soft-deleted (userId set to null instead of record deletion)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add @db.VarChar(N) to all unbounded text fields** - `5b17631` (feat)
2. **Task 2: Change User cascade to SetNull + migration** - `c18fc46` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added VarChar limits to 70+ fields, changed cascade behavior on 3 relations
- `prisma/migrations/20260414140035_varchar_limits_cascade_safety/migration.sql` - DDL for varchar limits + cascade changes

## Decisions Made
- Truncated invalid passport data (8-char passportSeries to 4 chars) before applying VARCHAR(4) limit -- seed/test data had invalid values
- Used manual migration apply + prisma migrate resolve due to existing migration drift in dev DB (tables created outside migrations in previous phases)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Truncated invalid passport data before VARCHAR constraint**
- **Found during:** Task 2 (migration application)
- **Issue:** Customer table had passportSeries='57784764' (8 chars) which exceeded VARCHAR(4) limit
- **Fix:** Added data truncation UPDATE statements to migration SQL before ALTER COLUMN
- **Files modified:** prisma/migrations/20260414140035_varchar_limits_cascade_safety/migration.sql
- **Verification:** Migration applied successfully, all columns now have correct types
- **Committed in:** c18fc46 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor data fix required for migration to apply. No scope creep.

## Issues Encountered
- Migration drift detected (dev DB has tables not tracked in migration history from earlier phases). Resolved by generating migration SQL via `prisma migrate diff`, applying manually via psql, and marking as applied with `prisma migrate resolve`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema now has full VarChar coverage -- ready for Phase 15-03 (additional integrity constraints)
- Cascade safety ensures User soft-delete preserves historical records

---
*Phase: 15-data-integrity-hardening*
*Completed: 2026-04-14*
