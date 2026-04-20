---
phase: 17-build-seed-safety
plan: 02
subsystem: infra
tags: [prisma, seed, security, tdd, bcryptjs, vitest, migration]

# Dependency graph
requires:
  - phase: 12-security-fixes-roles-ui
    provides: PERMISSIONS and ROLE_PRESETS constants (src/lib/permissions-list.ts) — reused by seedProduction to create authoritative permissions + role presets.
  - phase: 07-test-infrastructure
    provides: vitest projects (unit/e2e), setup-decimal-matcher.ts — extended to include prisma/__tests__/**.
provides:
  - "prod-safe prisma/seed.ts with NODE_ENV guard (refuses production run without SEED_ALLOW_PROD=true)"
  - "seedProduction() branch — minimal bootstrap (permissions + roles + 1 admin, NO stores/products/demo-users)"
  - "User.mustChangePassword Boolean @default(false) schema field + migration with backfill"
  - "generated temp-password admin bootstrap (16-hex) with mustChangePassword=true"
  - "seed-guard unit test suite (4 cases) via spawnSync — verifies guard behavior without DB"
  - "--dry-run CLI flag — exit 0 after guard without DB connection (enables fast unit tests)"
affects:
  - 18-secure-deploy-foundation
  - 18-SEC3-force-password-change-ui
  - deploy-production-bootstrap

# Tech tracking
tech-stack:
  added:
    - "node:crypto randomBytes for temp-password generation"
  patterns:
    - "Branched seed.ts: seedProduction vs seedDevelopment — prod minimal, dev full fixtures"
    - "NODE_ENV guard pattern: early process.exit(1) BEFORE resource allocation (Pool/PrismaClient)"
    - "--dry-run flag for unit-testable CLI scripts (exit after arg/env checks, before IO)"
    - "Idempotent admin bootstrap: skip if login='admin' exists (NOT overwriting prod admin)"
    - "vitest unit project extended with prisma/__tests__/**/*.test.ts"

key-files:
  created:
    - "prisma/__tests__/seed-guard.test.ts (4 tests via spawnSync)"
    - "prisma/migrations/20260418_add_must_change_password/migration.sql"
    - ".planning/phases/17-build-seed-safety/deferred-items.md"
  modified:
    - "prisma/seed.ts (added guard + seedProduction + seedDevelopment wrapping; ~160 lines)"
    - "prisma/schema.prisma (User.mustChangePassword Boolean @default(false))"
    - "vitest.config.ts (unit project include extended)"

key-decisions:
  - "Guard exits BEFORE Pool/PrismaClient creation — предотвращает случайный коннекшн к проду"
  - "bash-style --dry-run флаг для тестируемого guard без DB роундтрипа"
  - "Temp-password формат admin-{8bytes hex = 16 chars} — балансирует длину и читаемость"
  - "console.error/exit(1) вместо throw Error — чистый stderr без stack trace для оператора"
  - "seedProduction НЕ создаёт 'Старший продавец' роль — это dev-only демо-роль"
  - "Admin идемпотентность через existingAdmin check — повторный run не перезаписывает prod admin"

patterns-established:
  - "CLI script guard: env check → flag check → resource allocation → work. Unit-testable через spawnSync + --dry-run."
  - "Seed branching: single entrypoint main() → isProd branch → dedicated function. Dev-logic не трогается в prod-рефакторинге."
  - "First-run admin bootstrap: generated one-time password + mustChangePassword flag → UI force-change flow (deferred Phase 18)."

requirements-completed:
  - BUILD-02

# Metrics
duration: 9min
completed: 2026-04-20
---

# Phase 17 Plan 02: Prod-safe seed guard + admin bootstrap Summary

**Prisma seed.ts защищён от случайного уничтожения prod-данных через NODE_ENV guard; SEED_ALLOW_PROD=true создаёт только permissions + roles + 1 admin с generated temp-password и mustChangePassword=true — фундамент для force-change-on-first-login UI (Phase 18).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-20T12:06:39Z
- **Completed:** 2026-04-20T12:15:17Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified/created:** 6

## Accomplishments

- **Prod-safe guard:** `NODE_ENV=production` без `SEED_ALLOW_PROD=true` → exit 1 с явным stderr-сообщением "Refusing to seed in production". Запуск выполняется ДО создания Pool/PrismaClient — прод-БД даже не открывается при случайном запуске.
- **Minimal prod bootstrap:** `seedProduction()` создаёт ТОЛЬКО 62 permissions + 7 role presets + 1 admin. Никаких магазинов, товаров, demo-пользователей — они остаются dev-only fixtures.
- **Secure admin bootstrap:** admin создаётся с `mustChangePassword=true` и сгенерированным одноразовым паролем (`admin-{16hex}`). Пароль выводится в stdout ОДИН РАЗ с явным warning-блоком (не попадает в structured logs/файлы). Owner role (`Владелец`) назначается глобально (storeId=null).
- **Schema migration applied:** `User.mustChangePassword Boolean @default(false)` с backfill UPDATE — все существующие users получают `false` (не триггерят force-change случайно).
- **TDD верификация:** 4 unit теста через `child_process.spawnSync` — RED в Задаче 1, GREEN в Задаче 2. Тесты запускают реальный `seed.ts` с подменённым env и флагом `--dry-run`, проверяют exit code + stderr message без подключения к БД.
- **Dev workflow не сломан:** `seedDevelopment()` содержит всю прежнюю логику 737 строк (магазины, товары, категории, demo-пользователи, motivation groups/schemes, document templates) без изменений.

## Task Commits

Each task was committed atomically (TDD-pattern: RED → GREEN):

1. **Задача 1: TDD RED — seed-guard test + User.mustChangePassword schema** — `2f197ef` (test)
   - Создан `prisma/__tests__/seed-guard.test.ts` (4 cases, все RED)
   - Добавлено поле `User.mustChangePassword Boolean @default(false)` в `prisma/schema.prisma`
   - Миграция `20260418_add_must_change_password/migration.sql` — ALTER TABLE + backfill
   - `vitest.config.ts`: unit project include расширен на `prisma/__tests__/**/*.test.ts`
   - `.planning/phases/17-build-seed-safety/deferred-items.md` — залогированы out-of-scope issues

2. **Задача 2: GREEN — prod-safe guard + admin bootstrap** — `c5feae0` (feat)
   - `prisma/seed.ts` рефакторен: NODE_ENV guard → --dry-run check → branched prod/dev
   - `seedProduction(prisma)`: permissions + roles + admin (generated password + mustChangePassword=true)
   - `seedDevelopment(prisma)`: все прежние 737 строк dev-логики (без изменений)
   - `pool.end()` перенесён в `main()` finally-блок — гарантия закрытия при exception
   - RED тесты → GREEN (4/4 pass)

**Plan metadata:** _(will be created in final_commit step)_

## Files Created/Modified

### Created

- `prisma/__tests__/seed-guard.test.ts` — 4 unit тестов seed-guard через spawnSync (`exits with code 1 in production without SEED_ALLOW_PROD`, `passes guard in production WITH SEED_ALLOW_PROD=true (--dry-run)`, `passes guard in non-production environments (NODE_ENV=test)`, `passes guard in development environment`).
- `prisma/migrations/20260418_add_must_change_password/migration.sql` — ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false + backfill UPDATE.
- `.planning/phases/17-build-seed-safety/deferred-items.md` — out-of-scope issues лог (test DB migration drift, pre-existing 17-01 typecheck errors).

### Modified

- `prisma/seed.ts` — добавлен NODE_ENV guard (exits before Pool creation), --dry-run флаг, branched prod/dev, `seedProduction(prisma)` функция (~90 строк), вся прежняя логика инкапсулирована в `seedDevelopment(prisma)` без изменений семантики. Импорт `randomBytes` from `node:crypto` добавлен. `pool.end()` перенесён в main() finally.
- `prisma/schema.prisma` — добавлено поле `mustChangePassword Boolean @default(false)` в `model User` после `permissionsVersion Int @default(1)`.
- `vitest.config.ts` — unit project `include` расширен с `src/**/*.test.ts` до включая `prisma/__tests__/**/*.test.ts` (иначе seed-guard.test.ts не запускается vitest'ом).

## Decisions Made

1. **Guard срабатывает ДО создания Pool/PrismaClient** — если guard не срабатывает корректно и коннекшн создаётся, риск случайных DDL на прод-БД. Early exit минимизирует blast-radius (CONTEXT.md §"NODE_ENV guard mechanism" явно требует этого).

2. **`--dry-run` CLI флаг** — позволяет unit-тестам проверять guard без настоящего коннекшна к БД. Тесты запускаются через `spawnSync` + env manipulation + `--dry-run` аргумент, validating `exit code` и `stderr`. Альтернатива (in-process mock `process.exit`) отклонена: более хрупко, не покрывает реальный spawn flow.

3. **Temp-password формат `admin-{8 bytes hex}`** — 16 hex-chars (64 бит энтропии) после префикса `admin-` для читаемости при копировании. Префикс даёт оператору подсказку "это временный пароль". Альтернативы: 16 байт hex (64 chars — слишком длинно), human-readable (easier shoulder-surf). bcryptjs cost=10 consistent с остальным кодом (src/lib/auth.ts).

4. **console.error + process.exit(1) вместо throw Error** — чистый stderr без stack trace для оператора (CONTEXT.md §"NODE_ENV guard mechanism"). Оператор в SSH-сессии видит понятный русско-английский message, а не трассу через Node.js runtime.

5. **`seedProduction` НЕ создаёт "Старший продавец" роль** — эта роль (лежит вне `ROLE_PRESETS`) создавалась в прежнем seed как дополнительная демо-роль. Prod-admin должен иметь только authoritative роли из `ROLE_PRESETS`; "Старший продавец" — dev-демо на поверх (оператор может создать её вручную в UI Settings → Roles после первого входа).

6. **Идемпотентность admin bootstrap** — если `admin` login уже существует, `seedProduction` НЕ перезаписывает его и возвращается без изменений. Это защита: повторный `SEED_ALLOW_PROD=true pnpm prisma db seed` не "затирает" пароль existing admin'а (например, если оператор случайно запустил seed второй раз после первого bootstrap). Permissions/roles по-прежнему `upsert` — они authoritative reference data, их обновление безопасно.

7. **`pool.end()` в main() finally** — при прежней структуре `pool.end()` был в конце `main()`, но если `seedProduction`/`seedDevelopment` выбрасывает исключение, коннекшн не закрывался. Перенос в finally гарантирует cleanup даже при ошибках.

8. **Migration backfill через `UPDATE ... WHERE "mustChangePassword" IS NOT DISTINCT FROM false`** — DEFAULT false покрывает fresh inserts и new columns, explicit UPDATE — явный аудит-след что ни один existing user не получил force-change флаг случайно. Safer-чем полагаться только на DEFAULT.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Расширение vitest.config.ts для prisma/__tests__**
- **Found during:** Task 1 (RED test creation)
- **Issue:** Vitest `unit` project include был `src/**/*.test.ts` — новый файл `prisma/__tests__/seed-guard.test.ts` не запускался (тест-раннер его не видел). Это блокировало TDD workflow.
- **Fix:** Расширен `include` в `vitest.config.ts` до `["src/**/*.test.ts", "prisma/__tests__/**/*.test.ts"]`.
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm vitest run --project unit prisma/__tests__/seed-guard.test.ts` теперь находит и запускает тесты (RED в Task 1, GREEN в Task 2).
- **Committed in:** `2f197ef` (Task 1 commit)

**2. [Rule 3 - Blocking] --dry-run CLI флаг**
- **Found during:** Task 1 test design
- **Issue:** Unit тесты через spawnSync не должны коннектиться к БД (хрупко, медленно, требует DB). Без --dry-run real seed.ts тянется к БД после guard и падает по непредсказуемой причине (DB not exists, constraint violation, и т.д.) — тесты зависели от state БД.
- **Fix:** Добавлен `process.argv.includes("--dry-run")` check сразу после guard в seed.ts — `[seed --dry-run] guard passed` + `process.exit(0)`. Тесты используют этот флаг для isolation.
- **Files modified:** `prisma/seed.ts` (добавлено 4 строки)
- **Verification:** `NODE_ENV=development npx tsx prisma/seed.ts --dry-run` → exit 0 без DB; тесты guard в development/test env passes.
- **Committed in:** `c5feae0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (оба Rule 3 — Blocking)
**Impact on plan:** Обе deviations необходимы для TDD workflow. Vitest config extension — без неё тесты physically не запускались. --dry-run флаг — изоляция guard-unit-тестов от БД (план упоминал флаг как "опционально, для удобства тестов" в Task 2 action пункт 4 — по факту это обязательно). Scope не расширен.

## Issues Encountered

1. **Test DB migration drift** — `pnpm exec dotenv -e .env.test -- pnpm prisma migrate deploy` падает на pre-existing миграции `20260414140035_varchar_limits_cascade_safety` с ошибкой `relation "AuditLog" does not exist`. Это out-of-scope issue (test DB setup v1.1). Не блокирует 17-02: unit тесты seed-guard НЕ подключаются к БД (используют --dry-run); dev DB migration применилась успешно. Залогирована в `deferred-items.md`.

2. **Pre-existing typecheck errors в 17-01 scope** — `pnpm typecheck` продолжает падать с null-safety errors в `motivation-*.ts`, `repairs.ts`, `trade-in.ts`. Это не в scope 17-02 (plan явно `depends_on: []`). После 17-01 typecheck зелёный. Залогирована в `deferred-items.md`.

3. **Concurrent commit от external process** — между моими commits `2f197ef` (17-02 Task 1) и `c5feae0` (17-02 Task 2) появился commit `c562015 fix(17-01): throw on missing shift + fixtures extensions + delete stale mocks`. Вероятно, другая сессия / автомат закоммитил изменения 17-01 work-in-progress. Мои 17-02 commits чистые и изолированы.

## User Setup Required

None для plan 17-02 — все изменения self-contained в коде и миграциях.

**Для будущего production deploy (Phase 18):**
1. При первом bootstrap'е production DB: `SEED_ALLOW_PROD=true pnpm prisma db seed` — один раз, записать temp-password из stdout.
2. При первом входе admin'а — UI `/settings/password` должен force-change (deferred в Phase 18 SEC3).

## Next Phase Readiness

### Готово для Phase 17 Plan 03 (BUILD-03)

- `prisma/seed.ts` prod-safe ✅
- `prisma/__tests__/seed-guard.test.ts` GREEN ✅
- Schema migration applied к dev DB ✅
- `mustChangePassword` поле доступно через regenerated Prisma client ✅
- `User.mustChangePassword` готов для Phase 18 middleware/session hook ✅

### Готово для Phase 18 (SEC3 force-change UI)

- Schema field `User.mustChangePassword` available.
- Admin bootstrap pattern established (temp-password + flag).
- Required integration: NextAuth session callback — exposure `session.user.mustChangePassword` для middleware redirect.

### Blockers / Concerns

- **17-01 не выполнен** — typecheck по-прежнему красный в unrelated файлах. Plan 17-02 independent (`depends_on: []`), но Phase 17 overall success требует 17-01 + 17-03 для exit 0 typecheck+build.
- **Test DB migration state** — если Phase 18 добавит e2e-тесты использующие `mustChangePassword`, потребуется сначала восстановить test DB через `pnpm db:test:create` + fresh `db push` (out-of-scope issue в deferred-items.md).

## Self-Check: PASSED

Verification checklist:

- [x] `prisma/__tests__/seed-guard.test.ts` exists (4 tests, all GREEN)
- [x] `prisma/migrations/20260418_add_must_change_password/migration.sql` exists
- [x] `prisma/schema.prisma` contains `mustChangePassword Boolean @default(false)`
- [x] `prisma/seed.ts` contains SEED_ALLOW_PROD guard + seedProduction + seedDevelopment
- [x] Prisma client regenerated — `mustChangePassword` in `src/generated/prisma/models/User.ts`
- [x] Dev DB migration applied cleanly
- [x] Manual integration test: prod-seed создаёт 62 perms + 7 roles + 1 admin (idempotent при повторе)
- [x] Commit `2f197ef` exists (Task 1 RED)
- [x] Commit `c5feae0` exists (Task 2 GREEN)

---
*Phase: 17-build-seed-safety*
*Completed: 2026-04-20*
