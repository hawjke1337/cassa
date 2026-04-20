---
phase: 01-security
verified: 2026-04-05T13:48:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 1: Security — Verification Report

**Phase Goal:** Ни одна операция в системе не может быть выполнена с подменёнными данными, без нужных прав или в обход контроля доступа
**Verified:** 2026-04-05T13:48:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Продавец не может передать произвольную цену или себестоимость через DevTools/API — сервер всегда берёт sellPrice и costPrice из StoreProduct/SerialUnit | VERIFIED | `createSale(rawData: CreateSaleInput)` + `createSaleSchema.parse(rawData)` в sales.ts:125. Zod-схема не содержит полей price/costPrice. Цены грузятся из `sp.sellPrice`, `sp.costPrice`, `unit.costPrice` (строки 79, 80, 118, 119, 180). |
| 2 | Скидка ограничена: >= 0 и <= sellPrice; скидка > 30% от цены требует permission pos.discount_high | VERIFIED | sales.ts:203-213: `if (item.discount > price)` + `if (item.discount / price > 0.3)` + `checkPermission("pos.discount_high", ...)`. permissions-list.ts:57: `POS_DISCOUNT_HIGH` существует. |
| 3 | quantity валидируется: > 0, целое, <= остаток на складе | VERIFIED | validations/sales.ts: `z.number().int(...).positive(...)`. sales.ts: `if (sp.quantity < item.quantity) throw ...` |
| 4 | Продажа невозможна без открытой кассовой смены — возвращается ошибка "Откройте кассовую смену перед продажей" | VERIFIED | sales.ts:141-143: `if (!openShift) { throw new Error("Откройте кассовую смену перед продажей") }` |
| 5 | Возврат проверяет что продажа принадлежит текущему магазину (storeId) | VERIFIED | sales.ts:577-584: `saleForAuth = await db.sale.findUnique(...)` → `requirePermission("pos.return", saleForAuth.storeId)` |
| 6 | После изменения ролей пользователя его permissions обновляются при следующем запросе (без перелогина) | VERIFIED | auth.ts:91-98: `if (dbUser.permissionsVersion !== token.permissionsVersion)` → перезагрузка permissions. settings.ts:342,412: `permissionsVersion: { increment: 1 }` при toggleUserActive и updateUserRoles. |
| 7 | После 5 неудачных попыток логина аккаунт временно блокируется на 15 минут | VERIFIED | rate-limit.ts: `MAX_ATTEMPTS = 5`, `LOCK_DURATION_MS = 15 * 60 * 1000`. auth.ts:23-44: `checkRateLimit` + `recordFailedAttempt`. 5 тестов проходят. |
| 8 | Пароль короче 8 символов отклоняется при создании/смене пользователя | VERIFIED | settings.ts:251,352,514: `length < 8` в трёх местах (createUser, resetUserPassword, changePassword). |
| 9 | writeSerialHistory не доступна как server action — это internal helper | VERIFIED | serial-history.ts: не содержит `"use server"`. serial-units.ts:6: `import { writeSerialHistory } from "@/lib/serial-history"`. Прямой export удалён. |
| 10 | Продавец магазина А не может провести trade-in операции в магазине Б — storeId проверяется в requirePermission | VERIFIED | trade-in.ts: все 9 вызовов `requirePermission` содержат storeId (строки 30, 75, 129, 196, 214, 250, 354, 393, 410). Тест permissions-store-scope проходит. |
| 11 | Отчёты проверяют storeId — продавец видит только данные своего магазина | VERIFIED | reports.ts: `requirePermission("reports.sales", params.storeId)` (стр. 17), `requirePermission("reports.profit", params.storeId)` (стр. 152), аналогично для inventory, seller, fund. Все-магазинные запросы требуют `reports.full`. |
| 12 | Payroll: manage/confirm/pay — разные permissions (не одно motivation.payroll.view на всё) | VERIFIED | motivation-payroll.ts: `generatePayroll` → manage (стр.52), `confirmPayroll` → confirm (стр.197), `markPayrollPaid` → pay (стр.210), `deletePayroll` → manage (стр.223). |
| 13 | getDocumentData для RECEIVE_DOC и WRITE_OFF_DOC проверяет permissions | VERIFIED | document-templates.ts:257: `requirePermission("inventory.receive", receive.storeId)`, стр.287: `requirePermission("inventory.writeoff", writeOff.storeId)`. |
| 14 | getCurrentShift и checkOpenShift проверяют store-scoped permissions | VERIFIED | shifts.ts:11: `requirePermission("shifts.view", storeId)` в getCurrentShift. shifts.ts:406: `requirePermission("shifts.view", storeId)` в checkOpenShift. |
| 15 | Все тесты зелёные, TypeScript компилируется | VERIFIED | `npx vitest run`: 30 passed (5 test files). `npx tsc --noEmit`: выход без ошибок. |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | Vitest конфиг с @/ alias | VERIFIED | Содержит `alias: { "@": path.resolve(...) }` |
| `src/lib/validations/sales.ts` | Zod-схема без price/costPrice | VERIFIED | Экспортирует `createSaleSchema`, `CreateSaleInput`. Поля price/costPrice отсутствуют. |
| `src/actions/sales.ts` | Серверная загрузка цен, валидация смены, скидок | VERIFIED | `createSaleSchema.parse()`, `sp.sellPrice`, открытая смена, `pos.discount_high`, `saleForAuth.storeId` |
| `src/lib/rate-limit.ts` | In-memory rate limiter 5/15min | VERIFIED | `MAX_ATTEMPTS = 5`, `LOCK_DURATION_MS = 900000`. Экспортирует checkRateLimit, recordFailedAttempt, clearAttempts. |
| `src/lib/serial-history.ts` | writeSerialHistory без "use server" | VERIFIED | Файл существует, "use server" отсутствует, экспортирует writeSerialHistory. |
| `src/lib/auth.ts` | JWT callback с version-based reload | VERIFIED | Содержит `permissionsVersion` сравнение, rate limiting, деактивация обнуляет permissions. |
| `src/lib/auth.config.ts` | `maxAge: 900` (15 минут) | VERIFIED | Строка 4: `session: { strategy: "jwt", maxAge: 900 }` |
| `prisma/schema.prisma` | User.permissionsVersion field | VERIFIED | Строка 54: `permissionsVersion Int @default(1)` |
| `src/lib/permissions-list.ts` | MOTIVATION_PAYROLL_MANAGE/CONFIRM/PAY | VERIFIED | Строки 57-59: все три кода существуют. |
| `src/actions/trade-in.ts` | storeId в requirePermission | VERIFIED | 9 из 9 вызовов requirePermission содержат storeId. |
| `src/actions/reports.ts` | Store-scoped permission checks | VERIFIED | storeId передаётся во всех report functions; all-stores требует reports.full. |
| `src/actions/motivation-payroll.ts` | Разделённые payroll permissions | VERIFIED | manage/confirm/pay/view разделены по операциям. |
| `src/actions/shifts.ts` | getCurrentShift и checkOpenShift с storeId | VERIFIED | Обе функции: `requirePermission("shifts.view", storeId)`. |
| `src/actions/document-templates.ts` | Permission check в getDocumentData | VERIFIED | RECEIVE_DOC и WRITE_OFF_DOC проверяют permissions с storeId. |
| `src/__tests__/permissions-store-scope.test.ts` | 13 тестов для PERM-01..05 | VERIFIED | 13 тестов, все зелёные. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/sales.ts` | `src/lib/validations/sales.ts` | `import createSaleSchema` + `.parse(rawData)` | WIRED | sales.ts:7 + sales.ts:125 |
| `src/actions/sales.ts` | prisma StoreProduct | `tx.storeProduct.findUnique` в транзакции | WIRED | sales.ts: 5+ обращений к storeProduct |
| `src/actions/sales.ts` | `createReturn` → storeId check | `saleForAuth.storeId` в requirePermission | WIRED | sales.ts:577-584 |
| `src/lib/auth.ts` | `src/lib/rate-limit.ts` | `checkRateLimit`, `recordFailedAttempt`, `clearAttempts` в authorize | WIRED | auth.ts:7 import + auth.ts:23-48 |
| `src/lib/auth.ts` | `User.permissionsVersion` | version comparison в jwt callback | WIRED | auth.ts:67,91,98 |
| `src/actions/serial-units.ts` | `src/lib/serial-history.ts` | `import { writeSerialHistory } from "@/lib/serial-history"` | WIRED | serial-units.ts:6 + serial-units.ts:217 |
| `src/actions/trade-in.ts` | `src/lib/permissions.ts` | `requirePermission` с storeId во всех операциях | WIRED | 9 вызовов со storeId |
| `src/actions/reports.ts` | `src/lib/permissions.ts` | `requirePermission` с storeId или reports.full | WIRED | reports.ts:17,19,152,154,258,369,371,442,444 |
| `src/actions/shifts.ts` | `src/lib/permissions.ts` | `requirePermission("shifts.view", storeId)` | WIRED | shifts.ts:11,406 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SEC-01 | 01-01 | Сервер валидирует sellPrice из БД | SATISFIED | `createSaleSchema.parse()` strips price; `Number(sp.sellPrice)` в транзакции |
| SEC-02 | 01-01 | Сервер валидирует costPrice из БД | SATISFIED | `Number(sp.costPrice)` / `Number(unit.costPrice)` в транзакции |
| SEC-03 | 01-01 | Скидка >= 0, <= price, >30% требует permission | SATISFIED | Zod min(0) + runtime checks + `pos.discount_high` gate |
| SEC-04 | 01-01 | quantity > 0, целое, <= остаток | SATISFIED | Zod `.int().positive()` + `sp.quantity < item.quantity` |
| SEC-05 | 01-01 | Продажа запрещена без открытой смены | SATISFIED | `if (!openShift) throw new Error("Откройте кассовую смену...")` |
| SEC-06 | 01-01 | Возврат проверяет storeId продажи | SATISFIED | `requirePermission("pos.return", saleForAuth.storeId)` |
| AUTH-01 | 01-02 | JWT обновляет permissions при изменении ролей | SATISFIED | version-based reload в jwt callback + permissionsVersion increment |
| AUTH-02 | 01-02 | Rate limiting: блокировка после N неудачных попыток | SATISFIED | rate-limit.ts + auth.ts + 5 проходящих тестов |
| AUTH-03 | 01-02 | Минимальная длина пароля 8 символов | SATISFIED | settings.ts: 3 места с `length < 8` |
| AUTH-04 | 01-02 | writeSerialHistory не server action | SATISFIED | serial-history.ts без "use server"; serial-units.ts импортирует из lib |
| PERM-01 | 01-03 | Trade-in проверяет storeId | SATISFIED | 9 requirePermission вызовов со storeId в trade-in.ts |
| PERM-02 | 01-03 | Отчёты проверяют storeId | SATISFIED | Все report functions проверяют storeId; all-stores требует reports.full |
| PERM-03 | 01-03 | Payroll: view/manage/confirm/pay раздельно | SATISFIED | motivation-payroll.ts: операции используют разные permission codes |
| PERM-04 | 01-03 | getDocumentData проверяет permissions | SATISFIED | document-templates.ts: RECEIVE_DOC → inventory.receive, WRITE_OFF_DOC → inventory.writeoff |
| PERM-05 | 01-03 | getCurrentShift/checkOpenShift с store-scope | SATISFIED | shifts.ts:11,406: `requirePermission("shifts.view", storeId)` |

**Orphaned requirements:** Нет. Все 15 requirement IDs, заявленных в планах, присутствуют в REQUIREMENTS.md и покрыты реализацией.

---

### Anti-Patterns Found

Ни одного блокирующего или предупредительного анти-паттерна не обнаружено в ключевых файлах фазы (sales.ts, auth.ts, rate-limit.ts, serial-history.ts, validations/sales.ts, trade-in.ts, reports.ts, motivation-payroll.ts, shifts.ts, document-templates.ts).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/actions/sales.ts` | 427, 491 | `requirePermission("pos.return")` без storeId в `searchSaleByNumber`/`searchSaleByImei` | Info | Функции поиска возвращают данные о продаже, но не проверяют принадлежность магазину. За рамками требований фазы 1 — DATA-09 Phase 2. |

---

### Human Verification Required

#### 1. Rate limiting persistence across deploys

**Test:** Перезапустить сервер Next.js в dev-режиме, выполнить 3 неудачных попытки логина, перезапустить сервер, попробовать снова.
**Expected:** Счётчик попыток сбрасывается при перезапуске (in-memory хранение).
**Why human:** Это известное ограничение in-memory rate limiter — задокументировано в Summary как приемлемое для single-instance ePRM.

#### 2. JWT expiry + permission reload в браузере

**Test:** Залогиниться, дождаться 15 минут (или изменить maxAge в dev на 10 секунд), выполнить действие в POS.
**Expected:** Сессия обновляется прозрачно (если refresh token работает) или пользователя перенаправляет на логин.
**Why human:** Реальное поведение JWT expiry в браузере нельзя проверить статически.

#### 3. Discount >30% диалог в POS UI

**Test:** В POS применить скидку >30% от цены товара под ролью без `pos.discount_high`.
**Expected:** Ошибка "Скидка X% превышает 30%. Требуется разрешение 'Скидка свыше 30%'"
**Why human:** Требует UI-взаимодействие и активную роль без permission.

---

### Gaps Summary

Gaps отсутствуют. Все 15 требований фазы 1 реализованы и верифицированы.

---

## Test Results

```
Test Files  5 passed (5)
     Tests  30 passed (30)
  Duration  182ms
```

Все тесты зелёные:
- `src/__tests__/sales-validation.test.ts` — 6 тестов (SEC-01..04)
- `src/__tests__/rate-limit.test.ts` — 5 тестов (AUTH-02)
- `src/__tests__/password-validation.test.ts` — 3 теста (AUTH-03)
- `src/__tests__/auth-jwt.test.ts` — 3 теста (AUTH-01 концептуальные)
- `src/__tests__/permissions-store-scope.test.ts` — 13 тестов (PERM-01..05)

TypeScript: `npx tsc --noEmit` — выход 0, без ошибок.

---

_Verified: 2026-04-05T13:48:00Z_
_Verifier: Claude (gsd-verifier)_
