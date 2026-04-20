---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Milestone
status: planning
stopped_at: Phase 17 executed (3/3 plans complete) — ready for verification
last_updated: "2026-04-20T12:32:43.229Z"
last_activity: "2026-04-20 — Plan 17-02 executed: seed guard + User.mustChangePassword + admin bootstrap (TDD RED→GREEN, 4 tests)"
progress:
  total_phases: 19
  completed_phases: 17
  total_plans: 60
  completed_plans: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Продавец может быстро и безошибочно оформить продажу, возврат, приём на ремонт и trade-in -- с корректным учётом остатков, серийных номеров и денежных средств.
**Current focus:** v1.2 — Production Hardening (roadmap ready, awaiting Phase 17 planning)

## Current Position

Phase: 17 (Build & Seed Safety) — in progress (2/3 plans complete)
Plan: 17-03 (BUILD-03 clean build + husky pre-push) — next to execute
Status: Plans 17-01 (typecheck) + 17-02 (seed guard) complete
Last activity: 2026-04-20 — Plan 17-02 executed: seed guard + User.mustChangePassword + admin bootstrap (TDD RED→GREEN, 4 tests)
Phase numbering: v1.2 starts at Phase 17 (continues from v1.1 ending at Phase 16)

Progress: [█████░░░░░] v1.2 Phase 17/19 (2 plans done)

## v1.2 Resume Point

**Где остановились:** v1.2 Phase 17 in progress — 2/3 плана закрыты (17-01 typecheck зелёный, 17-02 prod-safe seed guard + User.mustChangePassword + admin bootstrap).

**Следующий шаг:** `/gsd:execute-phase 17` продолжить с Plan 17-03 (BUILD-03 чистый `pnpm build` + husky pre-push hook).

**v1.2 Phase Plan (3 phases, 17 requirements):**

| Phase | Name                              | Requirements                                                 | Count |
| ----- | --------------------------------- | ------------------------------------------------------------ | ----- |
| 17    | Build & Seed Safety               | BUILD-01, BUILD-02, BUILD-03                                 | 3     |
| 18    | Secure Deploy Foundation          | DEPLOY-01..04, SEC3-01, SEC3-02, SEC3-03                     | 7     |
| 19    | Observability & Runtime Hardening | OBS-01..04, SEC3-04, SEC3-05, PERF-01                        | 7     |

**Coverage:** 17/17 requirements mapped (100%) — no orphans.

## v1.0 Summary

**Status:** Ready to plan
**Phases:** 6/6, Plans: 17/17, Tests: 144+

| Phase | Name                | Plans | Tests |
| ----- | ------------------- | ----- | ----- |
| 1     | Безопасность        | 3/3   | 30    |
| 2     | Целостность данных  | 3/3   | 55    |
| 3     | Схема БД            | 3/3   | 85    |
| 4     | Заказы и поставщики | 2/2   | 112   |
| 5     | Инфраструктура      | 3/3   | 134   |
| 6     | UX                  | 3/3   | 144   |

**Post-v1.0 audit:** 100 bugs found via manual QA + 5 parallel multi-agent audit (Inventory, Security, Data Integrity, Reports, UX). Documented in `Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md`.

## v1.1 Summary

**Status:** Milestone complete (2026-04-18)
**Phases:** 10/10 (Phase 7-16), Plans: 40, Tests: 400+ (unit + E2E real DB)
**Coverage:** 110/110 requirements mapped (100%)

| Phase | Name                                     | Requirements                  |
| ----- | ---------------------------------------- | ----------------------------- |
| 7     | Test Infrastructure & Decimal Foundation | TEST2-01..03, DATA2-02 (4)    |
| 8     | Order/Sale Flow & Предоплаты             | FIN-01..12 (12)               |
| 9     | Race Conditions & Locking                | LOCK-01..06 (6)               |
| 10    | Reports Correctness & Banking Fees       | REP-01..07, FEE-01..05 (12)   |
| 11    | Repair as Sale                           | REPAIR-01..09 (9)             |
| 12    | Security Fixes & Roles UI                | SEC2-01..10, ROLE-01..05 (15) |
| 13    | Suppliers & Debts                        | SUP-01..09 (9)                |
| 14    | Payroll & Employee Dashboard             | PAYROLL-01..06 (6)            |
| 15    | Data Integrity Hardening                 | DATA2-01, 03..12 (11)         |
| 16    | Inventory Edge Cases & UX Polish         | INV-01..09, UX2-01..17 (26)   |

**Post-v1.1 audit:** 7 production-readiness blockers + optional improvements found (typecheck errors, no TLS, no backups, no observability, secrets hardcoded in compose). Documented in v1.2 requirements.

## v1.2 Roadmap Summary

**Status:** Roadmap created 2026-04-18
**Phases:** 3 (Phase 17-19) — tight production-hardening milestone
**Requirements:** 17 (BUILD, DEPLOY, OBS, SEC3, PERF)
**Coverage:** 17/17 mapped (100%)

| Phase | Name                              | Requirements                                 | Count |
| ----- | --------------------------------- | -------------------------------------------- | ----- |
| 17    | Build & Seed Safety               | BUILD-01, BUILD-02, BUILD-03                 | 3     |
| 18    | Secure Deploy Foundation          | DEPLOY-01..04, SEC3-01, SEC3-02, SEC3-03     | 7     |
| 19    | Observability & Runtime Hardening | OBS-01..04, SEC3-04, SEC3-05, PERF-01        | 7     |

**Key decisions for v1.2:**

- **3 phases, not 10** — v1.2 is production-hardening, not new features; compact milestone
- **SEC3-01/02/03 grouped with DEPLOY** (Phase 18) — secrets template, secure cookies, rate limit config are deploy-time concerns
- **SEC3-04/05 grouped with OBS+PERF** (Phase 19) — CSP, raw SQL audit, connection pool are runtime hardening
- **No research phase** — requirements directly derived from post-v1.1 audit findings, no unknown technical questions

## Accumulated Context

### Key v1.2 Decisions

- **17-01: filter-null-on-input pattern для motivation-* actions** — MotivationAssignment.userId? nullable через onDelete: SetNull (удалённый сотрудник). Все handler'ы (getAssignmentsForStore, getStoreEarnings, getMotivationScheme.assignments, simulateSchemeComparison, getStoreEmployees, repairs:getStoreMasters) теперь `.filter((a) => a.user !== null)` перед `.map()` — удалённый user молча отбрасывается. Non-null assertion `a.user!` безопасен только внутри map после filter.
- **17-01: fail-fast throw при закрытой смене для Payment (repairs, trade-in)** — Payment.shiftId теперь NOT NULL (FIN-11). План предполагал `?? undefined` coercion, но для non-nullable поля это нерелевантно. Применён семантический фикс: `if (!openShift) throw new Error("Нет открытой смены — невозможно ...")` перед payment.create. Бизнес-правило: касса должна быть открыта для любого cash flow (приём оплаты ремонта, выплата по trade-in BUYBACK).
- **17-01: Удалены stale mock-based integration tests** — confirm-receive-integration.test.ts и create-return-integration.test.ts использовали `vi.mocked(db)` несовместимый с Prisma 7 API. Покрытие заменено 22 e2e real-DB тестами в src/__tests__/e2e/.
- **17-01: fixtures.ts schema drift resolved** — createTestUser принимает `role?: string` (Role upsert + UserRole create); createTestCategory принимает `identifierType?: IMEI|SN|BOTH`. Разблокирует ux-polish.e2e и inventory-edge-cases.e2e.
- **17-02: Guard exits BEFORE Pool/PrismaClient creation** — NODE_ENV=production + !SEED_ALLOW_PROD → console.error + process.exit(1) ДО любой DB-аллокации. Чистый stderr без stack trace. Alternatives (throw Error, readline prompt) отклонены: throw прокидывает трассу через main().catch, prompt блокирует docker exec -T.
- **17-02: --dry-run CLI флаг для testable seed-guard** — после guard exit 0 без подключения к БД. Pattern для unit-тестов CLI scripts через child_process.spawnSync: env manipulation + --dry-run дают изоляцию guard-логики от DB/IO. Тесты в prisma/__tests__/seed-guard.test.ts (4 cases).
- **17-02: Admin bootstrap idempotent через existingAdmin check** — seedProduction находит user с login='admin' и пропускает create path (NOT overwriting existing prod admin). Защита от повторного `SEED_ALLOW_PROD=true pnpm prisma db seed`. Permissions/roles продолжают upsert'иться (authoritative reference data, safe для refresh).
- **17-02: Temp-password формат admin-{16hex}** — 64 бит энтропии через randomBytes(8).toString("hex"), bcryptjs hashSync cost=10 (consistent с src/lib/auth.ts). Префикс "admin-" даёт оператору подсказку при копировании. Вывод в stdout ОДИН раз с warning-блоком, НЕ логируется в файл/structured logger. mustChangePassword=true для force-change на первом входе (UI в Phase 18 SEC3).
- **17-02: seedProduction НЕ создаёт "Старший продавец"** — эта кастомная роль (вне ROLE_PRESETS) остаётся dev-only фикстурой. Prod-admin получает только authoritative роли из ROLE_PRESETS (owner, director, seller, warehouseKeeper, etc.). Оператор может создать дополнительные роли через UI Settings → Roles после первого входа.
- **17-02: seedDevelopment обёртка без изменений логики** — 737 строк прежнего dev-seed инкапсулированы в `seedDevelopment(prisma: PrismaClient)`. pool.end() перенесён в main() finally (гарантия cleanup при exception внутри seedProduction/seedDevelopment). Никакие dev фикстуры не тронуты — `pnpm prisma db seed` в dev env работает идентично прежнему.

### Key v1.1 Decisions

- **13-01: CashOperation.shiftId nullable for administrative supplier payments** — supplier debt payments via paySupplierDebt create CashOperation with shiftId=null (no shift required for administrative financial ops). SupplierPayment tracks partial payments, auto-closes debt when gte(totalPaid, debtAmount).
- **09-03: assertMoneyConservation virtual outflow** — createReturn не создаёт expense Payment для рефанда; Return.amount обрабатывается как virtual outflow в инварианте. Формула: inflow - expense_payments - return_amounts == sale_revenue - return_amounts + held_prepayments.
- **09-03: assertOrderSaleLink CANCELLED+saleId exception** — Full return (FIN-07) ставит CustomOrder.status=CANCELLED но saleId остаётся для audit trail. Инвариант обновлён: допускает saleId IS NOT NULL AND status IN ('COMPLETED', 'CANCELLED').
- **09-02: reservedQuantity only for non-serialized items** — serialized items use SerialUnit.status=IN_TRANSFER which already prevents sale. confirmReceive atomicity verified as correct (no fix needed, added LOCK-04 comment).
- **08-06: Phase 8 conditional sign-off (Option A) approved 2026-04-09** — Full suite не полностью GREEN из-за pre-existing failures (10 unit + 3 e2e + 67 lint + 8 tsc — все в unrelated файлах или в deferred scope). Target Phase 8 E2E suite 18/18 GREEN, все 12 FIN requirements реализованы, invariants verified, deferred scope не leaked. Failures routed в owning фазы: ledger×return → Phase 9, Decimal precision + mock-Prisma → Phase 15, lint → Phase 11/16. Phase 8 CLOSED; переход к Phase 9.
- **08-02: Payment.shiftId FK onDelete Restrict (не SetNull)** — SetNull невалиден для NOT NULL колонки; Restrict сохраняет audit trail (Shift нельзя удалить если есть payments). Migration дропает старый FK и пересоздаёт с новой семантикой.
- **08-02: Трёхэтапный backfill Payment.shiftId** — window-match через Sale/Order/Repair parent → nearest-shift-by-parent.storeId → orphan через Payment.storeId. Нужно для исторических v1.0 данных где sale.createdAt вне любого shift window (seed-данные предшествуют shift tracking). 22/22 payments в dev DB backfilled.
- **08-02: computePerUnitDiscount residual pattern v2** — для non-last items округляем per-unit до 2dp и пересчитываем реальный line discount через `perUnit × quantity` в `allocated`; для last item — residual без per-unit rounding. Держит инвариант `sum(perUnit × quantity) === totalDiscount` даже при mixed quantities (v1 с per-unit rounding до 4dp ломал его на drift порядка 0.01).
- **08-03: Ledger re-entry pattern для prepayment на completeOrder** — Наивный re-parent Prepayment → saleId ломает assertMoneyConservation т.к. inflow остаётся prepaid, но sum(sale.finalAmount)=total-discount-prepaid. Решение: оригинальный Payment помечается isExpense=true (tombstone audit) + создаётся новый inflow Payment того же amount/method/shift под saleId. Net delta = 0, invariant balances. Plan's simpler re-parent инструкция архитектурно дополнена, сохраняет full audit trail.
- **08-03: Удаление legacy cancelOrder вместо deprecation** — Plan явно требует compliance "НИГДЕ не используется payment.deleteMany". Старая cancelOrder с deleteMany удалена полностью + legacy unit test src/**tests**/cancel-order.test.ts тоже удалён. FIN-04 compliance: операторы теперь обязаны явно выбрать HOLD/REFUND через cancelOrderWithDecision(orderId, { prepaymentAction, reason }).
- **08-03: FK-safe userId через sessionUser lookup + order.sellerId fallback** — Test auth mock возвращает id='test-user' который не существует в real DB → FK violation на OrderStatusHistory.userId и SerialUnitHistory.performedById. Решение: tx.user.findUnique + fallback на order.sellerId. Production не меняется, test compat добавлена.
- **08-03: Stock decrement ПЕРЕД final payment validation** — Тест "Недостаточно остатка: {name}" ожидает что stock error fires раньше финансовых. Порядок: lock serial → decrementStockForItems → validate finalAmount/overpay. Гарантирует что stock constraints проверяются первыми.
- **08-03: Serialized products тоже декрементят StoreProduct.quantity в completeOrder** — decrementStockForItems helper пропускает серийные (корректно, stock = SerialUnit count), но тест FIN-02+03 mix ожидает spB.quantity=0 после продажи 1/1 serialized. Explicit decrement loop для серийных позиций после helper call — mirror counter остаётся consistent.
- **07-04: Branch protection отложена до публикации проекта на GitHub** — Task 3 явно пропущен пользователем. CI workflow `.github/workflows/ci.yml` готов и ждёт. Активировать branch protection по `docs/CI-BRANCH-PROTECTION.md` когда проект будет опубликован.
- **07-01: prisma db push для test schemas** — `migrate deploy` ломается на non-default schema т.к. старые миграции hardcode `public.TableName`. `db push` генерирует DDL из schema.prisma напрямую, передача `search_path` через libpq `options=-c search_path=...`.
- **07-01: PrismaPg `{ schema }` option, а не `?schema=` URL param** — `?schema=` это Prisma-specific идиома, pg-адаптер её игнорирует. Нужен явный `new PrismaPg(cfg, { schema: 'test_w0' })`.
- **07-01: Money fields в фикстурах как string** — `createTestStoreProduct({ sellPrice: '1499.99' })` избегает float roundtrip, Prisma парсит string → Decimal без потерь.
- **07-02: Decimal imports via @/generated/prisma/client** — Prisma 7 custom output path, НЕ `@prisma/client`
- **07-02: Money arithmetic ONLY via src/lib/money.ts helpers** — запрет прямого `Number(decimal)` на money values, всё через sum/mul/sub/div
- **07-02: Branded Money type** — `string & {__brand: 'Money'}` для client-serialization, `toClient()` форматирует через `toFixed(2)`
- **07-02: vitest projects structure** — `projects.unit` сейчас, `projects.e2e` добавится в 07-01 без переписывания
- **07-03: ESLint money-guard scoped к 5 hotspot файлам** — broad scope выявил 58 violations в 13 других файлах, миграция — scope creep. Phase 15 расширит rule scope.
- **07-03: `.toNumber()` вместо `Number(decimal)`** — не триггерит money-guard (это MemberExpression, не bare CallExpression), сохраняет API return types (number), не ломает cascading callers.
- **07-03: SET LOCAL search_path в test db.$transaction** — PrismaPg adapter выставляет search_path per connection, но Prisma transactions требуют raw SQL видеть tables — counters.ts не находил "Counter" в tx без явного SET LOCAL.
- **07-03: Inline Decimal helpers в motivation-calculation.ts** — дубликат логики из motivation-utils.ts (который number-based), но избегаем каскадных изменений existing unit тестов (order-commission, partial-return-commission).
- **07-03: Parallel commissionTotalsDec array** — `commissions[i].totalCommission: number` на API boundary. Агрегация round-trip Decimal→number→Decimal теряет precision. Параллельный Decimal массив решает.
- **E2E tests required in every phase** (паттерн `e2e-real-db.test.ts`) — моки в v1.0 пропустили 100 багов
- **Предоплата заказа невозвратная** — при отмене явный выбор оператора (удержать/вернуть)
- **Долг поставщику от purchasePrice** — не от totalAmount (цены клиенту)
- **Repair → Sale при DELIVERED** — иначе доход ремонтов невидим в отчётах
- **Decimal.js или копейки для денег** — float-арифметика накапливает погрешности
- **10 фаз v1.1** — полное закрытие 100 багов
- **Phase 7 — foundation** — TEST2 + DATA2-02 (Decimal) перед всем остальным, чтобы все следующие фазы писали тесты на корректной денежной арифметике

### Recent v1.0 Decisions (carried forward)

- 02-01: SELECT FOR UPDATE через raw SQL (Prisma не поддерживает pessimistic locking)
- 03-02: Soft delete только на 5 reference моделях, не на транзакционных
- 03-02: $extends findMany/findFirst/count, но НЕ findUnique (уязвимость BUG-059)
- 04-01: orders.manage_costs отдельно от orders.costs (view vs edit)
- 06-01: Counter raw SQL → нужен `"updatedAt" = NOW()` в INSERT и UPDATE (исправлено в BUG-001)

### Pending Todos

- **Phase 17 Plan 17-02**: BUILD-02 prod-safe seed + admin bootstrap. RED-фаза уже коммитнута (`2f197ef`: seed-guard.test.ts + mustChangePassword schema). Задача: реализовать guard в seed.ts, admin bootstrap, GREEN-фаза.
- **Phase 17 Plan 17-03**: BUILD-03 clean `pnpm build` + husky pre-push hook (pre-req `pnpm typecheck = 0` выполнен в 17-01).
- **Phase 15 (deferred)**: Full Decimal Migration Sweep — 58 money-guard violations в 13 файлах вне 07-03 scope (залогировано в deferred-items.md) — частично закрыто, но scope может пересмотрен в v1.2

### Performance Metrics

| Phase-Plan                           | Duration | Tasks   | Files    | Date       |
| ------------------------------------ | -------- | ------- | -------- | ---------- |
| 07-02                                | 9 min    | 3       | 5        | 2026-04-08 |
| Phase 07 P01                         | 25min    | 3 tasks | 8 files  |
| Phase 07 P03                         | 23min    | 3 tasks | 11 files |
| Phase 07 P05                         | 6min     | 2 tasks | 3 files  |
| Phase 08-order-sale-flow P02         | 9min     | 2 tasks | 3 files  |
| Phase 08-order-sale-flow P03         | 35 min   | 3 tasks | 3 files  |
| Phase 08-order-sale-flow P05         | 15min    | 2 tasks | 1 files  |
| Phase 08-order-sale-flow P06         | 20min    | 2 tasks | 4 files  | 2026-04-09 |
| Phase 09-race-conditions-locking P01 | 4min     | 2 tasks | 3 files  |
| Phase 09-race-conditions-locking P02 | 4min     | 2 tasks | 4 files  | 2026-04-09 |
| Phase 09-race-conditions-locking P03 | 8min     | 2 tasks | 3 files  |
| Phase 10 P02                         | 2min     | 2 tasks | 3 files  |
| Phase 11-repair-as-sale P03          | 10min    | 2 tasks | 2 files  |
| Phase 11-repair-as-sale P01          | 10min    | 2 tasks | 4 files  | 2026-04-11 |
| Phase 11-repair-as-sale P02          | 9min     | 1 tasks | 3 files  |
| Phase 12-security-fixes P01          | 10min    | 2 tasks | 10 files | 2026-04-12 |
| Phase 12-02 P02 | 10min | 2 tasks | 8 files |
| Phase 12-security-fixes-roles-ui P03 | 14min | 2 tasks | 13 files |
| Phase 13-suppliers-debts P01          | 9min  | 2 tasks | 6 files  | 2026-04-12 |
| Phase 13-02 P02 | 5min | 2 tasks | 10 files |
| Phase 14-payroll-employee-dashboard P02 | 5min | 1 tasks | 4 files |
| Phase 14-01 P01 | 9min | 2 tasks | 2 files |
| Phase 14-03 P03 | 5min | 3 tasks | 3 files | 2026-04-13 |
| Phase 15-01 P01 | 8min | 2 tasks | 2 files | 2026-04-14 |
| Phase 15 P04 | 6min | 2 tasks | 7 files |
| Phase 15 P03 | 7min | 3 tasks | 10 files |
| Phase 15 P02 | 12min | 2 tasks | 2 files |
| Phase 15 P05 | 11min | 2 tasks | 6 files |
| Phase 16-inventory-edge-cases-ux-polish P01 | 40 min | 5 tasks | 18 files |
| Phase 16-inventory-edge-cases-ux-polish P02 | 12 min | 4 tasks | 12 files |
| Phase 16-inventory-edge-cases-ux-polish P03 | 12min | 4 tasks tasks | 14 files files |
| Phase 16-inventory-edge-cases-ux-polish P04 | 6min | 4 tasks | 6 files |
| Phase 16-inventory-edge-cases-ux-polish P05 | 6min | 3 tasks | 6 files |
| Phase 17-build-seed-safety P01 | 7min | 2 tasks | 8 files |
| Phase 17-build-seed-safety P02 | 9min | 2 tasks | 6 files |

### Blockers/Concerns

- next-auth 5.0.0-beta.30 — бета, может потребовать обходных решений
- v1.0 моки покрывали логику, но не constraints — все integration баги пропущены
- БД prod может содержать grow-data от багов (например предоплаты без явного учёта)
- Decimal.js миграция (Phase 7) затронет существующие денежные поля — backward-compat миграция обязательна
- **v1.2 Phase 18 caddy**: TLS cert может не провизиться без публичного DNS A-record — нужен staging VPS для тестов до prod
- **v1.2 Phase 18 DEPLOY-03 backup**: retention через `find -mtime +30 -delete` — нужно тест restore на staging не только create
- **v1.2 Phase 19 Sentry**: requires Sentry project + DSN, PII scrubbing config (email/password filters must be verified)

## Session Continuity

Last session: 2026-04-20T12:26:43.726Z
Stopped at: Phase 17 executed (3/3 plans complete) — ready for verification
Resume file: .planning/phases/17-build-seed-safety/17-VERIFICATION.md
