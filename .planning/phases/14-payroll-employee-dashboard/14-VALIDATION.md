---
phase: 14
slug: payroll-employee-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (projects: unit + e2e) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run src/__tests__/e2e/order-commission-peritem.e2e.test.ts src/__tests__/e2e/payroll-employee.e2e.test.ts -x` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/__tests__/e2e/order-commission-peritem.e2e.test.ts src/__tests__/e2e/payroll-employee.e2e.test.ts -x`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PAYROLL-01 | e2e | `pnpm vitest run src/__tests__/e2e/order-commission-peritem.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | PAYROLL-03 | unit | `pnpm vitest run src/__tests__/shift-grouped-earnings.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | PAYROLL-05 | e2e | `pnpm vitest run src/__tests__/e2e/payroll-employee.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | PAYROLL-06 | e2e | `pnpm vitest run src/__tests__/e2e/payroll-employee.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 14-02-04 | 02 | 1 | PAYROLL-04 | unit | `pnpm vitest run src/__tests__/e2e/motivation-precision.e2e.test.ts -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/e2e/order-commission-peritem.e2e.test.ts` — stubs for PAYROLL-01 (per-item vs total order profit)
- [ ] `src/__tests__/e2e/payroll-employee.e2e.test.ts` — stubs for PAYROLL-05, PAYROLL-06 (own data scope, history)
- [ ] `src/__tests__/shift-grouped-earnings.test.ts` — stubs for PAYROLL-03 (shift grouping logic)

*Existing infrastructure covers PAYROLL-04 via motivation-precision.e2e.test.ts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shift accordion UI expand/collapse | PAYROLL-03 | Visual interaction | Open /my/motivation → verify shift sections expand/collapse, show correct data |
| Payroll history table layout | PAYROLL-05 | Visual layout | Open /my/motivation → verify table columns, click row → breakdown appears |
| PDF download from history | PAYROLL-05 | File download | Click PDF icon in history row → verify PDF opens with correct data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
