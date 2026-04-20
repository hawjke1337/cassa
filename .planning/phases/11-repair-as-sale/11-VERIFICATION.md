---
phase: 11-repair-as-sale
verified: 2026-04-11T21:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Проверить отображение ремонтной выручки в UI дашборда"
    expected: "Revenue-виджет дашборда показывает суммы ремонтов (Sale type=REPAIR) в итогах за день"
    why_human: "Тест REPAIR-02 воспроизводит DB-запрос напрямую, но UI дашборда не покрыт E2E"
  - test: "Проверить отображение COGS запчастей в UI отчёта по прибыли"
    expected: "Profit report показывает costPrice из SaleItem ремонта как COGS"
    why_human: "REPAIR-04 доказывает запись SaleItem с корректным costPrice, UI рендеринг не верифицирован"
---

# Phase 11: Repair as Sale — Verification Report

**Phase Goal:** Ремонт при выдаче становится полноценной продажей — выручка видна в отчётах, запчасти списаны и учтены как COGS, гарантия работает по проданным IMEI
**Verified:** 2026-04-11T21:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                       | Status   | Evidence                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | При переводе ремонта в DELIVERED создается Sale с type=REPAIR, finalAmount=repair.finalCost | VERIFIED | `repairs.ts:444-456` `tx.sale.create({ type: "REPAIR", status: "COMPLETED" })`; E2E test "REPAIR-01: DELIVERED creates Sale with type=REPAIR" passes                                                                      |
| 2   | Платежи ремонта re-parent из repairId в saleId при создании Sale                            | VERIFIED | `repairs.ts:479-482` `tx.payment.updateMany({ where: { repairId }, data: { saleId, repairId: null } })`; E2E test "REPAIR-01: payments re-parented from repair to sale" passes                                            |
| 3   | SaleItems создаются из RepairParts при DELIVERED (для COGS)                                 | VERIFIED | `repairs.ts:465-476` `tx.saleItem.create` с aggregated `costPrice` из RepairParts; E2E tests "REPAIR-04: SaleItems created from RepairParts with COGS" и "labor-only costPrice=0" pass                                    |
| 4   | Dashboard revenue включает repair Sale                                                      | VERIFIED | Sale(type=REPAIR, status=COMPLETED) попадает в `getDashboardData` запрос по `status: "COMPLETED"`; E2E test "REPAIR-02: dashboard revenue query includes repair Sale" passes                                              |
| 5   | StoreProduct.quantity декрементируется с SELECT FOR UPDATE при addRepairPart                | VERIFIED | `repairs.ts:668-681` raw SQL `FOR UPDATE` + `storeProduct.update({ decrement })`; E2E test "REPAIR-03: addRepairPart decrements StoreProduct.quantity" passes                                                             |
| 6   | removeRepairPart восстанавливает stock                                                      | VERIFIED | `repairs.ts:717-720` `storeProduct.updateMany({ increment: part.quantity })`; E2E test "REPAIR-03: removeRepairPart restores StoreProduct.quantity" passes                                                                |
| 7   | Изменение стоимости ремонта записывается в RepairCostHistory                                | VERIFIED | `repairs.ts:506,583` два вызова `tx.repairCostHistory.create`; E2E tests "updateRepair creates RepairCostHistory for agreedCost change" и "updateRepairStatus to COMPLETED with finalCost creates RepairCostHistory" pass |
| 8   | Изменение стоимости после COMPLETED/DELIVERED отклоняется                                   | VERIFIED | `repairs.ts:16-19` `export function assertCostNotFrozen`; вызывается в `updateRepair:408` и `updateRepairStatus:563`; 5 E2E тестов покрывают COMPLETED и DELIVERED                                                        |
| 9   | Гарантийный поиск находит SOLD+IN_STOCK устройства и ищет по Sale.number                    | VERIFIED | `warranty-claims.ts:329` `status: { in: ["SOLD", "IN_STOCK"] }`; `warranty-claims.ts:392-394` `db.sale.findFirst({ number: trimmedImei })`; 6 E2E тестов для REPAIR-07, REPAIR-08, REPAIR-09 pass                         |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                          | Expected                                                                                      | Status   | Details                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                            | RepairPart, RepairCostHistory models; SaleType.REPAIR; Repair.saleId                          | VERIFIED | `model RepairPart` line 750; `model RepairCostHistory` line 766; `REPAIR` in SaleType enum line 282; `saleId String? @unique` in Repair model line 720                                     |
| `src/actions/repairs.ts`                          | Cost freeze guard + RepairCostHistory audit; addRepairPart; removeRepairPart; DELIVERED->Sale | VERIFIED | `assertCostNotFrozen` exported line 16; `repairCostHistory.create` at lines 506,583; `addRepairPart` at line 646; `removeRepairPart` at line 700; `sale.create(type:"REPAIR")` at line 444 |
| `src/actions/warranty-claims.ts`                  | SOLD+IN_STOCK filter; Sale.number search                                                      | VERIFIED | Filter at line 329; sale.findFirst search at lines 392-394                                                                                                                                 |
| `src/__tests__/e2e/repair-cost-audit.e2e.test.ts` | 9 E2E tests for REPAIR-05, REPAIR-06                                                          | VERIFIED | 9 it() blocks covering cost history creation and cost freeze enforcement — all pass                                                                                                        |
| `src/__tests__/e2e/repair-as-sale.e2e.test.ts`    | 12 E2E tests for REPAIR-01..04                                                                | VERIFIED | 12 it() blocks covering REPAIR-01 through REPAIR-04 — all pass                                                                                                                             |
| `src/__tests__/e2e/warranty-lookup.e2e.test.ts`   | 6 E2E tests for REPAIR-07..09                                                                 | VERIFIED | 6 it() blocks covering all warranty lookup requirements — all pass                                                                                                                         |
| `src/__tests__/helpers/fixtures.ts`               | createTestRepair + createTestRepairPart helpers                                               | VERIFIED | `createTestRepair` line 226; `createTestRepairPart` line 264                                                                                                                               |

### Key Link Verification

| From                                        | To                                  | Via                                                                      | Status | Details                                                                                                                                          |
| ------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `repairs.ts updateRepair`                   | `RepairCostHistory`                 | `tx.repairCostHistory.create` inside transaction                         | WIRED  | Line 506 — cost history created atomically with repair update                                                                                    |
| `repairs.ts updateRepairStatus`             | `RepairCostHistory`                 | `tx.repairCostHistory.create` inside transaction                         | WIRED  | Line 583 — finalCost history recorded on COMPLETED transition                                                                                    |
| `repairs.ts` cost guard                     | COMPLETED/DELIVERED block           | `assertCostNotFrozen(repair.status)` at update/status change             | WIRED  | Lines 408 and 563 call `assertCostNotFrozen` before any cost mutation                                                                            |
| `repairs.ts updateRepairStatus DELIVERED`   | `Sale creation + Payment re-parent` | `$transaction` with `sale.create + payment.updateMany + saleItem.create` | WIRED  | Lines 444-482 inside `if (newStatus === "DELIVERED")` block                                                                                      |
| `repairs.ts addRepairPart`                  | `StoreProduct stock decrement`      | SELECT FOR UPDATE + `storeProduct.update({ decrement })`                 | WIRED  | Lines 668-681 — raw SQL lock + Prisma decrement                                                                                                  |
| `repairs.ts removeRepairPart`               | `StoreProduct stock restore`        | `storeProduct.updateMany({ increment: part.quantity })`                  | WIRED  | Line 719                                                                                                                                         |
| `Sale (type=REPAIR, status=COMPLETED)`      | `Dashboard revenue + Profit COGS`   | Existing queries filter `status: "COMPLETED"` and join `SaleItem`        | WIRED  | Sale enters `getDashboardData` automatically; SaleItem with costPrice enters profit report automatically — proven by E2E REPAIR-02 and REPAIR-04 |
| `warranty-claims.ts lookupForWarrantyClaim` | `SerialUnit SOLD+IN_STOCK filter`   | `status: { in: ["SOLD", "IN_STOCK"] }`                                   | WIRED  | Line 329                                                                                                                                         |
| `warranty-claims.ts lookupForWarrantyClaim` | `Sale.number search`                | `db.sale.findFirst({ number: trimmedImei })`                             | WIRED  | Lines 392-394 before final `not_found` return                                                                                                    |

### Requirements Coverage

| Requirement | Source Plan   | Description                                                  | Status    | Evidence                                                                                          |
| ----------- | ------------- | ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| REPAIR-01   | 11-02-PLAN.md | DELIVERED создаёт Sale(REPAIR) + re-parent payments + saleId | SATISFIED | sale.create(type=REPAIR) at repairs.ts:444; payment.updateMany at line 479; E2E tests pass        |
| REPAIR-02   | 11-02-PLAN.md | getDashboardData revenue включает Repair выручку             | SATISFIED | Sale(COMPLETED) auto-included in dashboard query; E2E REPAIR-02 test pass                         |
| REPAIR-03   | 11-02-PLAN.md | StoreProduct.quantity декрементится при запчастях            | SATISFIED | SELECT FOR UPDATE + decrement at repairs.ts:668-681; E2E REPAIR-03 tests pass                     |
| REPAIR-04   | 11-02-PLAN.md | Запчасти учитываются как COGS в profit report                | SATISFIED | SaleItem created with aggregated costPrice at repairs.ts:465-476; E2E REPAIR-04 tests pass        |
| REPAIR-05   | 11-01-PLAN.md | RepairCostHistory аудит estimatedCost/agreedCost/finalCost   | SATISFIED | repairCostHistory.create at repairs.ts:506,583; 3 E2E tests pass                                  |
| REPAIR-06   | 11-01-PLAN.md | Изменение стоимости запрещено после COMPLETED/DELIVERED      | SATISFIED | assertCostNotFrozen exported and called at lines 408,563; 5 E2E tests covering both statuses pass |
| REPAIR-07   | 11-03-PLAN.md | Гарантийный поиск расширен на SOLD+IN_STOCK                  | SATISFIED | warranty-claims.ts:329 `{ in: ["SOLD", "IN_STOCK"] }`; 2 E2E tests pass                           |
| REPAIR-08   | 11-03-PLAN.md | warrantyUntil проверяется при создании WarrantyClaim         | SATISFIED | createWarrantyClaim checks at warranty-claims.ts:112-128; 2 E2E tests (expired/valid) pass        |
| REPAIR-09   | 11-03-PLAN.md | Поиск гарантии по IMEI, номеру чека, номеру продажи          | SATISFIED | Sale.number search at warranty-claims.ts:392-394; 2 E2E tests pass                                |

**Note:** The coverage table in REQUIREMENTS.md (lines 420-428) still shows "Pending" for all REPAIR requirements. This is a stale documentation artifact — the main checklist at lines 171-179 correctly marks all REPAIR items `[x]`. No code gap.

### Anti-Patterns Found

No anti-patterns detected in modified files:

- No TODO/FIXME/PLACEHOLDER comments in `repairs.ts` or `warranty-claims.ts`
- No empty implementations (`return null`, `return {}`, `return []`)
- No stub handlers
- No console.log-only implementations

### Human Verification Required

#### 1. Repair Revenue in Dashboard UI

**Test:** Создать ремонт, добавить запчасти, перевести в DELIVERED через UI — открыть дашборд
**Expected:** Выручка от ремонта отображается в виджете "Выручка за сегодня"
**Why human:** E2E тест REPAIR-02 воспроизводит SQL-запрос напрямую из БД, минуя UI рендеринг и Next.js Server Components

#### 2. Repair COGS in Profit Report UI

**Test:** Открыть отчёт по прибыли после ремонта с запчастями — проверить колонку COGS/себестоимость
**Expected:** Сумма запчастей ремонта видна как costPrice в отчёте по прибыли
**Why human:** REPAIR-04 доказывает запись корректного SaleItem.costPrice в БД, но UI profit report не покрыт E2E

### Gaps Summary

No gaps. All 9 phase requirements (REPAIR-01 through REPAIR-09) are implemented, wired, and tested with 27 passing E2E tests across 3 test files.

The single failing E2E test in the suite (`partial-return-per-unit.e2e.test.ts`) belongs to a different phase (FIN-08) and is unrelated to phase 11 scope.

---

**Test execution summary:**

- `repair-cost-audit.e2e.test.ts`: 9/9 tests pass (REPAIR-05, REPAIR-06)
- `repair-as-sale.e2e.test.ts`: 12/12 tests pass (REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04)
- `warranty-lookup.e2e.test.ts`: 6/6 tests pass (REPAIR-07, REPAIR-08, REPAIR-09)
- Total: 27/27 phase 11 tests pass
- `npx prisma validate`: exits 0

---

_Verified: 2026-04-11T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
