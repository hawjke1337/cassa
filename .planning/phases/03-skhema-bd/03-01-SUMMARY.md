---
phase: 03-skhema-bd
plan: 01
subsystem: database
tags: [prisma, postgres, indexes, unique-constraints, performance]

requires:
  - phase: 02-tselostnost-dannykh
    provides: stable schema with transactions and validation
provides:
  - 25 new @@index directives for query performance on 16 tables
  - @@unique([name, parentId]) on Category preventing duplicate names per level
  - @unique on Supplier.inn ensuring INN uniqueness
  - drift-fix migration for User.permissionsVersion
affects: [03-skhema-bd, all-phases-with-queries]

tech-stack:
  added: []
  patterns: [prisma-migrate-diff-for-non-interactive, prisma-migrate-resolve-for-drift]

key-files:
  created:
    - prisma/migrations/20260405000001_add_permissions_version/migration.sql
    - prisma/migrations/20260405154800_add_indexes_and_unique_constraints/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Payment.@@index([method]) instead of @@index([type]) -- field is named method, not type (plan had incorrect field name)"
  - "Skipped @@index([customerId]) on CustomOrder and Repair -- these models use inline clientName/clientPhone, no FK to Customer"
  - "Skipped @@index([storeId, createdAt]) on Return -- model has no storeId field"
  - "Created drift-fix migration for User.permissionsVersion added in Phase 1 outside migrations"
  - "Used prisma migrate diff + deploy instead of migrate dev (non-interactive environment)"

patterns-established:
  - "Drift resolution: create migration file manually, mark as applied with prisma migrate resolve"
  - "Non-interactive migration: prisma migrate diff --script + prisma migrate deploy"

requirements-completed: [DB-01, DB-07]

duration: 5min
completed: 2026-04-05
---

# Phase 3 Plan 1: Indexes and Unique Constraints Summary

**25 database indexes for query performance + unique constraints on Category[name,parentId] and Supplier.inn with applied migration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T15:48:16Z
- **Completed:** 2026-04-05T15:53:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added 25 new @@index directives across 16 tables (Sale, SaleItem, Payment, Return, ReturnItem, StockReceive, StockTransfer, InventoryAudit, StockWriteOff, CustomOrder, OrderStatusHistory, SupplierDebt, Repair, RepairStatusHistory, MotivationAssignment, Payroll, PriceHistory)
- Added @@unique([name, parentId]) on Category and @unique on Supplier.inn
- Resolved DB drift from User.permissionsVersion and applied all migrations cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add @@index on all priority tables** - `2655dcc` (feat)
2. **Task 2: Add @@unique constraints and apply migration** - `e9fa544` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `prisma/schema.prisma` - Added 25 @@index, 1 @@unique, 1 @unique
- `prisma/migrations/20260405000001_add_permissions_version/migration.sql` - Drift fix for permissionsVersion
- `prisma/migrations/20260405154800_add_indexes_and_unique_constraints/migration.sql` - All new indexes and unique constraints

## Decisions Made
- Payment field is `method` (PaymentMethod enum), not `type` -- plan incorrectly specified @@index([type]), corrected to @@index([method])
- CustomOrder and Repair don't have `customerId` FK (use inline client fields) -- skipped those indexes
- Return model has no `storeId` field -- skipped @@index([storeId, createdAt]) for Return
- Used prisma migrate diff + deploy workflow to bypass non-interactive environment limitation
- Created separate drift-fix migration for User.permissionsVersion before main migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Payment index field name from type to method**
- **Found during:** Task 1 (Adding indexes)
- **Issue:** Plan specified @@index([type]) but Payment model uses `method` field (PaymentMethod enum), not `type`
- **Fix:** Used @@index([method]) instead
- **Files modified:** prisma/schema.prisma
- **Verification:** npx prisma validate passes
- **Committed in:** 2655dcc (Task 1 commit)

**2. [Rule 1 - Bug] Skipped non-existent customerId index on CustomOrder and Repair**
- **Found during:** Task 1 (Adding indexes)
- **Issue:** Plan specified @@index([customerId]) for CustomOrder and Repair, but these models use inline clientName/clientPhone fields, not a Customer FK
- **Fix:** Skipped these indexes (cannot index non-existent field)
- **Files modified:** N/A
- **Verification:** Schema structure confirmed by reading model definitions
- **Committed in:** 2655dcc (Task 1 commit)

**3. [Rule 1 - Bug] Skipped non-existent storeId index on Return**
- **Found during:** Task 1 (Adding indexes)
- **Issue:** Plan specified @@index([storeId, createdAt]) for Return, but Return has no storeId field
- **Fix:** Skipped this index
- **Files modified:** N/A
- **Verification:** Schema structure confirmed
- **Committed in:** 2655dcc (Task 1 commit)

**4. [Rule 3 - Blocking] Resolved DB drift before migration**
- **Found during:** Task 2 (Applying migration)
- **Issue:** prisma migrate dev blocked by drift: User.permissionsVersion column exists in DB but not in migration history
- **Fix:** Created drift-fix migration (20260405000001) and marked as applied via prisma migrate resolve
- **Files modified:** prisma/migrations/20260405000001_add_permissions_version/migration.sql
- **Verification:** prisma migrate status shows all migrations applied
- **Committed in:** e9fa544 (Task 2 commit)

**5. [Rule 3 - Blocking] Non-interactive environment workaround**
- **Found during:** Task 2 (Applying migration)
- **Issue:** prisma migrate dev fails in non-interactive environment (Claude Code sandbox)
- **Fix:** Used prisma migrate diff --script to generate SQL, created migration file manually, applied with prisma migrate deploy
- **Files modified:** prisma/migrations/20260405154800_add_indexes_and_unique_constraints/migration.sql
- **Verification:** prisma migrate deploy + prisma migrate status confirm success
- **Committed in:** e9fa544 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (3 bug fixes in plan, 2 blocking issues)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Final index count 40 (vs 40+ target). 25 new indexes added (vs 28 planned -- 3 skipped due to non-existent fields).

## Issues Encountered
- DB schema drift from Phase 1 (permissionsVersion added outside migrations) -- resolved with drift-fix migration
- Non-interactive environment blocks prisma migrate dev -- resolved with diff + deploy workflow

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All priority indexes in place for query performance (DB-01)
- Unique constraints prevent data duplicates (DB-07)
- Ready for Plan 02 (onDelete rules) and Plan 03 (soft delete, updatedAt, CHECK constraints)

---
*Phase: 03-skhema-bd*
*Completed: 2026-04-05*
