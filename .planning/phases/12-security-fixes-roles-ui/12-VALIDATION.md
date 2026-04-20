---
phase: 12
slug: security-fixes-roles-ui
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                           |
| ---------------------- | ----------------------------------------------- |
| **Framework**          | vitest + playwright (E2E)                       |
| **Config file**        | `vitest.config.ts` / `e2e/playwright.config.ts` |
| **Quick run command**  | `npx vitest run --reporter=verbose`             |
| **Full suite command** | `npx vitest run && npx playwright test`         |
| **Estimated runtime**  | ~60 seconds                                     |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement         | Test Type | Automated Command                                                 | File Exists | Status     |
| -------- | ---- | ---- | ------------------- | --------- | ----------------------------------------------------------------- | ----------- | ---------- |
| 12-01-01 | 01   | 1    | SEC2-01..09         | E2E       | `npx vitest run src/__tests__/e2e/security-hardening.e2e.test.ts` | inline      | ⬜ pending |
| 12-01-02 | 01   | 1    | SEC2-06 (toast)     | unit      | `npx tsc --noEmit` (hook type-checks)                             | inline      | ⬜ pending |
| 12-02-01 | 02   | 1    | SEC2-10 (model)     | E2E       | `npx vitest run src/__tests__/e2e/audit-log.e2e.test.ts`          | inline      | ⬜ pending |
| 12-02-02 | 02   | 1    | SEC2-10 (UI+inline) | E2E       | `npx vitest run src/__tests__/e2e/audit-log.e2e.test.ts`          | inline      | ⬜ pending |
| 12-03-01 | 03   | 2    | ROLE-01,02,03       | E2E       | `npx vitest run src/__tests__/e2e/roles-soft-delete.e2e.test.ts`  | inline      | ⬜ pending |
| 12-03-02 | 03   | 2    | ROLE-04,05          | E2E       | `npx vitest run src/__tests__/e2e/roles-soft-delete.e2e.test.ts`  | inline      | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

All tests created inline within plan tasks -- no separate Wave 0 stubs needed.

Existing infrastructure covers test framework setup.

---

## Manual-Only Verifications

| Behavior                                        | Requirement | Why Manual                 | Test Instructions                                                          |
| ----------------------------------------------- | ----------- | -------------------------- | -------------------------------------------------------------------------- |
| Permission matrix checkbox UI renders correctly | ROLE-02     | Visual layout verification | Navigate to /settings/roles, create role, verify checkbox matrix renders   |
| Audit log inline history on entity pages        | SEC2-10     | Visual UI verification     | Edit a role, navigate to /settings/roles/[id], verify audit entries appear |
| Rate limit toast with countdown                 | SEC2-06     | Visual toast verification  | Trigger rate limit, verify sonner toast shows live countdown timer         |

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
