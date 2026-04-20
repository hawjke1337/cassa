---
phase: 6
slug: ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                        |
| ---------------------- | -------------------------------------------- |
| **Framework**          | Vitest 4.1.2 (installed, 134 existing tests) |
| **Config file**        | `vitest.config.ts` (exists)                  |
| **Quick run command**  | `npx vitest run --reporter=verbose`          |
| **Full suite command** | `npx vitest run`                             |
| **Estimated runtime**  | ~30 seconds                                  |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green + tsc clean
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                             | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | --------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 06-01-01 | 01   | 1    | UX-01       | grep      | `grep -c "setTimeout\|debounce" src/components/pos/pos-interface.tsx`                         | N/A         | ⬜ pending |
| 06-01-02 | 01   | 1    | UX-02       | unit      | `npx vitest run src/__tests__/cart-persist.test.ts`                                           | ❌ W0       | ⬜ pending |
| 06-01-03 | 01   | 1    | UX-04       | grep      | `grep -q "paymentOpen.*serialPickerProduct" src/components/pos/pos-interface.tsx`             | N/A         | ⬜ pending |
| 06-01-04 | 01   | 1    | UX-05       | unit      | `npx vitest run src/__tests__/barcode-ean.test.ts`                                            | ❌ W0       | ⬜ pending |
| 06-01-05 | 01   | 1    | UX-01       | grep      | `grep -q "debouncedSearch\|debounce" src/app/(dashboard)/inventory/stock-overview-client.tsx` | N/A         | ⬜ pending |
| 06-02-01 | 02   | 1    | UX-03       | grep      | `grep "cashReceived" prisma/schema.prisma`                                                    | N/A         | ⬜ pending |
| 06-02-02 | 02   | 1    | UX-06       | grep      | `grep "comment" src/components/pos/payment-dialog.tsx`                                        | N/A         | ⬜ pending |
| 06-02-03 | 02   | 1    | UX-07       | smoke     | `test -f src/app/(dashboard)/print/return/[id]/page.tsx`                                      | N/A         | ⬜ pending |
| 06-02-04 | 02   | 1    | UX-08       | grep      | `grep "isPending\|disabled" src/components/pos/payment-dialog.tsx`                            | N/A         | ⬜ pending |
| 06-02-05 | 02   | 1    | UX-09       | smoke     | `npx tsc --noEmit`                                                                            | N/A         | ⬜ pending |
| 06-03-01 | 03   | 2    | UX-10       | unit      | `npx vitest run src/__tests__/dashboard-metrics.test.ts`                                      | ❌ W0       | ⬜ pending |
| 06-03-02 | 03   | 2    | UX-11       | grep      | `grep -rl "breadcrumb" src/app/ \| wc -l`                                                     | N/A         | ⬜ pending |
| 06-03-03 | 03   | 2    | UX-12..15   | smoke     | `npx tsc --noEmit && npx vitest run`                                                          | N/A         | ⬜ pending |
| 06-03-04 | 03   | 2    | UX-14       | grep      | `grep -q "formatDuration" src/app/(dashboard)/shifts/[id]/shift-detail-client.tsx`            | N/A         | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/cart-persist.test.ts` — stubs for UX-02 (created in 06-01 Task 1)
- [ ] `src/__tests__/barcode-ean.test.ts` — stubs for UX-05 (created in 06-01 Task 1)
- [ ] `src/__tests__/dashboard-metrics.test.ts` — stubs for UX-10 (created in 06-03 Task 1)

---

## Manual-Only Verifications

| Behavior                   | Requirement | Why Manual                 | Test Instructions                         |
| -------------------------- | ----------- | -------------------------- | ----------------------------------------- |
| POS search doesn't lag     | UX-01       | Requires typing speed test | Type quickly in POS search, verify no lag |
| Cart survives page refresh | UX-02       | Requires browser state     | Add items, refresh page, verify cart      |
| EAN-13 auto-adds item      | UX-05       | Requires barcode scanner   | Scan EAN-13, verify item added            |
| Receipt shows cash/change  | UX-03       | Requires print preview     | Complete cash sale, check receipt         |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
