---
phase: 3
slug: skhema-bd
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed) + prisma validate |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx prisma validate && npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx prisma validate && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + schema validates
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DB-01 | smoke | `npx prisma validate` | N/A | ⬜ pending |
| 03-01-02 | 01 | 1 | DB-07 | smoke | `npx prisma validate` | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | DB-02 | smoke | `npx prisma validate` | N/A | ⬜ pending |
| 03-02-02 | 02 | 1 | DB-03 | smoke | `npx prisma validate` | N/A | ⬜ pending |
| 03-02-03 | 02 | 1 | DB-04 | unit | `npx vitest run src/__tests__/soft-delete.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | DB-05 | smoke | `npx prisma validate` | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | DB-06 | integration | `npx vitest run src/__tests__/check-constraints.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/soft-delete.test.ts` — stubs for DB-04 ($extends filtering)
- [ ] `src/__tests__/check-constraints.test.ts` — stubs for DB-06 (CHECK constraint validation)

*Note: DB-01 (indexes), DB-02 (onDelete), DB-03 (PriceHistory FK), DB-05 (updatedAt), DB-07 (unique) verified by `prisma validate` — schema-level correctness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Index usage (no Seq Scan) | DB-01 | Requires EXPLAIN ANALYZE on real data | `EXPLAIN ANALYZE SELECT * FROM "Sale" WHERE "storeId" = X ORDER BY "createdAt" DESC LIMIT 20` |
| updatedAt auto-updates | DB-05 | Schema directive verification | Check `@updatedAt` present on all 51 models in schema |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
