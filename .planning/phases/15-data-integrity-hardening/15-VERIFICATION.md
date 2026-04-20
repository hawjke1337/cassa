---
phase: 15-data-integrity-hardening
verified: 2026-04-14T12:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: false
---

# Phase 15: Data Integrity Hardening Verification Report

**Phase Goal:** На уровне БД и API закрыты последние дыры целостности — Payment exclusivity, varchar limits, UTC, IMEI/phone normalization, optimistic locking
**Verified:** 2026-04-14
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                       | Status     | Evidence                                                                                                |
|----|--------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------|
| 1  | Payment с двумя FK отклоняется на уровне БД                                                | VERIFIED   | `chk_payment_exclusivity` CHECK constraint in migration.sql, proven by E2E test at line 152            |
| 2  | Payment без FK (не isExpense) отклоняется на уровне БД                                    | VERIFIED   | Same CHECK constraint, E2E test at line 111                                                             |
| 3  | isExpense=true Payment без FK разрешён                                                     | VERIFIED   | CHECK allows `isExpense=true AND all FKs NULL`, E2E positive case tested                               |
| 4  | StoreProduct.quantity < 0 невозможно на уровне БД                                         | VERIFIED   | `chk_store_product_quantity` CHECK in migration.sql, E2E assertion at line 242                         |
| 5  | SaleItem.quantity < 0 невозможно на уровне БД                                             | VERIFIED   | `chk_sale_item_quantity` CHECK, E2E assertion at line 299                                              |
| 6  | Два SerialUnit с одинаковым productId и imei невозможны                                    | VERIFIED   | `SerialUnit_productId_imei_unique` partial index (WHERE imei IS NOT NULL) in migration.sql             |
| 7  | Все текстовые поля без @db.VarChar имеют лимиты                                            | VERIFIED   | 115 `@db.VarChar` annotations in schema.prisma; Sale.comment VarChar(1000), Repair.defectDescription VarChar(2000) confirmed |
| 8  | Удаление User (soft delete) не каскадно удаляет UserRole/UserStore/MotivationAssignment    | VERIFIED   | `onDelete: SetNull` on UserRole.user, UserStore.user, MotivationAssignment.user in schema; userId nullable |
| 9  | Телефон сохраняется в нормализованном формате +7XXXXXXXXXX                                 | VERIFIED   | `normalizePhoneOrThrow` called in repairs.ts, orders.ts, customers.ts, suppliers.ts, settings.ts before DB write |
| 10 | IMEI проходит Luhn-валидацию при приёмке, обновлении, trade-in, импорте                   | VERIFIED   | `validateImeiOrThrow` in repairs.ts (line 308), trade-in.ts (line 140), orders.ts (line 923)           |
| 11 | Невалидный IMEI отклоняется с понятной ошибкой                                            | VERIFIED   | `validateImeiOrThrow` throws "Невалидный IMEI устройства" — tested in phone-imei E2E test              |
| 12 | Телефон без цифр или слишком короткий отклоняется                                         | VERIFIED   | `normalizePhone` returns null for invalid inputs; `normalizePhoneOrThrow` throws — tested              |
| 13 | Отчёт за дату использует MSK boundaries (UTC+3)                                           | VERIFIED   | `toMskDateRange` imported and used in reports.ts, dashboard.ts uses `mskToday()`, shifts.ts uses mskStartOfDay/mskEndOfDay |
| 14 | Два пользователя редактируют MotivationScheme — второй получает ошибку                    | VERIFIED   | `updateMotivationScheme` in motivation-schemes.ts: updateMany with version WHERE clause, "Данные были изменены другим пользователем" at line 155; DB mechanism proven by E2E test (secondUpdate.count === 0) |
| 15 | MotivationScheme.formula проходит валидацию перед сохранением                             | VERIFIED   | `validateMotivationFormula()` called at line 132 in motivation-schemes.ts before any save              |
| 16 | При применении formula к MotivationAssignment сохраняется snapshot                        | VERIFIED   | `formulaSnapshot: scheme.formula` in motivation-assignments.ts line 70; `formulaSnapshot Json?` in schema line 953 |
| 17 | При повторном ремонте с тем же IMEI создаётся новый Repair, привязанный к существующему DeviceRecord | VERIFIED | `findOrCreateDeviceRecordTx` called in repairs.ts line 319; uses `findFirst` with OR on imei/imei2/serialNumber |
| 18 | Unguarded date boundaries в reports/dashboard/shifts равны нулю                           | VERIFIED   | All `gte: dateFrom` / `lte: dateTo` in reports.ts use MSK-converted variables (range.gte/range.lte from toMskDateRange); dashboard uses mskToday(); shifts use mskStartOfDay/mskEndOfDay |
| 19 | История ролей и назначений сохраняется после soft delete пользователя                     | VERIFIED   | SetNull cascade + nullable userId in UserRole, UserStore, MotivationAssignment confirmed in schema     |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact                                                                 | Expected                                              | Status    | Details                                                                                          |
|--------------------------------------------------------------------------|-------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------|
| `prisma/migrations/20260414_data_integrity_checks/migration.sql`        | CHECK constraints for Payment exclusivity + quantity  | VERIFIED  | Contains all 6 constraint names: chk_payment_exclusivity, chk_store_product_quantity, chk_sale_item_quantity, chk_receive_item_quantity, chk_return_item_quantity, SerialUnit_productId_imei_unique |
| `prisma/migrations/20260414140035_varchar_limits_cascade_safety/migration.sql` | VarChar limits + cascade changes               | VERIFIED  | Migration exists, schema shows 115 VarChar annotations applied                                  |
| `src/__tests__/e2e/data-integrity-constraints.e2e.test.ts`             | E2E tests proving DB constraints reject invalid data  | VERIFIED  | 451 lines (min 80), uses real DB via `$executeRawUnsafe`, tests all 3 constraint groups          |
| `prisma/schema.prisma`                                                  | VarChar limits + SetNull cascades + version field     | VERIFIED  | 115 @db.VarChar annotations, SetNull on 3 User relations, version Int @default(1) on MotivationScheme, formulaSnapshot Json? on MotivationAssignment |
| `src/lib/phone-utils.ts`                                                | normalizePhone(), isValidPhone(), normalizePhoneOrThrow() | VERIFIED | 42 lines (min 20), exports all 3 functions, +7 format logic confirmed                           |
| `src/lib/imei-utils.ts`                                                 | validateImeiOrThrow() throwing variant                | VERIFIED  | 27 lines, exports validateImeiOrThrow, "Невалидный" error message present                        |
| `src/__tests__/e2e/phone-imei-normalization.e2e.test.ts`               | Tests for phone/IMEI normalization                    | VERIFIED  | 110 lines (min 60), 21 tests covering all formats and edge cases                                 |
| `src/lib/timezone.ts`                                                   | MSK timezone conversion helpers                       | VERIFIED  | 57 lines (min 25), exports mskStartOfDay, mskEndOfDay, toMskDateRange, mskToday                  |
| `src/lib/__tests__/timezone.test.ts`                                    | Unit tests for MSK boundary correctness               | VERIFIED  | 60 lines (min 30), 8 tests including year boundary edge case                                     |
| `src/actions/motivation-schemes.ts`                                     | Optimistic locking + formula validation               | VERIFIED  | expectedVersion parameter, "Данные были изменены..." error, validateMotivationFormula() function |
| `src/actions/motivation-assignments.ts`                                 | Formula snapshot storage                              | VERIFIED  | formulaSnapshot stored at line 70                                                                |
| `src/actions/device-records.ts`                                         | findOrCreateDeviceRecordTx with imei2 support         | VERIFIED  | findOrCreateDeviceRecordTx at line 15, findFirst with OR on imei/imei2/serialNumber              |
| `src/__tests__/e2e/optimistic-lock-dedup.e2e.test.ts`                  | E2E tests for locking and dedup                       | VERIFIED  | 266 lines (min 80), real DB, tests version conflict, snapshot immutability, imei/imei2 dedup     |

---

### Key Link Verification

| From                                | To                             | Via                          | Status   | Details                                                   |
|-------------------------------------|--------------------------------|------------------------------|----------|-----------------------------------------------------------|
| `migration.sql (20260414_...)`      | Payment table                  | ALTER TABLE ADD CONSTRAINT   | WIRED    | `chk_payment_exclusivity` present, applied in beforeAll   |
| `prisma/schema.prisma`              | UserRole/UserStore/MotivationAssignment | onDelete: SetNull   | WIRED    | Lines 134, 147, 948 confirmed                             |
| `src/actions/repairs.ts`            | `src/lib/phone-utils.ts`       | import normalizePhoneOrThrow | WIRED    | Line 12 import, line 304 usage                            |
| `src/actions/repairs.ts`            | `src/lib/imei-utils.ts`        | import validateImeiOrThrow   | WIRED    | Line 13 import, line 308 usage                            |
| `src/actions/reports.ts`            | `src/lib/timezone.ts`          | import toMskDateRange        | WIRED    | Line 8 import, used at lines 29, 182, 452, 526, 594       |
| `src/actions/dashboard.ts`          | `src/lib/timezone.ts`          | import mskToday              | WIRED    | Line 7 import, mskToday() at line 14                      |
| `src/actions/motivation-schemes.ts` | MotivationScheme.version field | WHERE version clause         | WIRED    | updateMany with `version: expectedVersion` condition       |
| `src/actions/repairs.ts`            | `src/actions/device-records.ts`| findOrCreateDeviceRecordTx   | WIRED    | Line 7 import, line 319 call inside transaction           |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                 | Status    | Evidence                                                              |
|-------------|-------------|---------------------------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------|
| DATA2-01    | Plan 01     | Payment CHECK constraint: ровно один FK или isExpense                                       | SATISFIED | chk_payment_exclusivity in migration.sql + 4 E2E tests                |
| DATA2-03    | Plan 02     | Текстовые поля @db.VarChar(N)                                                               | SATISFIED | 115 VarChar annotations in schema.prisma                              |
| DATA2-04    | Plan 04     | Reports/dashboard используют MSK (UTC+3) при date filtering                                 | SATISFIED | toMskDateRange/mskToday imported in reports.ts, dashboard.ts, shifts.ts |
| DATA2-05    | Plan 03     | IMEI валидация во всех точках                                                               | SATISFIED | validateImeiOrThrow in repairs.ts, trade-in.ts, orders.ts             |
| DATA2-06    | Plan 02     | User cascade → SetNull для UserRole/UserStore                                               | SATISFIED | onDelete: SetNull + nullable userId in 3 models                       |
| DATA2-07    | Plan 01     | CHECK constraints на quantity-поля                                                          | SATISFIED | 6 CHECK constraints in migration.sql + E2E tests                      |
| DATA2-08    | Plan 03     | normalizePhone() на всех create/update                                                      | SATISFIED | normalizePhoneOrThrow in repairs, orders, customers, suppliers, settings |
| DATA2-09    | Plan 01     | SerialUnit @@unique([productId, imei]) при imei not null                                    | SATISFIED | Partial unique index WHERE imei IS NOT NULL in migration.sql          |
| DATA2-10    | Plan 05     | MotivationScheme.formula валидация + snapshot при применении                                | SATISFIED | validateMotivationFormula() in motivation-schemes.ts + formulaSnapshot in assignments |
| DATA2-11    | Plan 05     | Optimistic locking (version field) для MotivationScheme                                     | SATISFIED | version Int @default(1) in schema + updateMany WHERE version + "Данные были изменены" error |
| DATA2-12    | Plan 05     | DeviceRecord деduplication по IMEI при повторных ремонтах                                  | SATISFIED | findOrCreateDeviceRecordTx with OR on imei/imei2/serialNumber, used in createRepair |

**Note:** DATA2-02 (Decimal.js для денег) is a Phase 7 requirement completed in Plan 07-03 — not in scope for Phase 15. No orphaned Phase 15 requirements found.

---

### Anti-Patterns Found

No blockers or warnings found. Scanning of key files (timezone.ts, phone-utils.ts, imei-utils.ts, motivation-schemes.ts, device-records.ts, repairs.ts) found no TODO/FIXME/placeholder comments, no empty return implementations, and no stub handlers.

**One observation (ℹ️ Info):** The `phone-imei-normalization.e2e.test.ts` file is a unit test file (pure function tests with no DB calls) despite being located in the `e2e/` directory. This is technically a misnomer but does not impact goal achievement — the actual DB round-trip guarantees come from the action wiring (grep-verified) and the E2E infrastructure of the other test files.

**One observation (ℹ️ Info):** The E2E optimistic-locking test exercises the DB version mechanism via raw `db.motivationScheme.updateMany` rather than calling `updateMotivationScheme` (the action). The action's "Данные были изменены другим пользователем" error message is implemented in the action (line 155 confirmed) but not tested via an E2E call-through. The DB behavior is proven; the error path is code-verified.

---

### Human Verification Required

#### 1. MSK Timezone Date Boundary in UI

**Test:** Open a daily sales report for a specific day. Make a sale at 23:30–23:59 local Moscow time. Check the report for that day shows the sale.
**Expected:** Sale appears on the same calendar day as created in Moscow time, not shifted to the next day.
**Why human:** Cannot verify correct timezone rendering in the UI — only server-side date conversion is code-verifiable.

#### 2. Optimistic Locking User Experience

**Test:** Open MotivationScheme editor in two browser tabs. Edit and save in Tab A. Then edit and save in Tab B (without refreshing).
**Expected:** Tab B shows the error message "Данные были изменены другим пользователем. Обновите страницу и попробуйте снова."
**Why human:** The editor-client.tsx wires `version` to the update call, but the full user-facing flow (error display, form state) requires manual verification.

#### 3. Phone Normalization Visible in UI

**Test:** Create a customer with phone "8 (900) 123-45-67". Open the customer record.
**Expected:** Phone displays as +79001234567 (or formatted equivalent) — normalized before storage.
**Why human:** Storage normalization is code-verified; display format in the UI is not verifiable programmatically.

---

### Gaps Summary

No gaps. All 11 required DATA2 requirements for Phase 15 are implemented with substantive code, proper wiring, and confirmed migrations. Phase goal is fully achieved at the DB and API level.

---

_Verified: 2026-04-14_
_Verifier: Claude (gsd-verifier)_
