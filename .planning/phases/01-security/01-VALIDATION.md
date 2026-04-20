---
phase: 1
slug: security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (minimal install for Phase 1) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SEC-01 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "sellPrice"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SEC-02 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "costPrice"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SEC-03 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "discount"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | SEC-04 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "quantity"` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | SEC-05 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "shift"` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | SEC-06 | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "return storeId"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-01 | unit | `npx vitest run src/__tests__/auth-jwt.test.ts -t "permissions refresh"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | AUTH-02 | unit | `npx vitest run src/__tests__/rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | AUTH-03 | unit | `npx vitest run src/__tests__/password-validation.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | AUTH-04 | manual | `grep "use server" src/lib/serial-history.ts` should fail | N/A | ⬜ pending |
| 01-03-01 | 03 | 2 | PERM-01 | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "trade-in"` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | PERM-02 | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "reports"` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | PERM-03 | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "payroll"` | ❌ W0 | ⬜ pending |
| 01-03-04 | 03 | 2 | PERM-04 | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "document"` | ❌ W0 | ⬜ pending |
| 01-03-05 | 03 | 2 | PERM-05 | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "shift"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest @vitejs/plugin-react` — minimal vitest setup
- [ ] `vitest.config.ts` — basic config with path aliases from tsconfig
- [ ] `src/__tests__/sales-validation.test.ts` — stubs for SEC-01..06
- [ ] `src/__tests__/auth-jwt.test.ts` — stubs for AUTH-01
- [ ] `src/__tests__/rate-limit.test.ts` — stubs for AUTH-02
- [ ] `src/__tests__/password-validation.test.ts` — stubs for AUTH-03
- [ ] `src/__tests__/permissions-store-scope.test.ts` — stubs for PERM-01..05

*Note: Full test infrastructure is Phase 5 (INFRA-01). Phase 1 uses minimal vitest for unit tests on pure functions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| writeSerialHistory not a server action | AUTH-04 | File structure check | `grep "use server" src/lib/serial-history.ts` should return nothing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
