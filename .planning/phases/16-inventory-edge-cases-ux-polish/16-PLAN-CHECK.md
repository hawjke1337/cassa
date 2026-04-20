# Phase 16 — Plan Verification Report

**Verified:** 2026-04-14
**Plans checked:** 16-01, 16-02, 16-03
**Verdict:** BLOCK — 2 blockers, 2 warnings, 1 info

---

## Verdict: BLOCK

Two blocking issues must be resolved before execution proceeds.

---

## Dimension 1: Requirement Coverage

| Requirement | Plan(s) | Task(s) | Status |
|-------------|---------|---------|--------|
| INV-01 | 16-01 | Task 3 | COVERED |
| INV-02 | 16-01 | Task 2 | COVERED |
| INV-03 | 16-01 | Task 2 | COVERED |
| INV-04 | 16-01 | Task 2, Task 4 | COVERED |
| INV-05 | 16-01 | Task 4 | COVERED |
| INV-06 | 16-01 | Task 4 | COVERED |
| INV-07 | 16-01 | Task 5 | COVERED |
| INV-08 | 16-01 | Task 2 | COVERED |
| INV-09 | 16-01 | Task 5 | COVERED |
| UX2-01 | 16-02 | Task 2 | COVERED |
| UX2-02 | 16-02 | Task 1 | COVERED |
| UX2-03 | 16-02 | Task 2 | COVERED |
| UX2-04 | 16-02 | Task 2 | COVERED |
| UX2-05 | 16-02 | Task 2 | COVERED |
| UX2-06 | 16-02 | Task 1 | COVERED |
| UX2-07 | 16-02 | Task 3 | COVERED |
| UX2-08 | 16-03 | Task 3 | COVERED |
| UX2-09 | 16-03 | Task 3 | COVERED |
| UX2-10 | 16-03 | Task 1 | COVERED |
| UX2-11 | 16-01 | Task 5 (primary) + 16-03 Task 2 (follow-up) | COVERED |
| UX2-12 | 16-03 | Task 2 | COVERED |
| UX2-13 | 16-02 | Task 3 | COVERED |
| UX2-14 | 16-03 | Task 1 | COVERED |
| UX2-15 | 16-03 | Task 1 | COVERED |
| UX2-16 | 16-03 | Task 4 | COVERED |
| UX2-17 | 16-03 | Task 3 | COVERED |

All 26 requirements covered. No gaps.

---

## Dimension 2: Task Completeness

| Plan | Task | Files | Action | Verify | Done | Status |
|------|------|-------|--------|--------|------|--------|
| 16-01 | Task 0 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-01 | Task 1 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-01 | Task 2 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-01 | Task 3 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-01 | Task 4 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-01 | Task 5 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-02 | Task 0 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-02 | Task 1 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-02 | Task 2 | ✅ | ✅ | ✅ (lint+tsc) | ✅ | OK — manual only per VALIDATION.md |
| 16-02 | Task 3 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-03 | Task 1 | ✅ | ✅ | ✅ | ✅ | OK |
| 16-03 | Task 2 | ✅ | ✅ | ✅ (tsc+lint) | ✅ | OK — visual verification per VALIDATION.md |
| 16-03 | Task 3 | ✅ | ✅ | ✅ (tsc+lint) | ✅ | OK — manual only per VALIDATION.md |
| 16-03 | Task 4 | ✅ | ✅ | ✅ (tsc+build) | ✅ | OK |

All tasks structurally complete.

---

## Dimension 3: Dependency Correctness — BLOCKER FOUND

### Issue B-1: Parallel file conflict on `src/actions/sales.ts` in Wave 1

**Plans 16-01 and 16-02 are both Wave 1 with `depends_on: []`, yet both declare `src/actions/sales.ts` in `files_modified`:**

- 16-01 Task 4 writes to `sales.ts`: adds `logQuantityChange` calls in `createSale` and `createReturn`
- 16-02 Task 1 writes to `sales.ts`: adds `idempotencyKey` check in `createSale`

The `<coordination_note>` in 16-02 explicitly acknowledges this and recommends either a rebase or moving 16-02 to wave 2. **Neither fix is implemented in the frontmatter.** Both plans remain `wave: 1, depends_on: []`.

When a wave orchestrator runs these in parallel, the second writer will overwrite or conflict with the first. The coordination note is documentation of a known problem, not a solution.

**Fix required (choose one):**
- Option A (recommended): Set `16-02: wave: 2, depends_on: ["16-01"]`. Then 16-02 Task 1 reads the already-modified `sales.ts` from 16-01 and applies the idempotency patch on top. Clean, no merge risk.
- Option B: Keep wave 1, but split `sales.ts` changes into an explicit sub-ordering — only viable if the orchestrator serializes plan execution within a wave (not guaranteed).

```yaml
issue:
  plan: "16-02"
  dimension: dependency_correctness
  severity: blocker
  description: "Wave 1 conflict: plans 16-01 and 16-02 both write src/actions/sales.ts in parallel. Coordination note acknowledges this but does not fix it in frontmatter."
  conflicting_file: "src/actions/sales.ts"
  fix_hint: "Move 16-02 to wave: 2 with depends_on: ['16-01']. Its <coordination_note> already recommends this."
```

---

## Dimension 4: Key Links Planned

All key links verified against task actions:

- `sales.ts → store-product-history.ts` via `logQuantityChange`: 16-01 Task 4 action explicitly states this call.
- `payment-dialog.tsx → sales.ts` via `idempotencyKey`: 16-02 Task 1 action states the createSale call with idempotencyKey.
- `sales.ts → prisma.sale` via idempotency findUnique: 16-02 Task 1 action includes the server-side check.
- `receipt-view.tsx → receipts.ts` via `aggregatePaymentsByMethod`: 16-03 Task 1 action shows explicit import and usage.
- `pos-interface.tsx → category-grid.tsx` via `CategoryGrid`: 16-03 Task 3 action shows conditional render when `searchQuery === ''`.
- `app-sidebar.tsx → /products`: 16-03 Task 4 action removes old entries and adds single "Товары" item.
- `catalog/page.tsx → /products?tab=catalog` via redirect: 16-03 Task 4 action explicitly codes this.
- `audit.ts → prisma.serialUnit` MISSING/WRITTEN_OFF: 16-01 Task 2 action contains the full logic.
- `catalog.ts → prisma.auditLog` for admin override: 16-01 Task 3 action contains `auditLog.create`.

All key links planned. No wiring gaps found.

---

## Dimension 5: Scope Sanity — BLOCKER FOUND

### Issue B-2: 16-01 has 6 tasks (exceeds blocker threshold of 5+)

16-01 contains Task 0 (Wave 0 stubs) + Tasks 1–5, totalling **6 tasks**. With 14 files modified, this is the highest-density plan in the phase.

The work is genuinely complex: a schema migration, 5 separate action files, 5 UI components, and E2E test authoring. This quantity risks quality degradation within a single execution context.

**Breakdown:**
- Task 0: test stubs (2 files)
- Task 1: schema + helper (3 files)
- Task 2: audit rework (3 files)
- Task 3: category guard (2 files)
- Task 4: transfer + receive + history wiring (3 files + sales.ts from another plan)
- Task 5: trade-in (2 files)

**Recommended split:**
- 16-01a: Task 0 (Wave 0) + Task 1 (schema migration + helper) — foundation
- 16-01b: Tasks 2–3 (audit logic + category guard) — inventory logic
- 16-01c: Tasks 4–5 (transfer/receive/trade-in + history wiring) — remaining edge cases

This split also resolves B-1 naturally: 16-02 can depend on 16-01a (which owns the `sales.ts` initial changes) or on all of 16-01.

```yaml
issue:
  plan: "16-01"
  dimension: scope_sanity
  severity: blocker
  description: "16-01 has 6 tasks with 14 files — exceeds quality threshold. Complex schema migration + 5 actions + 5 UI components in one execution context."
  metrics:
    tasks: 6
    files: 14
  fix_hint: "Split into 16-01 (Wave 0 + schema, 3 tasks) and 16-04 (audit/category/transfer/trade-in, 4 tasks). Alternatively collapse Wave 0 into the migration task and split remaining 5 action tasks across two plans."
```

---

## Dimension 6: Verification Derivation (must_haves)

All three plans have `must_haves` with `truths`, `artifacts`, and `key_links`.

**16-01:** Truths are user-observable and testable (server returns error, status becomes MISSING/WRITTEN_OFF, etc.). Artifacts include min_lines and contains checks. Key links specify pattern strings for wiring. 

**16-02:** Truths are behavioral and testable (AlertDialog shown, ref-lock active, idempotencyKey prevents duplicate). Artifacts are component-level with contains checks. Key links specify patterns. 

**16-03:** Truths cover UI state and navigation. Artifacts map directly to truths. Key links connect receipt to aggregation helper, POS to CategoryGrid, sidebar to products page. 

No verification derivation issues.

---

## Dimension 7: Context Compliance

CONTEXT.md checked against all three plans.

### Locked Decisions — all honored:

| Decision | Plan | Task | Implementation | Status |
|----------|------|------|----------------|--------|
| INV-01 guard + admin override | 16-01 | Task 3 | requirePermission + AlertDialog + AuditLog | ✅ |
| INV-02 MISSING → WRITTEN_OFF | 16-01 | Task 2 | prevAudit check → status logic | ✅ |
| INV-03 recompute at close | 16-01 | Task 2 | FOR UPDATE + re-query in tx | ✅ |
| INV-04 separate Prisma model | 16-01 | Task 1 | StoreProductHistory model + logQuantityChange | ✅ |
| INV-05 block null sourceSp | 16-01 | Task 4 | findFirst + ActionError | ✅ |
| INV-06 mandatory manual sellPrice | 16-01 | Task 4 | Zod positive() + UI required field | ✅ |
| INV-07 warning not block | 16-01 | Task 5 | inline Alert, creation not blocked | ✅ |
| INV-08 toggle filter | 16-01 | Task 2 | Checkbox + showDeleted param | ✅ |
| INV-09 IN_STOCK or PENDING | 16-01 | Task 5 | status enum choice in form | ✅ |
| UX2-01 AlertDialog return | 16-02 | Task 2 | AlertDialog with confirm/cancel | ✅ |
| UX2-02 ref-lock + disable | 16-02 | Task 1 | useRef lock + spinner + disabled | ✅ |
| UX2-03 AlertDialog closeShift | 16-02 | Task 2 | discrepancy check → AlertDialog | ✅ |
| UX2-04 cart blocked | 16-02 | Task 2 | cartLocked prop + opacity/pointer-events-none | ✅ |
| UX2-05 critical toast retry | 16-02 | Task 1, Task 2 | useCriticalToast hook | ✅ |
| UX2-06 client UUID idempotency | 16-02 | Task 1 | crypto.randomUUID() + server findUnique | ✅ |
| UX2-11 single agreedPrice field | 16-01 | Task 5 | Remove estimatedPrice from schema + form | ✅ |
| UX2-16 merge catalog + inventory | 16-03 | Task 4 | Single /products with tabs + redirects | ✅ |
| UX2-17 category grid | 16-03 | Task 3 | CategoryGrid when searchQuery === '' | ✅ |

### ROADMAP SC3 vs CONTEXT.md conflict (info):

ROADMAP success criterion 3 states: "Receive создаёт StoreProduct с sellPrice = costPrice * markup (not 0)". CONTEXT.md locked decision INV-06 says: "sellPrice обязательное поле, без auto-расчёта. Оператор вводит сам". Plan 16-01 Task 4 correctly implements the CONTEXT.md decision (mandatory manual input, no auto-calc). The ROADMAP text appears to be from an earlier discussion and is superseded by the locked decision. Plans are correct.

### Deferred Ideas:

CONTEXT.md declares "None — discussion stayed within phase scope". No scope creep found in any plan.

**Context compliance: PASS.**

---

## Dimension 8: Nyquist Compliance

VALIDATION.md exists. `nyquist_compliant: false` in frontmatter — validation architecture is declared but not yet signed off (expected for draft plans).

**Check 8e — VALIDATION.md exists:** PASS

**Check 8a — Automated verify presence:**

| Task | Plan | Wave | Automated Command | Status |
|------|------|------|-------------------|--------|
| Task 0 | 16-01 | 0 | vitest run inventory-edge-cases + trade-in-edge-cases | ✅ |
| Task 1 | 16-01 | 1 | prisma validate + migrate status | ✅ (structural) |
| Task 2 | 16-01 | 1 | vitest run -t INV-02\|03\|04\|08 | ✅ (W0 dep) |
| Task 3 | 16-01 | 1 | vitest run -t INV-01 | ✅ (W0 dep) |
| Task 4 | 16-01 | 1 | vitest run -t INV-04\|05\|06 | ✅ (W0 dep) |
| Task 5 | 16-01 | 1 | vitest run trade-in-edge-cases | ✅ (W0 dep) |
| Task 0 | 16-02 | 0 | vitest run ux-polish | ✅ |
| Task 1 | 16-02 | 1 | vitest run -t UX2-02\|06 | ✅ (W0 dep) |
| Task 2 | 16-02 | 1 | lint + tsc --noEmit | ✅ (manual-only per VALIDATION.md) |
| Task 3 | 16-02 | 1 | vitest run payment-aggregation | ✅ |
| Task 1 | 16-03 | 2 | vitest run payment-aggregation + tsc | ✅ |
| Task 2 | 16-03 | 2 | tsc + lint | ✅ (visual per VALIDATION.md) |
| Task 3 | 16-03 | 2 | tsc + lint | ✅ (visual per VALIDATION.md) |
| Task 4 | 16-03 | 2 | tsc + build | ✅ |

**Check 8b — Feedback latency:** No watch-mode flags found. Commands use `vitest run` (one-shot). VALIDATION.md states ~45s estimated runtime. PASS.

**Check 8c — Sampling continuity:**
- Wave 1 (16-01): Tasks 1–5 all have automated verify (prisma/vitest). No 3-consecutive gap. PASS.
- Wave 1 (16-02): Task 2 has lint+tsc only (behavioral verification is manual-only). Tasks 0, 1, 3 have vitest. No 3-consecutive gap. PASS.
- Wave 2 (16-03): Tasks 1 and 4 have vitest/build; Tasks 2–3 are lint/tsc only. No 3 consecutive without automated verify. PASS.

**Check 8d — Wave 0 completeness:**
- `src/__tests__/e2e/inventory-edge-cases.e2e.test.ts` — Wave 0 task in 16-01 Task 0. ✅
- `src/__tests__/e2e/ux-polish.e2e.test.ts` — Wave 0 task in 16-02 Task 0. ✅
- `src/__tests__/trade-in-edge-cases.test.ts` — Wave 0 task in 16-01 Task 0. ✅
- `src/__tests__/payment-aggregation.test.ts` — Created in 16-02 Task 3 (Wave 1), consumed by 16-03 Task 1 (Wave 2). Not a Wave 0 MISSING reference — 16-03 depends on 16-02, so the file is guaranteed to exist before 16-03 runs. ✅

**Dimension 8: PASS** (with caveat: `nyquist_compliant` must be set to `true` in VALIDATION.md frontmatter once execution sign-off is complete)

---

## Issues Summary

### Blockers (must fix before execution)

**B-1: [dependency_correctness] Wave 1 file conflict on `src/actions/sales.ts`**
- Plans: 16-01 and 16-02
- Both `wave: 1, depends_on: []`; both declare `src/actions/sales.ts` in `files_modified`
- 16-01 Task 4 adds logQuantityChange to createSale/createReturn; 16-02 Task 1 adds idempotencyKey check to createSale
- Parallel execution will cause a merge conflict or silent overwrite
- Fix: Set `16-02: wave: 2, depends_on: ["16-01"]` (the coordination_note already recommends this)

**B-2: [scope_sanity] 16-01 has 6 tasks with 14 files**
- Exceeds quality threshold of 5 tasks/plan
- Complex domain (schema migration + 5 server actions + 5 UI components + test stubs)
- Fix: Split 16-01 into two plans:
  - 16-01: Wave 0 stubs + schema migration + logQuantityChange helper (Tasks 0–1, 5 files)
  - 16-04: audit logic + category guard + transfer/receive/trade-in edge cases (Tasks 2–5, 10 files)
  - If splitting is too disruptive: at minimum merge Task 0 into Task 1 (create test stubs as part of migration task, both Wave 0/1 combined) to bring count to 5 tasks

### Warnings (should fix)

**W-1: [scope_sanity] 16-03 has 4 tasks with 14 files**
- 4 tasks is at the warning threshold; 14 files is high
- Tasks are mostly UI additions (new components, redirects, aria-labels) so context cost per task is lower
- Monitor during execution; if any task expands, split Task 4 (products merge) into its own plan

**W-2: [key_links_planned] `src/components/pos/pos-interface.tsx` modified by both 16-02 and 16-03 (sequential)**
- 16-02 Task 2 adds `paymentDialogOpen` state lift and `CartSection locked={paymentDialogOpen}`
- 16-03 Task 3 adds CategoryGrid conditional render and Sheet-based mobile cart
- These are different sections of the same file; 16-03 depends on 16-02, so sequential execution is safe
- However, 16-03 Task 3 action reads "src/components/pos/pos-interface.tsx (layout after Plan 02)" — executor must read the Plan 02-modified version, not the pre-phase version
- Risk: if 16-03 Task 3 action code snippets conflict with 16-02 Task 2 additions (both restructure the component layout), a manual merge will be needed
- Fix hint: 16-03 Task 3 `<read_first>` correctly flags this; ensure executor reads the file post-16-02 before applying changes

### Info

**I-1: [context_compliance] ROADMAP SC3 text contradicts CONTEXT.md INV-06**
- ROADMAP success criterion 3: "Receive creates StoreProduct with sellPrice = costPrice * markup (not 0)"
- CONTEXT.md locked decision INV-06: "mandatory manual input, no auto-calc"
- Plans correctly implement CONTEXT.md. ROADMAP text is stale from a pre-discussion version.
- No action required in plans; ROADMAP.md SC3 text may be updated post-phase for accuracy.

---

## Structured Issues (YAML)

```yaml
issues:
  - plan: "16-02"
    dimension: dependency_correctness
    severity: blocker
    description: "Wave 1 file conflict: 16-01 and 16-02 both declare src/actions/sales.ts in files_modified with depends_on: []. Parallel execution will cause merge conflict. coordination_note acknowledges but does not fix."
    conflicting_file: "src/actions/sales.ts"
    fix_hint: "Set 16-02 wave: 2, depends_on: ['16-01']. Already recommended in 16-02 coordination_note."

  - plan: "16-01"
    dimension: scope_sanity
    severity: blocker
    description: "16-01 has 6 tasks with 14 files. Exceeds 5-task blocker threshold. Schema migration + 5 action rewrites + 5 UI components + E2E stubs in one execution context risks quality degradation."
    metrics:
      tasks: 6
      files: 14
    fix_hint: "Split into 16-01 (Tasks 0-1: Wave 0 stubs + schema, 5 files) and 16-04 (Tasks 2-5: audit/category/transfer/trade-in, 10 files). Or merge Task 0 into Task 1 (5 tasks total) as minimum fix."

  - plan: "16-03"
    dimension: scope_sanity
    severity: warning
    description: "16-03 has 4 tasks with 14 files. At warning threshold. UI-heavy tasks have lower complexity per file but monitor during execution."
    metrics:
      tasks: 4
      files: 14
    fix_hint: "If Task 4 (products merge + CatalogView/InventoryView extraction) expands, split it into its own plan."

  - plan: "16-03"
    dimension: key_links_planned
    severity: warning
    description: "src/components/pos/pos-interface.tsx is modified by both 16-02 (Task 2: cart locking) and 16-03 (Task 3: CategoryGrid + responsive). Sequential dependency exists but both tasks restructure component layout — executor must merge cleanly."
    fix_hint: "16-03 Task 3 read_first already flags this. Ensure executor reads the post-16-02 file version and applies changes as a targeted diff, not a full overwrite."
```

---

## Recommendation

**2 blockers require resolution. Return to planner.**

Fix priority:
1. **B-1 (easy, 1-line fix):** Change 16-02 frontmatter `wave: 1 → wave: 2`, add `depends_on: ["16-01"]`. This also resolves the sales.ts conflict naturally.
2. **B-2 (requires plan split or task merge):** Either split 16-01 into two plans, or merge Task 0 (Wave 0 stubs) into Task 1 as the first action item (bringing task count to 5). The minimal fix is the merge: create test stubs as step 0 within Task 1, eliminating the separate Wave 0 task entry while keeping the same file outputs.

After fixing both blockers, plans are safe to execute.

