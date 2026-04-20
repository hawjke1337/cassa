---
phase: 08-order-sale-flow
plan: 02
subsystem: database
tags: [prisma, postgres, migration, decimal, money-guard, discount, residual-pattern]

# Dependency graph
requires:
  - phase: 07-test-infrastructure-decimal-foundation
    provides: "@/lib/money helpers (sum, sub, mul, div, toMoney), Decimal precision contract, money-guard ESLint"
provides:
  - "Payment.shiftId NOT NULL schema constraint (FIN-11) с историческим backfill"
  - "Return.refundMethod NOT NULL schema constraint (FIN-09)"
  - "CustomOrder.cancellationType колонка (FIN-06) для HOLD/REFUND семантики"
  - "CustomOrder.cancelReason колонка (FIN-06) для audit trail отмены"
  - "computePerUnitDiscount pure function (FIN-08) — residual-pattern распределение"
affects: [08-03-orders-completion-cancel, 08-04-returns-sync, 10-reports, 15-data-integrity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staged backfill migration: window-match → nearest-shift → orphan via storeId"
    - "Residual pattern для precision-safe discount распределения"
    - "Migration guard DO blocks с RAISE EXCEPTION на не-backfilled NULL"

key-files:
  created:
    - "prisma/migrations/20260408_phase8_payment_shift_return_refund_cancellation_type/migration.sql"
    - "src/lib/orders/discount.ts"
  modified:
    - "prisma/schema.prisma"

key-decisions:
  - "Payment.shiftId FK onDelete: SetNull → Restrict (Rule 3 auto-fix, требуется при NOT NULL)"
  - "Трёхэтапный backfill для исторических payments без shift coverage (window → nearest → orphan)"
  - "CASH fallback для Return.refundMethod если Sale не имел payments"
  - "Per-unit без округления для residual line item — гарантирует sum инвариант при mixed quantities"

patterns-established:
  - "Staged backfill: каждый этап UPDATE с WHERE IS NULL, guard в конце падает если что-то осталось"
  - "Residual pattern v2: для non-last items округляем per-unit (не line); для last — считаем residual и делим без rounding"
  - "Migration применяется через prisma migrate deploy (не dev) чтобы избежать drift/reset"

requirements-completed: [FIN-06, FIN-08, FIN-09, FIN-11]

# Metrics
duration: 9min
completed: 2026-04-08
---

# Phase 8 Plan 02: Schema Migrations & Discount Foundation Summary

**4 schema changes (Payment.shiftId NN, Return.refundMethod NN, CustomOrder.cancellationType + cancelReason) с трёхэтапным backfill исторических payments, плюс computePerUnitDiscount pure function с residual pattern который держит инвариант sum(perUnit × quantity) === totalDiscount для mixed quantities.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-08T18:12:07Z
- **Completed:** 2026-04-08T18:21:20Z
- **Tasks:** 2
- **Files modified:** 3 (1 created schema migration, 1 created TS module, 1 modified schema)

## Accomplishments

- Schema migration применена на dev БД: 22 Payment.shiftId backfilled в 3 этапа без потери audit trail, 0 ошибок.
- CustomOrder получил `cancellationType` и `cancelReason` колонки — разблокирует Wave 2 cancelOrderWithDecision (08-03) и Phase 10 reports revenue calc.
- `Return.refundMethod` теперь NOT NULL — разблокирует refund method validation (08-03/08-04).
- `computePerUnitDiscount` экспортируется из `@/lib/orders/discount` с money-guard-compliant реализацией, проходит 7 sanity тестов в том числе mixed-quantity case.
- Wave 2 foundation complete — параллельно с 08-01 (Wave 0 RED).

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations (Payment/Return/CustomOrder)** - `3289e07` (feat)
2. **Task 2: computePerUnitDiscount pure function** - `1d652aa` (feat)

## Files Created/Modified

- `prisma/schema.prisma` — Payment.shiftId: String → NOT NULL, onDelete Restrict; Return.refundMethod: PaymentMethod NOT NULL; CustomOrder: cancellationType + cancelReason добавлены
- `prisma/migrations/20260408_phase8_payment_shift_return_refund_cancellation_type/migration.sql` — 185-строчная миграция с трёхэтапным backfill (sale/order/repair window → nearest → orphan via storeId) и двумя DO-block guards
- `src/lib/orders/discount.ts` — Pure function `computePerUnitDiscount(items, totalDiscount)` с residual pattern v2, все арифметические операции через `@/lib/money` helpers

## Decisions Made

- **FK onDelete Restrict (вместо SetNull):** При переводе shiftId в NOT NULL старая схема `onDelete: SetNull` невалидна (нельзя set null на not-null column). Замена на `Restrict` семантически корректна: Shift с привязанными Payment'ами нельзя удалить — сохраняет audit trail.
- **Трёхэтапный backfill:** Dev DB показала что seed-данные v1.0 имели sale.createdAt до первого Shift.openedAt (нет window match). Этап 2 (nearest-shift-by-storeId) привязал их к ближайшей смене того же магазина. Этап 3 обработал orphan payments (2 штуки без parent) через `Payment.storeId`. Все 22 NULL успешно backfilled.
- **CASH fallback для refundMethod:** Если у Sale нет Payment записей (edge case), используем `CASH` как дефолт — явный выбор, залогирован в комментариях миграции. В dev БД таких кейсов не оказалось (0 NULL у Return до начала backfill).
- **Residual pattern v2 (не-last округляем per-unit, last без rounding):** Начальная реализация из research использовала per-unit округление до 4 знаков, что ломало инвариант `sum(perUnit × quantity) === totalDiscount` для mixed quantities (drift от накопления 0.00005 × qty × N lines). Исправлено: для non-last items округляем `perUnit` до 2dp (копейки) и пересчитываем **реальный** line discount через `perUnit × quantity`; для last item — residual делится на quantity без rounding. Sanity тест с mixed quantities (3+2+4, скидка 77.77) проходит.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Payment FK onDelete: SetNull → Restrict**

- **Found during:** Task 1 (schema.prisma edit)
- **Issue:** Изначально схема декларировала `shift Shift? @relation(..., onDelete: SetNull)`. При переводе `shiftId` в NOT NULL старая директива `SetNull` становится невалидной на уровне Postgres — нельзя set null на not-null column. Prisma validate всё пропускает, но миграция бы упала при применении FK.
- **Fix:** Изменил на `shift Shift @relation(fields: [shiftId], references: [id], onDelete: Restrict)`. Миграция явно дропает старый FK и пересоздаёт с `ON DELETE RESTRICT`. Семантически правильно: Shift с payments нельзя удалить без каскадного удаления Payments (которые мы защищаем как audit).
- **Files modified:** prisma/schema.prisma, prisma/migrations/.../migration.sql
- **Verification:** `npx prisma validate` passes, `npx prisma migrate deploy` applied successfully, FK присутствует в `information_schema.table_constraints` после миграции.
- **Committed in:** 3289e07 (Task 1 commit)

**2. [Rule 1 - Bug] Residual pattern ломал invariant для mixed quantities**

- **Found during:** Task 2 (sanity test run)
- **Issue:** Первая реализация следовала research Example 2 buquistally: per-unit округлялось до 4 dp. Sanity тест с items `[{100,3}, {50,2}, {25,4}]` и discount `77.77` упал: actual `77.7699`, expected `77.77`. Причина: per-unit с 4 dp × quantity = накопленная ошибка rounding на 0.01 после 3 lines.
- **Fix:** Переписал алгоритм. Для non-last items: считаем `rawLine = D × lineTotal / grandTotal`, затем `perUnit = round(rawLine / quantity, 2)`, затем `actualLine = perUnit × quantity` и добавляем в `allocated`. Для last item: `lineDiscount = totalDiscount - allocated`, `perUnit = lineDiscount / quantity` БЕЗ округления. Инвариант `sum(perUnit × quantity) === totalDiscount` теперь точен.
- **Files modified:** src/lib/orders/discount.ts
- **Verification:** Sanity test (7 cases: zero, empty, 3×100/100, 99.99/2, qty>1, all-zero, mixed) → 7/7 passed.
- **Committed in:** 1d652aa (Task 2 commit)

**3. [Rule 3 - Blocking] Prisma migration resolve after first apply failure**

- **Found during:** Task 1 (first `migrate deploy` attempt)
- **Issue:** Первая попытка миграции упала на guard (20 Payment NULL остались после этапа 1 backfill — sale.createdAt вне любого shift window). Prisma пометила миграцию как failed в `_prisma_migrations` table, блокируя retry.
- **Fix:** `npx prisma migrate resolve --rolled-back 20260408_phase8_...` + rewrite миграции с 3-этапным backfill + retry.
- **Files modified:** prisma/migrations/.../migration.sql (добавлены этапы 2 и 3 backfill)
- **Verification:** `npx prisma migrate deploy` → "All migrations have been successfully applied"; post-state SQL проверка: 0 NULL в Payment.shiftId и Return.refundMethod.
- **Committed in:** 3289e07 (Task 1 commit, итоговая версия миграции)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** Все auto-fixes необходимы для корректности миграции и invariant-guarantee discount функции. Scope creep нет — все изменения внутри двух файлов плана.

## Issues Encountered

- **Pre-existing TS errors в `src/actions/*.ts`**: после `prisma generate` клиент стал требовать non-null shiftId, что валит TS compile для `orders.ts:408,635,690,791`, `sales.ts:652`, `repairs.ts:498`, `trade-in.ts:159`. Это **ожидаемая граница** — Plan 08-03 владеет правками actions/. Я не трогал actions/\*.ts в соответствии с critical rules. `tsc --noEmit` по самому `discount.ts` — zero errors.
- **Pre-existing TS errors в `src/__tests__/confirm-receive-integration.test.ts`, `e2e-real-db.test.ts`, `vitest.config.ts`**: не связаны с Phase 8, уже существовали до моих изменений (видны в `git status`).

## Self-Check

### Files

- `/Users/pushkarev/PROD/astore shop/astore ePRM Программа для учете бизнесса- касса не доделана/astore-erp/prisma/schema.prisma` — FOUND (modified)
- `/Users/pushkarev/PROD/astore shop/astore ePRM Программа для учете бизнесса- касса не доделана/astore-erp/prisma/migrations/20260408_phase8_payment_shift_return_refund_cancellation_type/migration.sql` — FOUND
- `/Users/pushkarev/PROD/astore shop/astore ePRM Программа для учете бизнесса- касса не доделана/astore-erp/src/lib/orders/discount.ts` — FOUND

### Commits

- `3289e07` — FOUND in git log (Task 1 schema migrations)
- `1d652aa` — FOUND in git log (Task 2 discount.ts)

### Migration state

- `npx prisma migrate status` — "Database schema is up to date"
- `SELECT COUNT(*) FROM Payment WHERE shiftId IS NULL` → 0
- `SELECT COUNT(*) FROM Return WHERE refundMethod IS NULL` → 0
- `information_schema.columns` confirms: Payment.shiftId NOT NULL, Return.refundMethod NOT NULL, CustomOrder.cancellationType NULL, CustomOrder.cancelReason NULL

### Function verification

- `src/lib/orders/discount.ts` exports `computePerUnitDiscount` with signature matching 08-01 contract
- Sanity tests (7/7): zero discount, empty items, 3×100/100 residual, 99.99/2, qty>1 per-unit split, all-zero prices (no div-by-zero), mixed quantities (3+2+4, 77.77) — all pass
- ESLint (`npx eslint src/lib/orders/discount.ts`) — no errors
- TypeScript (`npx tsc --noEmit | grep discount.ts`) — no errors in discount.ts

## Self-Check: PASSED

## Schema Diff

| Table       | Column           | Before            | After                      | Req    |
| ----------- | ---------------- | ----------------- | -------------------------- | ------ |
| Payment     | shiftId          | `String?` SetNull | `String NOT NULL` Restrict | FIN-11 |
| Return      | refundMethod     | `PaymentMethod?`  | `PaymentMethod NOT NULL`   | FIN-09 |
| CustomOrder | cancellationType | (absent)          | `String?` (HOLD/REFUND)    | FIN-06 |
| CustomOrder | cancelReason     | (absent)          | `String?` (audit)          | FIN-06 |

## Migration Backfill Stats (dev DB)

| Step                         | Payments updated    | Residual NULL |
| ---------------------------- | ------------------- | ------------- |
| Initial                      | —                   | 22            |
| 1a Sale window-match         | 0 (no window match) | 22            |
| 1b CustomOrder window-match  | 0                   | 22            |
| 1c Repair window-match       | 0                   | 22            |
| 2a Sale nearest-shift        | 11                  | 11            |
| 2b CustomOrder nearest-shift | 9                   | 2             |
| 2c Repair nearest-shift      | 0                   | 2             |
| 3 Orphan via Payment.storeId | 2                   | **0**         |

Guard passed: `RAISE EXCEPTION` not triggered.

Return backfill: 0 rows touched (dev DB had 0 NULL refundMethod to start with).

## computePerUnitDiscount API

```typescript
// src/lib/orders/discount.ts
import { Prisma } from "@/generated/prisma/client"
import { sum, sub, mul, div, toMoney, type DecimalLike } from "@/lib/money"

export interface DiscountItem {
  price: DecimalLike // Decimal | string | number
  quantity: number // должно быть > 0
}

export function computePerUnitDiscount(
  items: DiscountItem[],
  totalDiscount: Prisma.Decimal,
): Prisma.Decimal[]
```

**Инвариант:** `sum(result[i].mul(items[i].quantity)) === totalDiscount` (exact, no drift).

**Fast paths:** totalDiscount === 0 → zeros; empty items → []; all-zero prices → zeros.

## Wave 2 Readiness Checklist

- [x] Payment.shiftId NOT NULL — `completeOrder` может полагаться на гарантию, не нужен `?? null`
- [x] Return.refundMethod NOT NULL — `createReturn` refund method validation unlocked
- [x] CustomOrder.cancellationType — `cancelOrderWithDecision` пишет `'HOLD' | 'REFUND'`
- [x] CustomOrder.cancelReason — `cancelOrderWithDecision` пишет причину из CancelDialog
- [x] `computePerUnitDiscount` доступна в `@/lib/orders/discount` для completion flow
- [x] Prisma client regenerated (`npx prisma generate`) — новые типы доступны
- [ ] **Wave 0 (08-01) unit test `compute-per-unit-discount.test.ts` GREEN** — зависит от параллельного плана 08-01, который ещё не завершён на момент коммита 1d652aa. Мой контракт (function signature + behavior) совпадает с описанием из 08-01 PLAN.md, тест станет GREEN автоматически когда 08-01 его поставит.
- [ ] **Wave 2 (08-03) правит src/actions/\*.ts** — TS compile сейчас красный в 7 местах orders/sales/repairs/trade-in.ts. Это ожидаемая граница: Plan 08-03 снимает ошибки за счёт убирания `?? null` паттернов и корректного shiftId requirement.

## Next Phase Readiness

Wave 1 (08-02) **complete**. Разблокировано:

- Plan 08-03: Orders completion/cancellation refactor (нуждался в schema constraints и discount helper)
- Plan 08-04: Returns sync (нуждался в Return.refundMethod NOT NULL)

Blockers: Wave 0 (08-01) должен завершиться чтобы полноценный unit test пошёл в GREEN — это параллельная работа, не блокирует наш merge.

---

_Phase: 08-order-sale-flow_
_Completed: 2026-04-08_
