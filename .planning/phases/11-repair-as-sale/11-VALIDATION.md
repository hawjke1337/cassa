---
phase: 11
slug: repair-as-sale
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest (E2E via vitest projects)    |
| **Config file**        | `vitest.config.ts`                  |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run`                    |
| **Estimated runtime**  | ~45 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run task-specific test command from verify column
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement     | Test Type | Automated Command                                                                   | Status     |
| -------- | ---- | ---- | --------------- | --------- | ----------------------------------------------------------------------------------- | ---------- |
| 11-01-01 | 01   | 1    | REPAIR-05,06    | schema    | `npx prisma validate`                                                               | ⬜ pending |
| 11-01-02 | 01   | 1    | REPAIR-05,06    | e2e       | `npx vitest run src/__tests__/e2e/repair-cost-audit.e2e.test.ts --reporter=verbose` | ⬜ pending |
| 11-02-01 | 02   | 2    | REPAIR-01..04   | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts --reporter=verbose`    | ⬜ pending |
| 11-03-01 | 03   | 1    | REPAIR-07,08,09 | grep+tsc  | `npx tsc --noEmit` + grep checks for SOLD+IN_STOCK filter and Sale.number search    | ⬜ pending |
| 11-03-02 | 03   | 1    | REPAIR-07,08,09 | e2e       | `npx vitest run src/__tests__/e2e/warranty-lookup.e2e.test.ts --reporter=verbose`   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave Structure

| Wave | Plans  | Test Files Created                                                                                 |
| ---- | ------ | -------------------------------------------------------------------------------------------------- |
| 1    | 01, 03 | `src/__tests__/e2e/repair-cost-audit.e2e.test.ts`, `src/__tests__/e2e/warranty-lookup.e2e.test.ts` |
| 2    | 02     | `src/__tests__/e2e/repair-as-sale.e2e.test.ts`                                                     |

Note: Plans 01 and 03 are both Wave 1 with no dependencies between them (Plan 01 touches schema + repairs.ts, Plan 03 touches warranty-claims.ts -- no file overlap). Plan 02 depends on Plan 01 (needs schema models from Plan 01).

---

## Nyquist Compliance

All plans create their E2E test files inline within tasks (TDD approach: tests written as part of the task, not separate Wave 0 stubs). Each task has a concrete `<automated>` verify command:

- **Plan 01 Task 2:** Creates `src/__tests__/e2e/repair-cost-audit.e2e.test.ts` with 4+ tests
- **Plan 02 Task 1:** Creates `src/__tests__/e2e/repair-as-sale.e2e.test.ts` with 12 tests (concrete expect() assertions)
- **Plan 03 Task 1:** Verify via grep checks (SOLD+IN_STOCK filter, Sale.number search block present)
- **Plan 03 Task 2:** Creates `src/__tests__/e2e/warranty-lookup.e2e.test.ts` with 6 tests

No separate Wave 0 test stub tasks needed -- tests are created within the TDD task workflow.

---

## Requirement Coverage

| Req ID    | Plan(s) | Test File                                         | Verification Approach                                                                           |
| --------- | ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| REPAIR-01 | 02      | `src/__tests__/e2e/repair-as-sale.e2e.test.ts`    | Sale creation on DELIVERED, payment re-parent, shift check                                      |
| REPAIR-02 | 02      | `src/__tests__/e2e/repair-as-sale.e2e.test.ts`    | Exact getDashboardData query reproduction (db.sale.findMany with status=COMPLETED + date range) |
| REPAIR-03 | 02      | `src/__tests__/e2e/repair-as-sale.e2e.test.ts`    | addRepairPart stock decrement, removeRepairPart stock restore                                   |
| REPAIR-04 | 02      | `src/__tests__/e2e/repair-as-sale.e2e.test.ts`    | SaleItem COGS from RepairParts, labor-only costPrice=0                                          |
| REPAIR-05 | 01      | `src/__tests__/e2e/repair-cost-audit.e2e.test.ts` | RepairCostHistory record creation on cost changes                                               |
| REPAIR-06 | 01      | `src/__tests__/e2e/repair-cost-audit.e2e.test.ts` | Cost freeze guard on COMPLETED/DELIVERED                                                        |
| REPAIR-07 | 03      | `src/__tests__/e2e/warranty-lookup.e2e.test.ts`   | IN_STOCK + SOLD status filter                                                                   |
| REPAIR-08 | 03      | `src/__tests__/e2e/warranty-lookup.e2e.test.ts`   | Expired/valid warranty detection                                                                |
| REPAIR-09 | 03      | `src/__tests__/e2e/warranty-lookup.e2e.test.ts`   | Sale.number search                                                                              |

---

## Manual-Only Verifications

| Behavior                          | Requirement | Why Manual             | Test Instructions                                            |
| --------------------------------- | ----------- | ---------------------- | ------------------------------------------------------------ |
| Dashboard displays repair revenue | REPAIR-02   | Visual UI verification | Navigate to dashboard, verify repair sales in revenue totals |

_All other phase behaviors have automated verification._

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 gaps -- tests created inline in TDD tasks
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
