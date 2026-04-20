# Phase 17: Build & Seed Safety - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Кодовая база собирается чисто (0 TypeScript-ошибок, 0 build-warnings), а `prisma/seed.ts` физически не может уничтожить production-данные случайной командой. Три требования: BUILD-01 (typecheck ok), BUILD-02 (prod-safe seed + admin bootstrap), BUILD-03 (чистый `pnpm build`).

**Out of scope этой фазы:** Docker/deploy (Phase 18), observability (Phase 19), lint cleanup 174 issues (deferred в backlog), UI force-password-change flow (deferred в Phase 18 SEC3 или отдельный план).

</domain>

<decisions>
## Implementation Decisions

### Фикс 22 null-ошибок в motivation-*

- **Стратегия:** `filter(a => a.user !== null)` на входе каждого handler (getAssignmentsForStore, calculateForScheme, simulateEarnings, и т.д.) — до любых `.map()` или `.user.id`
- **Поведение:** assignment-ы с удалённым user (user=null) молча отбрасываются — не попадают в расчёт мотивации
- **Бизнес-смысл:** удалённый сотрудник не должен получать зарплату/мотивацию. Payroll-история сохраняется отдельно; audit trail не требуется в этой фазе.
- **НЕ использовать** non-null assertion (`a.user!`) — схема намеренно допускает null через `onDelete: SetNull`; `!` упадёт в runtime при удалении User
- **Затронутые файлы:** motivation-assignments.ts (7), motivation-calculation.ts (6), motivation-schemes.ts (3), motivation-simulation.ts (6), repairs.ts:740-743 (4)

### Фикс `string | null` → `string | undefined` (repairs.ts:635, trade-in.ts:181)

- **Приём:** inline `value ?? undefined` перед передачей в Prisma update/create
- **Затронутые файлы:** `src/actions/repairs.ts:635`, `src/actions/trade-in.ts:181` (возможно больше при полной проверке)
- **Семантика сохранена:** Prisma `undefined` = "не трогать поле", `null` = "явно очистить". Было бы неверно заменить на `null`.

### Удаление stale mock-based integration tests

- **Удалить:** `confirm-receive-integration.test.ts`, `create-return-integration.test.ts` и все другие тесты использующие `vi.mocked(db)` на Prisma 7
- **Обоснование:** моки не ловят race conditions, raw SQL, constraint violations. Это root cause 100 багов из v1.1 аудита. Покрытие заменено `e2e/*.e2e.test.ts` (22 файла, real DB).
- **НЕ удалять:** unit-тесты без Prisma-моков (validation, cart-persist, compute-per-unit-discount, etc.) — они покрывают чистую логику
- **НЕ удалять:** e2e-real-db.test.ts — починить ошибку (line 194: Payment create syntax) — это реальный e2e тест

### Починка e2e test fixtures (schema drift)

- **ux-polish.e2e.test.ts:64** — `role: "SELLER"` передаётся в `createTestUser`, fixture не принимает `role` → добавить `role?: string` в override signature, применить через User.role если поле есть в schema, или через RoleAssignment
- **inventory-edge-cases.e2e.test.ts:125** — `identifierType` в createTestCategory → добавить в fixture schema
- **Claude's discretion:** минимальные правки fixtures без рефакторинга e2e тестов

### Prod-safe seed.ts — содержимое в prod-режиме

- **SEED_ALLOW_PROD=true создаёт ТОЛЬКО:** permissions (из PERMISSIONS list), role presets (из ROLE_PRESETS), один admin user с `mustChangePassword=true`
- **НЕ создаётся в prod:** магазины (seed-store-central/mega/south), демо-пользователи (seller/senior), категории, бренды, товары, поставщики — это dev-only fixtures
- **Dev-режим** (NODE_ENV !== 'production' OR не задан): полный seed как сейчас — всё содержимое остаётся доступным

### Admin bootstrap в prod-seed

- **Механизм:** force-change-on-first-login через новое поле `User.mustChangePassword Boolean @default(false)`
- **Phase 17 делает:**
  - Prisma migration: добавить `mustChangePassword` в User с default false, backfill UPDATE всех existing=false
  - seed.ts в prod-режиме: создаёт admin с фиксированным temp-паролем (например, `admin-temp-CHANGE-ME-<rand8>`) и `mustChangePassword=true`, печатает в stdout один раз с явным варнингом
  - stdout-вывод: `⚠️ FIRST-RUN ADMIN CREATED. Login: admin. Temp password: <value>. YOU MUST CHANGE IT ON FIRST LOGIN.`
- **UI force-flow (deferred в Phase 18 или отдельный план):**
  - Middleware/layout проверяет `session.user.mustChangePassword` → redirect на `/settings/password` до любой другой страницы
  - Страница смены пароля сбрасывает флаг после успешной смены
- **НЕ в Phase 17:** UI компоненты. Phase 17 только кладёт фундамент (schema + seed + flag).

### NODE_ENV guard mechanism

- **Ранний exit в первых 10 строках main():**
  ```ts
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PROD !== 'true') {
    console.error('\n❌ Refusing to seed in production without SEED_ALLOW_PROD=true')
    console.error('   To intentionally bootstrap production, run: SEED_ALLOW_PROD=true pnpm prisma db seed\n')
    process.exit(1)
  }
  ```
- **НЕ throw Error** — чистый stderr без stack trace, читаемо оператору
- **НЕ readline prompt** — блокирует CI/docker exec -T

### BUILD-03 scope: чистый build

- **Что покрывается в Phase 17:**
  - `pnpm typecheck` → exit 0 (0 ошибок)
  - `pnpm build` → exit 0 (Next.js 16 Turbopack production bundle успешно собирается)
- **Что НЕ покрывается в Phase 17:**
  - Lint errors (116) и warnings (58) — preserved в backlog как "Lint Cleanup" (кандидат в v1.3 или отдельный план в Phase 19)
  - ESLint `no-explicit-any` по всему codebase — требует осторожной типизации Prisma adapter, server actions, auth middleware — риск регрессий

### TDD для Phase 17

- **TDD применяется только для seed-guard** (BUILD-02):
  - Тест-ожидание: `seed.test.ts` → spawn `NODE_ENV=production pnpm prisma db seed` без SEED_ALLOW_PROD → exit code 1, stderr содержит "Refusing"
  - Тест-ожидание: `SEED_ALLOW_PROD=true NODE_ENV=production pnpm prisma db seed` → создаёт только 1 admin + permissions + roles, НЕ создаёт stores/products
- **TDD НЕ применяется для null-фиксов** — tsc верифицирует type-safety; повторный запуск `pnpm typecheck` достаточен

### CI gate — предотвращение регрессий

- **husky pre-push hook:** запускает `pnpm typecheck` (не build — слишком медленно для каждого push)
- **Создать:** `.husky/pre-push` с командой (husky уже подключён, `"prepare": "husky"` в package.json)
- **GitHub Actions CI/CD** — отложено на Phase 18 (там деплой, логичнее добавить вместе с прод-workflow)

### Commit/PR стратегия

- **Claude's discretion** (пользователь явно делегировал): 3 plan-commit'а по GSD pattern
  - Plan 17-01 commit: fix typecheck errors (null guards + null→undefined + e2e fixture drift + delete stale mocks)
  - Plan 17-02 commit: seed prod-guard + User.mustChangePassword migration + admin bootstrap + seed.test.ts
  - Plan 17-03 commit: husky pre-push hook + final verification
- Каждый commit — атомарный и зелёный (typecheck+build passes)

### Claude's Discretion

- Точный сценарий fix fixtures.ts (`createTestUser role` — если User.role enum есть или через Role/Permission relation)
- Формат сгенерированного temp-password (16-byte hex из crypto.randomBytes vs shorter human-readable)
- Точный формат stdout-сообщения (эмодзи vs plain, русский vs английский)
- Структура seed.test.ts (shell-based spawn vs in-process test)
- Именование файлов миграции (стандартный Prisma timestamp)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования и roadmap

- `.planning/REQUIREMENTS.md` §"Build & Seed Safety (BUILD)" — BUILD-01 (0 typecheck errors), BUILD-02 (prod-safe seed), BUILD-03 (clean build)
- `.planning/ROADMAP.md` §"Phase 17" — Success Criteria 1-4 (typecheck exit 0, build exit 0, seed refuses prod, seed with flag creates only admin)
- `.planning/PROJECT.md` §"Current Milestone: v1.2 Production Hardening" — общие цели milestone, нельзя ломать v1.0/v1.1

### Prisma и схема

- `prisma/schema.prisma` — модель User (будет изменена: + `mustChangePassword Boolean`), MotivationAssignment (`user User?` с `onDelete: SetNull` — обоснование filter-null-strategy)
- `prisma/seed.ts` — текущая реализация (737 строк, 44 upsert/create), будет рефакторена с NODE_ENV guard

### Конфигурация

- `package.json` — husky подключён (`"prepare": "husky"`), `postinstall: prisma generate` (добавлен 2026-04-18), scripts для test/typecheck/build
- `.env.example` — шаблон env-переменных (будет обновлён с SEED_ALLOW_PROD в докментации Phase 18)

### Тесты

- `src/__tests__/helpers/fixtures.ts` — `createTestUser`, `createTestStore`, `createTestCategory`, `createTestProduct`, `createTestStoreProduct` — fixtures нужны для e2e, будут минимально расширены (role, identifierType)
- `src/__tests__/e2e/*.e2e.test.ts` (22 файла) — purpose: замена mock-based integration tests, real DB coverage

### Проектные инструкции

- `CLAUDE.md` §"Стандарт качества" — НЕ MVP, production-grade, TDD обязательно
- `CLAUDE.md` §"При НАПИСАНИИ КОДА" — `/tdd` тесты первыми, `/verify` build+lint+tests после кода
- Memory: `feedback_raw_sql_testing.md` — raw SQL обходит Prisma, моки не ловят constraints, нужны E2E (подтверждает решение удалять stale mocks)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/lib/permissions-list.ts` — `PERMISSIONS` и `ROLE_PRESETS` константы — seed prod-режим переиспользует для создания ролей
- `src/lib/auth.ts` — bcryptjs hash используется при создании users (seed повторяет паттерн с `hashSync`)
- `bcryptjs` в package.json — уже есть для password hashing
- `src/generated/prisma/client` — regenerated Prisma client (после недавнего `postinstall: prisma generate`)
- `.husky/` — husky уже инициализирован для lint-staged, добавим pre-push рядом
- `src/__tests__/helpers/fixtures.ts` — centralized test fixtures, минимальные правки

### Established Patterns

- **E2E тесты на real DB:** `.env.test` + `astore_erp_test` database (`db:test:create`, `db:test:migrate` scripts), vitest project "e2e" — паттерн уже установлен, 22 файла в src/__tests__/e2e/
- **Prisma migrations:** `prisma/migrations/YYYYMMDD_name/migration.sql` — последняя `20260414_inventory_edge_cases`
- **Server actions** (`src/actions/*.ts`): `"use server"` + `requirePermission()` + Prisma query + return — pattern для null-fix правок
- **seed.ts console.log patterns:** `console.log("Section...")`, `console.log(\`  N items\`)` — сохранить структуру при рефакторинге

### Integration Points

- `next-auth v5 beta` (`src/lib/auth.ts`) — при добавлении `mustChangePassword` в User нужно exposing через JWT callback в session.user (для будущей Phase 18 middleware)
- `prisma/seed.ts` подключается через `"prisma": { "seed": "npx tsx prisma/seed.ts" }` в package.json — изменения self-contained
- `src/lib/db.ts` — PrismaClient singleton с PrismaPg adapter; seed создаёт свой instance отдельно (корректно)
- Migration execution flow: `pnpm prisma migrate deploy` (prod) vs `pnpm prisma migrate dev` (локально) — оба работают с новой `mustChangePassword` миграцией

</code_context>

<specifics>
## Specific Ideas

- "У тебя есть контекст для выполнения всех задач" — пользователь делегировал commit-структуру и мелкие implementation-решения Claude (применяется к: формат temp-password, содержимое stdout, структура seed.test.ts, наименование migration file)
- Пользователь выбрал **force-change-on-first-login** (а не generate+stdout как рекомендовалось) — индикация что безопасность паролей важнее простоты onboarding'а
- Прецедент из v1.1: "моки пропустили 100 багов" — усиливает решение удалить mock-based tests (memory: feedback_raw_sql_testing.md)

</specifics>

<deferred>
## Deferred Ideas

- **Lint cleanup (174 issues: 116 errors + 58 warnings)** — в основном `@typescript-eslint/no-explicit-any` в src/lib/db.ts, auth.ts, audit.ts, stock-helpers.ts. Требует отдельного плана, риск регрессий (Prisma adapter types, NextAuth callback signatures). Кандидат в backlog v1.3 или финальный план Phase 19.
- **UI force-password-change flow** — страница `/settings/password` с обязательным полем current password, middleware/layout-check на `mustChangePassword` флаг. Deferred в Phase 18 (SEC3) где уже работа с secure cookies + NextAuth, логично добавить туда.
- **GitHub Actions CI** — полный CI/CD workflow (typecheck + lint + build + test e2e) отложен до Phase 18 где деплой. Sейчас достаточно husky pre-push.
- **Rewrite stale mock tests as e2e** — если будет обнаружено что какой-то сценарий не покрыт e2e после удаления моков → создать новый e2e тест (reactive, not preemptive).
- **Audit orphaned motivation assignments** (с user=null) через maintenance-скрипт — вне Phase 17 scope, data-hygiene задача.

</deferred>

---

*Phase: 17-build-seed-safety*
*Context gathered: 2026-04-18*
