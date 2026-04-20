# Phase 17 — Deferred Items

## Out-of-scope issues discovered during execution

### 1. Test DB migration drift (plan 17-02)

**Discovered:** 2026-04-20 during execution of plan 17-02
**Issue:** `pnpm exec dotenv -e .env.test -- pnpm prisma migrate deploy` fails on
pre-existing migration `20260414140035_varchar_limits_cascade_safety` with
`ERROR: relation "AuditLog" does not exist`.
**Impact:** Cannot apply the new `20260418_add_must_change_password` migration to
the test DB through `prisma migrate deploy`. Does NOT affect dev DB
(`astore_erp`), which applied all migrations cleanly.
**Reason for deferral:** Issue exists in test DB setup (schema-per-worker via
`src/__tests__/setup-db.ts` uses `prisma db push` according to v1.1 State
decisions; `migrate deploy` was never meant to be the test-DB flow).
`setup-db.ts` will re-derive schema from `schema.prisma` fresh per worker on
next e2e run, so the new `mustChangePassword` column will be picked up
automatically.
**Follow-up:** None required for plan 17-02 — seed-guard unit tests don't
connect to real DB (--dry-run). If any e2e test in Phase 17/18 needs the new
field, `db:test:create`+`db push`-based flow will deliver it.

### 2. Pre-existing typecheck errors (plan 17-01 scope)

**Discovered:** 2026-04-20 (pre-condition check)
**Issue:** `pnpm typecheck` fails with null-safety errors in
`motivation-*.ts`, `repairs.ts`, `trade-in.ts` (22 errors). These are
owned by plan 17-01 (BUILD-01).
**Impact:** Plan 17-02 explicitly declared `depends_on: []`, so these errors
do NOT block 17-02 execution. After plan 17-01 is completed, typecheck will
return to exit 0.
**Reason for deferral:** Outside 17-02 scope.
