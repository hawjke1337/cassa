---
phase: 13
slug: suppliers-debts
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                           |
| ---------------------- | ----------------------------------------------- |
| **Framework**          | vitest (unit + e2e projects)                    |
| **Config file**        | `vitest.config.ts`                              |
| **Quick run command**  | `npx vitest run --reporter=verbose`             |
| **Full suite command** | `npx vitest run`                                |
| **Estimated runtime**  | ~60 seconds                                     |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement           | Test Type | Automated Command                                                   | File Exists | Status     |
| -------- | ---- | ---- | --------------------- | --------- | ------------------------------------------------------------------- | ----------- | ---------- |
| 13-01-01 | 01   | 1    | SUP-06 (schema)       | E2E       | `npx vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts`       | inline      | ⬜ pending |
| 13-01-02 | 01   | 1    | SUP-01,05,06 (action) | E2E       | `npx vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts`       | inline      | ⬜ pending |
| 13-02-01 | 02   | 1    | SUP-03,04 (UI)        | E2E       | `npx tsc --noEmit` (type-check)                                    | inline      | ⬜ pending |
| 13-02-02 | 02   | 1    | SUP-07,08,09 (UI)     | E2E       | `npx tsc --noEmit` (type-check)                                    | inline      | ⬜ pending |
| 13-03-01 | 03   | 2    | SUP-01..09 (E2E)      | E2E       | `npx vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts`       | inline      | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

All tests created inline within plan tasks -- no separate Wave 0 stubs needed.

Existing infrastructure covers test framework setup.

---

## Manual-Only Verifications

| Behavior                                         | Requirement | Why Manual                 | Test Instructions                                                                |
| ------------------------------------------------ | ----------- | -------------------------- | -------------------------------------------------------------------------------- |
| Three amounts layout in order card               | SUP-03      | Visual layout verification | Open order detail, verify Цена клиенту / Закуп / Прибыль display                |
| Supplier city auto-fill display                  | SUP-04      | Visual UI verification     | Create order with supplier that has city, verify city appears in order detail     |
| Dashboard debt card                              | SUP-08      | Visual card verification   | Login as user with orders.costs permission, verify debt card on dashboard         |
| AlertDialog for debt payment                     | SUP-06      | Visual dialog verification | Click "Оплатить" on unpaid debt, verify dialog with amount/comment fields        |
| Payment history table in supplier card           | SUP-09      | Visual table verification  | Pay a debt partially, navigate to supplier card, verify payment history renders   |

_All other phase behaviors have automated verification._

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 dependencies -- tests created inline
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
