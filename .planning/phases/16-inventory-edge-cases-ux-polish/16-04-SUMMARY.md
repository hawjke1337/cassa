---
phase: 16-inventory-edge-cases-ux-polish
plan: "04"
subsystem: ui
tags: [react, nextjs, shadcn, inventory, trade-in, catalog, audit]

requires:
  - phase: 16-01
    provides: ReceiveForm component (src/components/inventory/receive-form.tsx)
  - phase: 16-02
    provides: TradeInForm component + AuditFilters component
  - phase: 16-03
    provides: CategoryForm component (src/components/catalog/category-form.tsx)

provides:
  - "new-receive-client.tsx wired with ReceiveForm — sellPrices passed as 3rd arg to confirmReceive"
  - "new-trade-in-client.tsx uses TradeInForm for device/pricing section with single agreedPrice + initialStatus"
  - "category-manager.tsx integrated with CategoryForm including isAdmin guard + forceOverride"
  - "audit-list-client.tsx with AuditFilters + getAudits showDeleted param"

affects: [phase-17, inventory-flows, trade-in-flows, catalog-management]

tech-stack:
  added: []
  patterns:
    - "Gap closure pattern: orphaned components wired via state-collection (collect values, show summary, submit)"
    - "Two-step confirm pattern: createReceive -> ReceiveForm sellPrice step -> confirmReceive(id, serial, sellPrices)"
    - "TradeInForm collection pattern: onSubmit captures values to tradeInValues state, outer button submits"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/inventory/receive/new/new-receive-client.tsx
    - src/app/(dashboard)/trade-in/new/new-trade-in-client.tsx
    - src/components/catalog/category-manager.tsx
    - src/app/(dashboard)/catalog/categories/page.tsx
    - src/app/(dashboard)/inventory/audit/audit-list-client.tsx
    - src/actions/inventory.ts

key-decisions:
  - "ReceiveForm integrated via two-step: save draft -> ReceiveForm sell-price overlay -> confirmReceive with 3rd arg"
  - "TradeInForm collection mode: onSubmit sets tradeInValues state; outer Оформить button triggers actual submission"
  - "getAudits showDeleted=false filters audits where all items reference only non-deleted Products (items.none filter)"
  - "CategoryManager formInitialValues pattern: parentId stored in state, passed as initialValues to CategoryForm"

patterns-established:
  - "Orphan component wiring: always collect via state, show confirmation summary, then submit from outer context"
  - "isAdmin from settings.stores permission passed down from server page to client manager component"

requirements-completed: [INV-06, UX2-11, INV-01, INV-08, INV-09]

duration: 6min
completed: "2026-04-14"
---

# Phase 16 Plan 04: Gap Closure — Wire 4 Orphaned UI Components Summary

**Four orphaned Phase 16 components (ReceiveForm, TradeInForm, CategoryForm, AuditFilters) wired into their client pages, fixing CRITICAL production blocker INV-06 (SELLPRICE_REQUIRED) and delivering UX2-11, INV-01, INV-08, INV-09**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-14T18:50:03Z
- **Completed:** 2026-04-14T18:56:00Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- **INV-06 CRITICAL UNBLOCKED:** new-receive-client.tsx now collects sell prices via ReceiveForm before calling confirmReceive with 3-arg signature — SELLPRICE_REQUIRED error eliminated
- **UX2-11 + INV-09 DELIVERED:** new-trade-in-client.tsx replaced Sections 2+3 with TradeInForm — single "Цена выкупа" field, estimatedPrice removed, PENDING/IN_STOCK RadioGroup visible
- **INV-01 DELIVERED:** category-manager.tsx integrated with CategoryForm — isAdmin prop wired from categories/page.tsx, forceOverride + forceReason flow reaches updateCategory
- **INV-08 DELIVERED:** audit-list-client.tsx has AuditFilters checkbox above table, getAudits extended with showDeleted param filtering by product.deletedAt

## Task Commits

1. **Task 1 (INV-06): Wire ReceiveForm into new-receive-client** - `2268d73` (feat)
2. **Task 2 (UX2-11+INV-09): Replace pricing section with TradeInForm** - `642513e` (feat)
3. **Task 3 (INV-01): Integrate CategoryForm into category-manager** - `536a373` (feat)
4. **Task 4 (INV-08): Wire AuditFilters into audit-list-client** - `d28c057` (feat)

## Files Created/Modified

- `src/app/(dashboard)/inventory/receive/new/new-receive-client.tsx` — added ReceiveForm import, receiveId/sellPriceItems state, two-step confirm flow, handleConfirmWithPrices calling confirmReceive with sellPrices
- `src/app/(dashboard)/trade-in/new/new-trade-in-client.tsx` — removed device/pricing individual state (7 vars), added tradeInValues state, replaced Sections 2+3 with TradeInForm card, removed DEVICE_TYPES and Textarea imports
- `src/components/catalog/category-manager.tsx` — added CategoryForm import, isAdmin prop, formInitialValues state, handleCategoryFormSubmit with forceOverride, removed 4 inline form state vars + 6 unused imports
- `src/app/(dashboard)/catalog/categories/page.tsx` — added isAdmin=checkPermission("settings.stores") passed to CategoryManager
- `src/app/(dashboard)/inventory/audit/audit-list-client.tsx` — added AuditFilters import, showDeleted state, updated getAudits call and loadAudits deps
- `src/actions/inventory.ts` — extended getAudits with showDeleted?: boolean param, whereClause filters audits with deleted products when showDeleted=false

## Decisions Made

- **Two-step receive confirm:** handleSave(andConfirm=true) now stores receiveId + builds sellPriceItems then shows ReceiveForm overlay. ReceiveForm's own submit button calls handleConfirmWithPrices which invokes confirmReceive(receiveId, serialData|undefined, sellPrices). This isolates the sell-price collection step cleanly without modifying ReceiveForm itself.
- **TradeInForm collection mode:** TradeInForm's submit button ("Создать trade-in") captures values into tradeInValues state. The outer "Оформить" button is the actual submission trigger. Operator sees a summary card with "Изменить" option after filling the form.
- **getAudits showDeleted filter semantics:** showDeleted=false uses Prisma `items.none: { product: { deletedAt: { not: null } } }` — shows only audits where none of the items reference deleted products. showDeleted=true returns all audits (no filter). Default is false.
- **parentId via formInitialValues:** CategoryForm doesn't expose parentId field. parentId is stored in formInitialValues.parentId (local to CategoryManager) and passed to updateCategory/createCategory inside handleCategoryFormSubmit. This avoids modifying CategoryForm's interface.

## Deviations from Plan

None — plan executed exactly as written. The `getAudits` showDeleted param was added as specified in the plan's Step A instructions. The filter implementation chose the `items.none` approach as the most semantically correct way to surface "audits with deleted products" when showDeleted=true.

## Issues Encountered

None — all 4 orphaned components had clean interfaces. TypeScript check confirms zero new errors in modified files. Pre-existing TSC errors in motivation-calculation.ts, repairs.ts, and trade-in.ts are unrelated to this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 16 (all plans 01-04) complete. All requirements INV-01, INV-06, INV-08, INV-09, UX2-11 delivered.
- Production blocker INV-06 (SELLPRICE_REQUIRED) resolved — receive flow now functional for new products.
- No blockers.

---
*Phase: 16-inventory-edge-cases-ux-polish*
*Completed: 2026-04-14*
