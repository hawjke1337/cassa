---
phase: 5
slug: infrastruktura
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (installed, 112 existing tests) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (with new integration tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFRA-01 | unit | `npx vitest run --reporter=verbose` | ✅ (extend) | ⬜ pending |
| 05-02-01 | 02 | 1 | INFRA-02 | smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-02-02 | 02 | 1 | INFRA-03 | smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-02-03 | 02 | 1 | INFRA-08 | grep | `grep -r revalidatePath src/actions/ \| wc -l` | N/A | ⬜ pending |
| 05-03-01 | 03 | 2 | INFRA-04 | unit | `npx vitest run src/__tests__/reports-sql.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | INFRA-05 | smoke | `docker compose config --quiet` | N/A | ⬜ pending |
| 05-03-03 | 03 | 2 | INFRA-06 | grep | `grep poweredByHeader next.config.ts` | N/A | ⬜ pending |
| 05-03-04 | 03 | 2 | INFRA-07 | smoke | `npx prettier --check src/lib/db.ts` | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/reports-sql.test.ts` — stubs for INFRA-04 SQL aggregation

*Note: Most INFRA requirements are verified by grep/tsc/config checks, not unit tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error page renders on crash | INFRA-02 | Requires browser rendering | Navigate to invalid route or throw in component |
| Loading skeleton shows | INFRA-03 | Requires slow network | Add artificial delay, observe skeleton |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
