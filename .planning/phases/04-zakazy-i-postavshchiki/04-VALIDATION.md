---
phase: 4
slug: zakazy-i-postavshchiki
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (installed) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ORD-01 | manual | N/A (UI dropdown) | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | ORD-02 | unit | `npx vitest run src/__tests__/order-costs.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ORD-03 | unit | `npx vitest run src/__tests__/order-net-profit.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | ORD-04 | unit | `npx vitest run src/__tests__/order-costs.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | ORD-05 | unit | `npx vitest run src/__tests__/supplier-debts-report.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | ORD-06 | unit | `npx vitest run src/__tests__/order-commission.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | ORD-07 | unit | `npx vitest run src/__tests__/order-discount.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | ORD-08 | unit | `npx vitest run src/__tests__/order-item-edit.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/order-costs.test.ts` — stubs for ORD-02, ORD-04
- [ ] `src/__tests__/order-net-profit.test.ts` — stubs for ORD-03
- [ ] `src/__tests__/supplier-debts-report.test.ts` — stubs for ORD-05
- [ ] `src/__tests__/order-commission.test.ts` — stubs for ORD-06
- [ ] `src/__tests__/order-discount.test.ts` — stubs for ORD-07
- [ ] `src/__tests__/order-item-edit.test.ts` — stubs for ORD-08

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supplier dropdown in order form | ORD-01 | UI interaction | Create order, verify supplier Select shows list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
