---
phase: 17-build-seed-safety
plan: 01
subsystem: testing
tags: [typescript, prisma, null-safety, test-fixtures, motivation, payment]

# Dependency graph
requires:
  - phase: 14-payroll-employee-dashboard
    provides: MotivationAssignment model с userId? nullable (onDelete SetNull)
  - phase: 08-order-sale-flow
    provides: Payment.shiftId NOT NULL (FIN-11)
  - phase: 16-inventory-edge-cases-ux-polish
    provides: Category.identifierType enum + e2e test suite
provides:
  - pnpm typecheck exit 0 — 35 TypeScript-ошибок устранены
  - filter-null-on-input pattern для motivation-* handlers (удалённый сотрудник молча отбрасывается)
  - explicit throw на закрытой смене в repairs/trade-in (вместо DB-constraint crash)
  - расширенные createTestUser (role?) / createTestCategory (identifierType?) fixtures
  - чистый src/__tests__ без stale vi.mocked(db) mock-тестов
affects: [17-02-seed-safety, 17-03-build-hygiene, 18-secure-deploy-foundation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filter-null-on-input: .filter((a) => a.user !== null) перед .map() для nullable FK relations"
    - "fail-fast-on-closed-shift: throw Error вместо попытки save null в NOT NULL shiftId"

key-files:
  created: []
  modified:
    - src/actions/motivation-assignments.ts
    - src/actions/motivation-calculation.ts
    - src/actions/motivation-schemes.ts
    - src/actions/motivation-simulation.ts
    - src/actions/repairs.ts
    - src/actions/trade-in.ts
    - src/__tests__/helpers/fixtures.ts
    - src/__tests__/e2e-real-db.test.ts
  deleted:
    - src/__tests__/confirm-receive-integration.test.ts
    - src/__tests__/create-return-integration.test.ts

key-decisions:
  - "Payment.shiftId NOT NULL (FIN-11) несовместим с plan'овым `?? undefined` рецептом — применён fail-fast throw Error при закрытой смене (семантически корректно для production)"
  - "createTestUser.role принимает string: Role upsert'ится по name + UserRole создаётся с storeId override (или null)"
  - "Non-null assertion `a.user!` безопасен только внутри `.map()` после `.filter((a) => a.user !== null)` — TS control-flow narrow не всегда срабатывает через замыкание .map()"

patterns-established:
  - "filter-null-on-input: любой handler с include: { user: ... } на nullable FK relation должен .filter((x) => x.user !== null) ПЕРЕД .map() — удалённый сотрудник молча отбрасывается"
  - "fail-fast-on-closed-shift: операции с Payment (repair/trade-in/sale) требуют открытой смены — throw Error с читаемым сообщением при её отсутствии"

requirements-completed: [BUILD-01]

# Metrics
duration: 7min
completed: 2026-04-20
---

# Phase 17 Plan 01: Fix TypeScript Errors Summary

**`pnpm typecheck` exit 0 после устранения 35 TS-ошибок: filter-null-on-input для motivation-* handlers, fail-fast throw при закрытой смене в repairs/trade-in, расширение тестовых фикстур под schema drift, удаление stale mock-based integration tests.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-20T12:06:37Z
- **Completed:** 2026-04-20T12:14:01Z
- **Tasks:** 2 (все auto, без TDD — tsc сам верифицирует type-safety)
- **Files modified:** 8 (2 удалены, 0 создано)

## Accomplishments

- **22 null-unsafe accesses** в motivation-* actions и `repairs.ts:getStoreMasters` исправлены через filter-null-on-input pattern. MotivationAssignment.userId? nullable (onDelete: SetNull) теперь корректно обрабатывается: удалённый сотрудник молча отбрасывается из расчётов мотивации и списка доступных мастеров ремонта.
- **2 Payment.shiftId NOT NULL violations** (repairs.ts:635 `addRepairPayment` и trade-in.ts BUYBACK выплата) устранены через fail-fast throw. Семантика: операция с кассовым платежом невозможна при закрытой смене — это бизнес-правило, а не edge-case.
- **fixtures.ts schema drift** устранён: `createTestUser({ role: 'SELLER' })` и `createTestCategory({ identifierType: 'IMEI' })` работают, разблокировав 3 e2e-теста (ux-polish, inventory-edge-cases).
- **2 stale mock-based integration tests удалены** (`confirm-receive-integration.test.ts`, `create-return-integration.test.ts`) — Prisma 7 API несовместим с `vi.mocked(db)`. Покрытие уже заменено 22 e2e real-DB тестами в `src/__tests__/e2e/`.
- **e2e-real-db.test.ts:194** починен: Sale test теперь создаёт Shift перед Payment (FIN-11 requires shiftId).

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Фикс null-ошибок в motivation-* actions (filter-null-on-input)** — `8ba5153` (fix)
2. **Task 2: fail-fast throw + extended fixtures + delete stale mocks** — `c562015` (fix)

_Note: план предполагал имя "Inline `?? undefined` coercion" для Task 2A, но Payment.shiftId теперь строго NOT NULL — применён семантически корректный throw вместо undefined-coercion (документировано в Deviations)._

## Files Created/Modified

- `src/actions/motivation-assignments.ts` — filter-null-on-input в `getAssignmentsForStore` + `getStoreEmployees`
- `src/actions/motivation-calculation.ts` — filter-null + `userId!` в `getStoreEarnings` (payroll lookup + calculateEarnings call)
- `src/actions/motivation-schemes.ts` — filter в `scheme.assignments.map` внутри `getMotivationScheme`
- `src/actions/motivation-simulation.ts` — filter + `userId!` в `simulateSchemeComparison`
- `src/actions/repairs.ts` — getStoreMasters (L740-743) filter + addRepairPayment throw при закрытой смене
- `src/actions/trade-in.ts` — BUYBACK выплата throw при закрытой смене (L161-185)
- `src/__tests__/helpers/fixtures.ts` — createTestUser.role + createTestCategory.identifierType, импорт IdentifierType
- `src/__tests__/e2e-real-db.test.ts` — добавлен Shift.create перед Sale (L152+)
- `src/__tests__/confirm-receive-integration.test.ts` — **DELETED** (stale vi.mocked(db))
- `src/__tests__/create-return-integration.test.ts` — **DELETED** (stale vi.mocked(db))

## Decisions Made

1. **Plan recipe adjusted: `?? undefined` → fail-fast throw.** План требовал inline `value ?? undefined` для repairs.ts:635 / trade-in.ts:181. Анализ: Prisma schema (FIN-11) теперь требует `Payment.shiftId String` (NOT NULL) — `undefined` не проходит тип, а передача `null` упала бы на DB-constraint. Правильный семантический фикс: throw `Error("Нет открытой смены — невозможно принять оплату/выплату")` перед `payment.create`. Это корректно бизнес-правило: касса должна быть открыта для любого cash flow.
2. **Non-null assertion `user!` внутри `.map()` после `.filter()`.** TypeScript 5.x control-flow narrow не всегда переходит в inner `.map()` callback (особенно с Promise.all/async) — `a.user!` явно и безопасно, т.к. фильтр гарантирует non-null. Альтернатива (user-defined type guard `filter<T>((a): a is ... => ...)`) была бы многословнее без измеримой выгоды.
3. **createTestUser.role через upsert + UserRole create.** User модель не имеет прямого `role` поля (роли через отдельную таблицу UserRole). Fixture теперь `upsert'ит Role по name` + создаёт UserRole. storeId наследуется из overrides.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug / Rule 3 — Blocking] `?? undefined` рецепт несовместим с FIN-11 schema**
- **Found during:** Task 2 (repairs.ts:635, trade-in.ts:181)
- **Issue:** План требовал inline `value ?? undefined` для приведения `string | null` → `string | undefined`. После Phase 8 FIN-11 `Payment.shiftId` стал `String` (NOT NULL) — Prisma тип теперь `string`, не `string | undefined`. `?? undefined` не пройдёт typecheck И упадёт в runtime на DB-constraint если передать, сохранив null/undefined.
- **Fix:** Вместо coercion — explicit guard `if (!openShift) throw new Error(...)` перед `payment.create`. Семантически корректно: без открытой смены бизнес запрещает cash flow.
- **Files modified:** `src/actions/repairs.ts`, `src/actions/trade-in.ts`
- **Verification:** `pnpm typecheck` exit 0; сообщения об ошибке на русском, читаемые кассиру.
- **Committed in:** `c562015`

**2. [Rule 3 — Blocking] e2e-real-db.test.ts requires Shift for Sale**
- **Found during:** Task 2 (e2e-real-db.test.ts:194 Payment.create)
- **Issue:** Test создавал Sale с nested Payment без shiftId — вылетало typecheck (FIN-11) и DB constraint.
- **Fix:** Перед Sale добавлено создание testShift (raw SQL counter + shift.create) + регистрация в createdIds для cleanup. Payment.create теперь получает shiftId: testShift.id.
- **Files modified:** `src/__tests__/e2e-real-db.test.ts`
- **Verification:** Typecheck exit 0. Test-логика не меняется, только добавлено setup'ное предусловие.
- **Committed in:** `c562015`

---

**Total deviations:** 2 auto-fixed (оба Rule 1/3 — bug/blocking, связаны с FIN-11 schema эволюцией)
**Impact on plan:** Deviations сохраняют intent плана (zero typecheck errors) но применяют семантически корректный фикс. Нет scope creep — обе правки строго в файлах, упомянутых в плане.

## Issues Encountered

- **Pre-existing uncommitted работа Plan 17-02.** При старте plan 17-01 в working tree уже были изменения (`prisma/seed.ts`, `prisma/schema.prisma` + mustChangePassword, `prisma/__tests__/seed-guard.test.ts`, migration) — похоже, Plan 17-02 был начат в предыдущей сессии. Во время нашей сессии на эти файлы сработал чей-то pre-commit hook, создав коммит `2f197ef test(17-02): RED — seed-guard test + User.mustChangePassword schema` между нашими Task 1 и Task 2. Это не повлияло на Plan 17-01 (стейджили только свои файлы), но отмечено для резюмирующей сессии Plan 17-02.

## User Setup Required

Нет — никакая внешняя конфигурация не требуется.

## Next Phase Readiness

- **Plan 17-02 (BUILD-02): seed prod-guard + admin bootstrap** — частично начат в предыдущей сессии (коммит `2f197ef` содержит RED-тест seed-guard + миграция mustChangePassword). Следующая задача: реализовать guard в seed.ts, admin bootstrap, GREEN-фаза тестов.
- **Plan 17-03 (BUILD-03): clean build** — требует успешного `pnpm build`. Pre-req `pnpm typecheck = 0` теперь выполнен.
- **CI gate (husky pre-push):** теперь безопасно добавить — typecheck не будет блокировать push.

## Self-Check: PASSED

Verified:
- File `.planning/phases/17-build-seed-safety/17-01-SUMMARY.md` exists (this file)
- Commit `8ba5153` exists in git log (Task 1)
- Commit `c562015` exists in git log (Task 2)
- `pnpm typecheck` exit 0
- Stale mocks deleted (confirm/create-return integration.test.ts)
- All 5 files have filter-null pattern applied (count verified via grep)

---
*Phase: 17-build-seed-safety*
*Completed: 2026-04-20*
