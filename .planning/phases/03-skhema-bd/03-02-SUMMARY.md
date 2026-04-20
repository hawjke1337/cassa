---
phase: 03-skhema-bd
plan: 02
subsystem: database
tags: [prisma, postgresql, ondelete, soft-delete, fk-constraints, updatedAt]

# Dependency graph
requires:
  - phase: 03-skhema-bd/03-01
    provides: "Indexes and unique constraints on all tables"
provides:
  - "107 onDelete rules on all FK relationships (Cascade/Restrict/SetNull)"
  - "PriceHistory FK to Store and User"
  - "Soft delete (deletedAt) on Product, Supplier, Customer, Store, User"
  - "$extends soft delete auto-filtering in db.ts"
  - "updatedAt @updatedAt on all 51 models"
affects: [03-skhema-bd/03-03, server-actions, api-layer]

# Tech tracking
tech-stack:
  added: []
  patterns: ["$extends for query interception", "soft delete with deletedAt + auto-filter", "DEFAULT NOW() then DROP DEFAULT for migration of required columns"]

key-files:
  created:
    - "prisma/migrations/20260405160343_add_on_delete_soft_delete_updated_at/migration.sql"
  modified:
    - "prisma/schema.prisma"
    - "src/lib/db.ts"

key-decisions:
  - "onDelete Cascade for child items (SaleItem->Sale), Restrict for references (Product->Category), SetNull for optional refs (Sale->Shift)"
  - "Soft delete only on 5 reference models (Product, Supplier, Customer, Store, User) -- not on transactional tables"
  - "$extends findMany/findFirst/findFirstOrThrow/count but NOT findUnique -- explicit ID lookups can check deletedAt manually"
  - "DEFAULT NOW() then DROP DEFAULT pattern for adding required updatedAt to existing rows"

patterns-established:
  - "SOFT_DELETE_MODELS const in db.ts -- single source of truth for soft-deleted models"
  - "User where overrides default filter: { deletedAt: { not: null } } for admin access to deleted records"
  - "ReturnType<typeof createPrismaClient> for proper $extends typing"

requirements-completed: [DB-02, DB-03, DB-04, DB-05]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 3 Plan 2: FK Integrity, Soft Delete, and Audit Timestamps Summary

**107 onDelete rules on all FK, PriceHistory FK to Store/User, soft delete with $extends auto-filtering on 5 models, updatedAt on all 51 models**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T15:57:23Z
- **Completed:** 2026-04-05T16:05:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 107 onDelete rules (Cascade/Restrict/SetNull) covering all FK relationships in schema -- DB integrity enforced at DBMS level
- PriceHistory now has proper FK to Store and User (was plain String fields)
- Soft delete (deletedAt) on Product, Supplier, Customer, Store, User with $extends auto-filtering
- updatedAt @updatedAt on all 51 models for change audit trail

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onDelete rules, PriceHistory FK, deletedAt, updatedAt in schema** - `a5a2255` (feat)
2. **Task 2: Add $extends soft delete filtering in db.ts** - `c130862` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - 107 onDelete rules, PriceHistory FK, 5x deletedAt, 35x updatedAt added
- `src/lib/db.ts` - $extends soft delete auto-filtering for findMany/findFirst/findFirstOrThrow/count
- `prisma/migrations/20260405160343_add_on_delete_soft_delete_updated_at/migration.sql` - Migration with DEFAULT NOW() pattern

## Decisions Made
- onDelete Cascade for child/line-item relations, Restrict for business references, SetNull for optional links
- Soft delete only on 5 reference tables (not transactional) -- per CONTEXT.md decision
- findUnique NOT filtered by soft delete -- explicit ID lookups check deletedAt manually
- DEFAULT NOW() then DROP DEFAULT for adding required updatedAt to tables with existing data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration required DEFAULT NOW() for updatedAt columns**
- **Found during:** Task 1 (schema migration)
- **Issue:** Prisma migrate dev rejected adding NOT NULL updatedAt to tables with existing rows
- **Fix:** Used --create-only, manually edited migration to ADD COLUMN with DEFAULT NOW() then ALTER COLUMN DROP DEFAULT
- **Files modified:** prisma/migrations/20260405160343.../migration.sql
- **Verification:** prisma migrate dev applied successfully, migrate status shows all migrations applied
- **Committed in:** a5a2255 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard migration pattern for adding required columns to populated tables. No scope creep.

## Issues Encountered
None beyond the expected migration default value issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All FK constraints enforced, soft delete operational, audit timestamps in place
- Ready for 03-03 (seed data / final schema verification)
- All server actions importing { db } from '@/lib/db' now automatically filter soft-deleted records

---
*Phase: 03-skhema-bd*
*Completed: 2026-04-05*
