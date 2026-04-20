---
phase: 12-security-fixes-roles-ui
plan: 03
subsystem: ui
tags: [roles, permissions, rbac, soft-delete, audit, shadcn]

requires:
  - phase: 12-01
    provides: rate limiting, audit logging infrastructure
  - phase: 12-02
    provides: InlineAuditHistory component, createAuditEntry helper
provides:
  - Roles CRUD UI with permission matrix on /settings/roles
  - Role detail page with inline audit history
  - Soft delete UI for customers with archive visual
  - Soft delete UI for stores with stock/shift/order guards
  - 13 E2E tests covering ROLE-01..05
affects: [14-payroll, 16-ux-polish]

tech-stack:
  added: []
  patterns: [permission-matrix-by-module, soft-delete-raw-sql-bypass, archive-visual-with-restore]

key-files:
  created:
    - src/actions/roles.ts
    - src/components/settings/permission-matrix.tsx
    - src/components/settings/role-form.tsx
    - src/components/settings/role-table.tsx
    - src/app/(dashboard)/settings/roles/page.tsx
    - src/app/(dashboard)/settings/roles/[id]/page.tsx
    - src/__tests__/e2e/roles-soft-delete.e2e.test.ts
  modified:
    - src/actions/customers.ts
    - src/actions/settings.ts
    - src/app/(dashboard)/settings/users/[id]/page.tsx
    - src/app/(dashboard)/customers/customers-page-client.tsx
    - src/app/(dashboard)/settings/stores/stores-page-client.tsx
    - src/components/settings/settings-nav.tsx

key-decisions:
  - "Raw SQL for getCustomers/getStores to bypass soft delete extension and show all entities including archived"
  - "Store soft delete guards: stock > 0, open shifts, active orders -- all must pass before deletion"
  - "E2E tests use Prisma ORM update for soft delete instead of $executeRawUnsafe (test db proxy doesn't intercept $executeRawUnsafe)"

patterns-established:
  - "Permission matrix by module: group permissions by module with select-all toggles per module"
  - "Archive visual pattern: opacity-50 row + Badge Архивирован + Restore button"
  - "Raw SQL bypass for soft delete lists: $queryRawUnsafe to include deletedAt IS NOT NULL records"

requirements-completed: [ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05]

duration: 14min
completed: 2026-04-12
---

# Phase 12 Plan 03: Roles CRUD UI + Soft Delete Summary

**Roles CRUD with permission matrix by module, user role assignment, customer/store soft delete UI with archive visualization and E2E tests**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-12T07:45:12Z
- **Completed:** 2026-04-12T07:59:38Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Full roles CRUD on /settings/roles with create/edit dialog containing permission matrix grouped by 15 modules with per-module "select all" toggles
- Role detail page (/settings/roles/[id]) showing permissions read-only and inline audit history
- Inline audit history added to user detail page (/settings/users/[id])
- Customer soft delete with archive badge, grayed-out display, and restore button on /customers
- Store soft delete with guards (stock > 0, open shifts, active orders) and restore on /settings/stores
- 13 E2E tests covering all 5 ROLE requirements

## Task Commits

Each task was committed atomically:

1. **Task 1: Roles CRUD server actions + UI + inline audit history** - `dbf8a3e` (feat)
2. **Task 2: Soft delete UI + E2E tests** - `e9a4efe` (feat)

## Files Created/Modified
- `src/actions/roles.ts` - CRUD server actions for roles with audit logging and rate limiting
- `src/components/settings/permission-matrix.tsx` - Checkbox matrix by module with select-all toggles
- `src/components/settings/role-form.tsx` - Create/Edit role dialog with permission matrix
- `src/components/settings/role-table.tsx` - Roles list table with edit/delete actions
- `src/app/(dashboard)/settings/roles/page.tsx` - Roles management page
- `src/app/(dashboard)/settings/roles/[id]/page.tsx` - Role detail with inline audit history
- `src/app/(dashboard)/settings/users/[id]/page.tsx` - Added InlineAuditHistory component
- `src/actions/customers.ts` - Added softDeleteCustomer/restoreCustomer, updated getCustomers with raw SQL
- `src/actions/settings.ts` - Added softDeleteStore/restoreStore with guards, updated getStores with raw SQL
- `src/app/(dashboard)/customers/customers-page-client.tsx` - Delete/restore buttons, archive visual
- `src/app/(dashboard)/settings/stores/stores-page-client.tsx` - Delete/restore buttons, archive visual
- `src/components/settings/settings-nav.tsx` - Added Roles nav item
- `src/__tests__/e2e/roles-soft-delete.e2e.test.ts` - 13 E2E tests for ROLE-01..05

## Decisions Made
- Used raw SQL ($queryRawUnsafe) in getCustomers/getStores to bypass Prisma soft delete extension and return all records including archived ones, sorted with active first
- Store soft delete checks 3 conditions: stock quantity > 0, open shifts, and active orders (statuses NEW through READY_FOR_PICKUP) -- all must be clear before deletion allowed
- E2E tests use Prisma ORM .update() for soft delete operations instead of $executeRawUnsafe because the test DB proxy only intercepts $queryRaw/$queryRawUnsafe/$executeRaw (not $executeRawUnsafe) for search_path injection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test $executeRawUnsafe not intercepted by test DB proxy**
- **Found during:** Task 2 (E2E tests)
- **Issue:** Test DB proxy in helpers/db.ts does not intercept $executeRawUnsafe, causing "relation does not exist" errors when tests used raw UPDATE statements
- **Fix:** Changed E2E tests to use Prisma ORM .update() instead of $executeRawUnsafe for soft delete/restore operations. Raw reads still use $queryRawUnsafe which IS intercepted.
- **Files modified:** src/__tests__/e2e/roles-soft-delete.e2e.test.ts
- **Verification:** All 13 tests pass
- **Committed in:** e9a4efe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test approach adapted to test infrastructure limitations. No scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All SEC2 and ROLE requirements for Phase 12 are complete
- Phase 13 (Suppliers & Debts) can proceed
- Roles infrastructure ready for payroll (Phase 14) role-based access

---
*Phase: 12-security-fixes-roles-ui*
*Completed: 2026-04-12*
