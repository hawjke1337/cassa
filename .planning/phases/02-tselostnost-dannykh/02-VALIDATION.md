---
phase: 2
slug: tselostnost-dannykh
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (installed in Phase 1) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DATA-01 | unit | `npx vitest run src/__tests__/stock-locking.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DATA-02 | unit | `npx vitest run src/__tests__/counter-transaction.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | DATA-03 | unit | `npx vitest run src/__tests__/weighted-cost-price.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | DATA-05 | unit | `npx vitest run src/__tests__/sell-price-fallback.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | DATA-06 | unit | `npx vitest run src/__tests__/partial-return-commission.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | DATA-07 | unit | `npx vitest run src/__tests__/motivation-validation.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | DATA-04 | unit | `npx vitest run src/__tests__/cancel-order.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | DATA-08 | unit | `npx vitest run src/__tests__/auto-close-shift.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | DATA-09 | unit | `npx vitest run src/__tests__/sales-validation.test.ts` | ✅ Phase 1 | ⬜ pending |
| 02-03-04 | 03 | 2 | DATA-10 | unit | `npx vitest run src/__tests__/trade-in-delete.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/stock-locking.test.ts` — stubs for DATA-01
- [ ] `src/__tests__/counter-transaction.test.ts` — stubs for DATA-02
- [ ] `src/__tests__/weighted-cost-price.test.ts` — stubs for DATA-03
- [ ] `src/__tests__/sell-price-fallback.test.ts` — stubs for DATA-05
- [ ] `src/__tests__/partial-return-commission.test.ts` — stubs for DATA-06
- [ ] `src/__tests__/motivation-validation.test.ts` — stubs for DATA-07
- [ ] `src/__tests__/cancel-order.test.ts` — stubs for DATA-04
- [ ] `src/__tests__/auto-close-shift.test.ts` — stubs for DATA-08
- [ ] `src/__tests__/trade-in-delete.test.ts` — stubs for DATA-10

*Note: DATA-09 already covered by Phase 1 tests. DATA-01/02 concurrency tests are mock-based (real DB locking is integration-test territory for Phase 5).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent sale race condition | DATA-01 | Requires two simultaneous DB transactions | Open two browser tabs, add same last-stock item, click "Pay" simultaneously |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
