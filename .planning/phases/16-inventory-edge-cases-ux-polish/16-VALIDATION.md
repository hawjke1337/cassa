---
phase: 16
slug: inventory-edge-cases-ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (projects: unit + e2e) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts src/__tests__/e2e/ux-polish.e2e.test.ts -x` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts src/__tests__/e2e/ux-polish.e2e.test.ts -x`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | INV-01 | e2e | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | INV-02 | e2e | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | INV-03 | e2e | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | INV-04 | e2e | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-05 | 01 | 1 | INV-05..09 | e2e | `pnpm vitest run src/__tests__/e2e/inventory-edge-cases.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | UX2-02,06 | e2e | `pnpm vitest run src/__tests__/e2e/ux-polish.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | UX2-01,03,04,05 | unit | `pnpm vitest run src/__tests__/e2e/ux-polish.e2e.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | UX2-14,15 | manual | N/A — visual receipt layout | N/A | ⬜ pending |
| 16-03-02 | 03 | 2 | UX2-16,17 | manual | N/A — UI layout changes | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/e2e/inventory-edge-cases.e2e.test.ts` — stubs for INV-01..09 (category guard, audit MISSING, expected qty, StoreProductHistory, transfer validation)
- [ ] `src/__tests__/e2e/ux-polish.e2e.test.ts` — stubs for UX2-02, UX2-06 (double-click protection, idempotency-key)

*Existing infrastructure covers test framework setup (vitest.config.ts already configured).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Receipt IMEI/SN column | UX2-14 | Visual layout | Open receipt → verify IMEI column shows for serial items, dash for non-serial |
| Payment aggregation in receipt | UX2-15 | Visual layout | Create sale with 3 cash payments → verify single "Наличные" line in receipt |
| Print preview modal | UX2-10 | Visual interaction | Click print → verify modal appears before window.print() |
| Order blank format | UX2-12 | Visual layout | Open order → print blank → verify all fields present |
| POS responsive layout | UX2-08 | Visual at 768px | Resize to tablet → verify cart collapses, 2-column grid |
| Category grid in POS | UX2-17 | Visual interaction | Clear POS search → verify category grid appears |
| Catalog+Warehouse merge | UX2-16 | Navigation flow | Click "Товары" → verify tabs, "Продать" button |
| ARIA labels | UX2-09 | Accessibility audit | Inspect custom components for aria-label attributes |
| Inline validation | UX2-07 | Visual interaction | Submit invalid form → verify red borders + helper text |
| Toast retry button | UX2-05 | Visual interaction | Trigger error on sale → verify toast has "Повторить" button |
| Cart blocking during payment | UX2-04 | Visual interaction | Open PaymentDialog → verify cart is greyed out and non-interactive |
| Return AlertDialog | UX2-01 | Visual interaction | Click return → verify confirmation dialog appears |
| CloseShift discrepancy | UX2-03 | Visual interaction | Close shift with diff → verify AlertDialog with amount |
| Partial order payment warning | UX2-13 | Visual interaction | Pay less than remaining → verify warning shown |
| Trade-in single field | UX2-11 | Visual interaction | Open trade-in form → verify single price field |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
