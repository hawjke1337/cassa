---
phase: 07-test-infrastructure-decimal-foundation
plan: 01
subsystem: testing
tags: [vitest, prisma, postgresql, e2e, schema-per-worker, prisma-pg]

requires:
  - phase: 05-infrastruktura
    provides: "Prisma 7 setup, PrismaPg adapter, base test directory layout"
provides:
  - "schema-per-worker E2E test framework with automatic isolation"
  - "TRUNCATE CASCADE between tests (no manual cleanup required)"
  - "Fixture helpers: createTestStore, createTestUser, createTestCategory, createTestProduct, createTestStoreProduct"
  - "`pnpm test:e2e` / `pnpm test:e2e:watch` scripts"
  - "`pnpm db:test:create` / `pnpm db:test:migrate` tooling"
  - "Example E2E test file as a template for new phases to copy"
affects:
  [
    08-order-sale-flow,
    09-race-conditions,
    10-reports-correctness,
    11-repair-as-sale,
    12-security-fixes,
    13-suppliers-debts,
    14-payroll,
    15-data-integrity,
    16-inventory-ux,
  ]

tech-stack:
  added: [dotenv-cli@11]
  patterns:
    - "schema-per-worker test isolation via PrismaPg `schema` option"
    - "libpq `options=-c search_path=...` for schema-scoped `prisma db push`"
    - "test fixtures accept Decimal fields as string to avoid float precision loss"

key-files:
  created:
    - .env.test
    - src/__tests__/setup-db.ts
    - src/__tests__/helpers/db.ts
    - src/__tests__/helpers/fixtures.ts
    - src/__tests__/e2e/example.e2e.test.ts
    - .planning/phases/07-test-infrastructure-decimal-foundation/deferred-items.md
  modified:
    - package.json
    - vitest.config.ts

key-decisions:
  - "Use `prisma db push --url=...?options=-c search_path=...` instead of `migrate deploy` because older migrations hardcode `public.TableName` references that break on non-default schemas"
  - "Use PrismaPg `{ schema: testSchema }` option rather than Prisma-specific `?schema=` URL param, because the latter is ignored by the pg-based adapter"
  - "Test fixtures accept money fields as `string` (e.g. `sellPrice: '1499.99'`) to avoid JS float precision loss"
  - "Unique identifiers in fixtures via `Date.now()`+counter — keeps tests independent without shared state"

patterns-established:
  - "E2E test template: `src/__tests__/e2e/<feature>.e2e.test.ts` + `import { db }` + `import fixtures` — no manual cleanup"
  - "`beforeEach` TRUNCATE via admin pg Pool with fully-qualified table names (no search_path dependency)"
  - "Separate Vitest projects `unit` (fast, no DB) and `e2e` (real Postgres, pool:forks)"

requirements-completed: [TEST2-01, TEST2-02]

duration: ~25min
completed: 2026-04-08
---

# Phase 7 Plan 01: E2E Test Infrastructure Summary

**Schema-per-worker E2E test framework with Prisma 7 + PrismaPg adapter, TRUNCATE CASCADE isolation, and reusable fixture helpers — fundament for all v1.1 phases.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-08T03:28Z
- **Completed:** 2026-04-08T03:40Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 2

## Accomplishments

- `pnpm test:e2e` runs 3/3 example tests against real `astore_erp_test` PostgreSQL
- Each Vitest worker gets isolated schema `test_w{VITEST_POOL_ID}` via PrismaPg `schema` option
- `TRUNCATE ... RESTART IDENTITY CASCADE` beforeEach — no manual cleanup in tests
- Fixture helpers provide `createTestStore/User/Category/Product/StoreProduct` with Decimal-safe string money fields
- Two consecutive `pnpm test:e2e` runs pass — proves cleanup lifecycle works
- `pnpm test:unit` (175 tests / 28 files) correctly excludes e2e files

## Task Commits

1. **Task 1: Test DB scripts + .env.test** — `0f68cff` (feat)
2. **Task 2: setup-db.ts + helpers/db.ts + helpers/fixtures.ts** — `660fa9f` (feat)
3. **Task 3: vitest.config.ts projects + example.e2e.test.ts** — `8e5200b` (feat)

## Files Created/Modified

- `.env.test` — `DATABASE_URL_TEST` + `DATABASE_URL` pointing at `astore_erp_test`, `NODE_ENV=test`
- `package.json` — added `typecheck`, `test:e2e`, `test:e2e:watch`, `db:test:create`, `db:test:migrate`; added `dotenv-cli@11` dev dep
- `src/__tests__/setup-db.ts` — schema-per-worker lifecycle (CREATE → db push → TRUNCATE beforeEach → DROP afterAll)
- `src/__tests__/helpers/db.ts` — PrismaClient with PrismaPg adapter scoped to `testSchema`
- `src/__tests__/helpers/fixtures.ts` — 5 idempotent factories, money fields as string
- `src/__tests__/e2e/example.e2e.test.ts` — 3 reference tests (persistence, TRUNCATE isolation, Decimal roundtrip)
- `vitest.config.ts` — new `e2e` project with `pool: 'forks'`, setupFiles, 30s/120s timeouts
- `.planning/phases/07-test-infrastructure-decimal-foundation/deferred-items.md` — pre-existing mock typecheck errors logged

## Decisions Made

- **`prisma db push` not `migrate deploy`** — older migrations (`20260316170041_add_imei_serial_tracking`) contain hardcoded `public."WarrantyClaim"` DDL references that fail when applied to a non-default schema. `db push` regenerates DDL from `schema.prisma` at runtime without schema-qualified names.
- **PrismaPg `{ schema }` option over `?schema=` URL param** — the `?schema=` parameter is a Prisma driver-adapter idiom that `PrismaPg` (pg-based) silently ignores. The `{ schema: 'test_w0' }` adapter option sets `search_path` on every pg connection.
- **libpq `options=-c search_path=...` for `db push`** — Prisma CLI doesn't expose a schema flag, but it passes through standard libpq connection URL `options`, which Postgres honors for DDL.
- **Money fields as `string` in fixtures** — Prisma accepts strings for `Decimal` columns without float roundtrip. `sellPrice: '1499.99'` persists exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `dotenv-cli` tool**

- **Found during:** Task 1 (adding `test:e2e` script that uses `dotenv -e .env.test --`)
- **Issue:** Plan requires `dotenv -e .env.test -- …` syntax but `dotenv-cli` was not installed
- **Fix:** `pnpm add -D dotenv-cli` (installed v11.0.0)
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Committed in:** `0f68cff`

**2. [Rule 3 - Blocking] `prisma migrate deploy` failed on custom schemas**

- **Found during:** Task 3 (first `pnpm test:e2e` execution)
- **Issue:** Migration `20260316170041_add_imei_serial_tracking` contains hardcoded `"public"."WarrantyClaim"` DDL. When applied to `test_w0`, the `ALTER TABLE "WarrantyClaim"` statement fails because that table doesn't exist in `test_w0` yet (created via CREATE TABLE without schema prefix in the same migration, landing in the custom schema, while ALTER uses public-qualified name).
- **Fix:** Switched `execSync("prisma migrate deploy")` → `execSync("prisma db push --accept-data-loss --url=...?options=-c search_path=test_w0")`. Added comment explaining rationale.
- **Files modified:** `src/__tests__/setup-db.ts`
- **Committed in:** `8e5200b`

**3. [Rule 1 - Bug] PrismaPg ignored `?schema=` URL param**

- **Found during:** Task 3 (`TRUNCATE between tests` assertion failed — saw stale data)
- **Issue:** The `?schema=test_w0` query param in the connection string is a Prisma-specific idiom that `PrismaPg` (wrapping node-postgres) doesn't parse, so all client queries ran against `public` schema instead of the worker schema.
- **Fix:** Pass `{ schema: testSchema }` as the second constructor argument to `PrismaPg`. Also refactored `setup-db.ts` to export `baseConnectionString` + `testSchema` instead of a composed `databaseUrl`.
- **Files modified:** `src/__tests__/setup-db.ts`, `src/__tests__/helpers/db.ts`
- **Committed in:** `8e5200b`

**4. [Rule 3 - Blocking] Vitest 4 removed `test.poolOptions`**

- **Found during:** Task 3 (deprecation warning)
- **Issue:** Plan-provided vitest config uses `poolOptions: { forks: { singleFork: false } }` which is deprecated and ignored in Vitest 4.
- **Fix:** Flattened to `forks: { singleFork: false }` at project test-config top level.
- **Files modified:** `vitest.config.ts`
- **Committed in:** `8e5200b`

**5. [Rule 1 - Bug] `createTestUser` planned `email` field but schema uses `login`**

- **Found during:** Task 2 (writing fixtures)
- **Issue:** Plan spec says `createTestUser` default email, but Prisma `User` model has `login` (unique), no `email` column.
- **Fix:** Fixture accepts `login`, default `test-user-{uniq}`. Example test asserts `found?.login`.
- **Files modified:** `src/__tests__/helpers/fixtures.ts`, `src/__tests__/e2e/example.e2e.test.ts`
- **Committed in:** `660fa9f`, `8e5200b`

---

**Total deviations:** 5 auto-fixed (3 Rule 3 blocking, 2 Rule 1 bug)
**Impact on plan:** All necessary for correctness. Final architecture is actually cleaner than the plan's original `databaseUrl` composition because it decouples schema-scoping from URL parsing. The `db push` decision avoids a class of migration-compatibility bugs going forward.

## Deferred Issues

Pre-existing typecheck errors in `src/__tests__/confirm-receive-integration.test.ts` (4 × `TS2339 mockResolvedValue`) are out of scope for 07-01 — they concern legacy mock-based tests that should be migrated to the new E2E pattern in a later task. Logged in `deferred-items.md`.

## Issues Encountered

- **Initial test_w0 had zero tables, yet Prisma saw 1 user:** Indicated `db push` created tables in `public` and Prisma client was also hitting `public` (bypassing `?schema=`). Root cause: PrismaPg ignores `?schema=`. Fixed by adapter option.
- **Stale `public` schema from prior failed runs:** Manually dropped and recreated `public` once. Subsequent runs clean up via `afterAll`.

## User Setup Required

None — local Postgres on `localhost:5432` with user `astore` was already configured from v1.0.

## Next Phase Readiness

- **Ready for 07-03 hotspot migration**: E2E tests can now verify Decimal arithmetic against real Postgres.
- **Pattern available for phases 8-16**: Copy `example.e2e.test.ts`, add `import { db }` and fixtures, write assertions. No boilerplate.
- **07-02 decimal-foundation** was already executed before this plan (visible in git log). When 07-03 migrates hotspot files, those tests should live in `src/__tests__/e2e/<feature>.e2e.test.ts` using this framework.
- **Concern:** `prisma db push` bypasses migration history — test DB will diverge from prod DB structure if `schema.prisma` is ahead of applied migrations. This is acceptable for tests (DDL is regenerated each run) but worth noting when debugging "works locally, fails in CI" issues.

## Self-Check: PASSED

**Files verified:**

- FOUND: .env.test
- FOUND: src/**tests**/setup-db.ts
- FOUND: src/**tests**/helpers/db.ts
- FOUND: src/**tests**/helpers/fixtures.ts
- FOUND: src/**tests**/e2e/example.e2e.test.ts
- FOUND: .planning/phases/07-test-infrastructure-decimal-foundation/deferred-items.md

**Commits verified:**

- FOUND: 0f68cff (Task 1)
- FOUND: 660fa9f (Task 2)
- FOUND: 8e5200b (Task 3)

**Acceptance criteria:**

- `pnpm test:e2e` → 3/3 passing (verified 2× consecutive)
- `pnpm test:unit` → 175/175 passing, 0 e2e files picked up
- `.env.test` contains literal `DATABASE_URL_TEST=postgresql://...`
- `package.json` has `test:e2e`, `typecheck`, `test:unit` scripts
- All fixture exports verified (4/4 exports found)

---

_Phase: 07-test-infrastructure-decimal-foundation_
_Completed: 2026-04-08_
