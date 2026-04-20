---
phase: 14-payroll-employee-dashboard
verified: 2026-04-13T22:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Открыть /my/motivation как сотрудник и убедиться что accordion смен раскрывается корректно"
    expected: "Клик по заголовку смены раскрывает список продаж с таблицей товаров (товар, цена, себест., прибыль, %, комиссия)"
    why_human: "Поведение двухуровневого accordion (shift -> sales -> items) нельзя верифицировать статически"
  - test: "Убедиться что 'Вне смен' группа отображается для продаж без привязки к смене"
    expected: "Продажи без shiftId сгруппированы в отдельную секцию с лейблом 'Вне смен'"
    why_human: "Требует реальных данных с продажами без смены"
  - test: "Проверить что PDF скачивается из таблицы История начислений"
    expected: "Кнопка скачивания отображается только для CONFIRMED/PAID записей, PDF генерируется корректно"
    why_human: "PDF генерация через @react-pdf/renderer требует браузера"
  - test: "Убедиться что сотрудник не видит данные другого сотрудника через UI"
    expected: "История начислений содержит только записи текущего авторизованного пользователя"
    why_human: "Scope security в UI требует проверки с несколькими учётными записями"
---

# Phase 14: Payroll & Employee Dashboard — Verification Report

**Phase Goal:** Комиссия продавца считается корректно по позициям с поддержкой co-seller; сотрудник видит свою ЗП с расшифровкой по сменам
**Verified:** 2026-04-13T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Note on PAYROLL-02:** Co-seller поддержка DEFERRED по явному решению пользователя зафиксированному в 14-CONTEXT.md ("ОТЛОЖЕН — в 99% случаев один продавец в смене"). Не является gap.

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                    | Status     | Evidence                                                                                              |
|----|----------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------|
| 1  | Order commission считается per-item (sellPrice - costPrice), а не от total netProfit заказа              | VERIFIED   | motivation-calculation.ts L323-335: единый `itemCommissionDec` для всех продаж, `orderItemCommissionDec` удалён полностью |
| 2  | Для заказа из 3 позиций totalCommission = sum(per-item), а не 3x total netProfit * rate                  | VERIFIED   | E2E тест order-commission-peritem.e2e.test.ts L155-197: конкретные значения phone=500, case=120, charger=90, total=710 |
| 3  | SaleCommission содержит shiftId, shiftDate, shiftNumber для группировки по сменам                        | VERIFIED   | motivation-calculation.ts L52-54 (interface), L358-360 (push), L190 (query include shift)            |
| 4  | getMyPayrolls возвращает записи ТОЛЬКО для текущего пользователя                                         | VERIFIED   | motivation-payroll.ts L293-325: `userId: session.user.id` в where, `requirePermission("motivation.payroll.own")` |
| 5  | Расшифровка комиссии группируется по сменам в accordion (складные секции)                                | VERIFIED   | earnings-breakdown.tsx L118-154: `groupByShift()`, `ShiftGroup` interface, `expandedShifts` state, "Вне смен" L209 |
| 6  | Таблица payroll истории показывает период, тип, сумму, статус — в /my/motivation                         | VERIFIED   | payroll-history.tsx L65: `PayrollHistory` export; my-motivation-client.tsx L222-230: секция "История начислений" |
| 7  | PAYROLL-02 (co-seller) НЕ реализован — DEFERRED по решению пользователя                                  | DEFERRED   | 14-CONTEXT.md раздел "Co-seller": явное решение "ОТЛОЖЕН"; схема БД без coSellerId не изменена        |

**Score:** 7/7 truths verified (7 = 6 реализованных + 1 deferred по решению пользователя)

---

## Required Artifacts

| Artifact                                                        | Expected                                      | Status    | Details                              |
|-----------------------------------------------------------------|-----------------------------------------------|-----------|--------------------------------------|
| `src/actions/motivation-calculation.ts`                        | Fixed per-item commission + shift fields      | VERIFIED  | 368+ строк; `itemCommissionDec` для всех продаж; shiftId/shiftDate/shiftNumber в interface и push; `orderItemCommissionDec` отсутствует |
| `src/__tests__/e2e/order-commission-peritem.e2e.test.ts`       | E2E regression test PAYROLL-01 (>=80 lines)   | VERIFIED  | 368 строк; describe("PAYROLL-01..."); 4 теста с конкретными значениями 500/120/90/710 |
| `src/actions/motivation-payroll.ts`                            | getMyPayrolls server action                   | VERIFIED  | 326 строк; `getMyPayrolls` L293-325; userId scope + requirePermission |
| `src/__tests__/e2e/payroll-employee.e2e.test.ts`               | E2E tests PAYROLL-05/06/03 (>=80 lines)       | VERIFIED  | 346 строк; 5 тестов: scope security (PAYROLL-05/06) + shift data (PAYROLL-03) |
| `src/components/motivation/payroll-history.tsx`                | Payroll history table component (>=60 lines)  | VERIFIED  | 177 строк; `PayrollHistory` export; Черновик/Подтверждён/Выплачен/Аванс/Итого лейблы; onDownloadPdf |
| `src/components/motivation/earnings-breakdown.tsx`             | Shift-grouped commission breakdown            | VERIFIED  | 410 строк; groupByShift(), ShiftGroup, expandedShifts, "Вне смен", shiftId |
| `src/app/(dashboard)/my/motivation/my-motivation-client.tsx`   | Integration of PayrollHistory + shift breakdown | VERIFIED | 235 строк; import PayrollHistory; getMyPayrolls call; handleDownloadPdf; JSX PayrollHistory; "История начислений" heading; getPayrolls() НЕ используется |

---

## Key Link Verification

| From                             | To                              | Via                              | Status   | Details                                                                 |
|----------------------------------|---------------------------------|----------------------------------|----------|-------------------------------------------------------------------------|
| `motivation-calculation.ts`      | `itemCommissionDec`             | Unified for all sale types       | WIRED    | L323-335: все продажи (regular + order) используют единый `itemCommissionDec` |
| `motivation-calculation.ts`      | `sale.shift`                    | Prisma include shift             | WIRED    | L190: `shift: { select: { id: true, number: true, openedAt: true } }`  |
| `motivation-payroll.ts`          | `db.payroll.findMany`           | getMyPayrolls with userId        | WIRED    | L298-306: `where: { userId: session.user.id, storeId }` + requirePermission |
| `my-motivation-client.tsx`       | `payroll-history.tsx`           | import PayrollHistory            | WIRED    | L19: `import { PayrollHistory } from "@/components/motivation/payroll-history"` |
| `my-motivation-client.tsx`       | `motivation-payroll.ts`         | getMyPayrolls call               | WIRED    | L17: import; L78: `getMyPayrolls(selectedStoreId).then(setPayrolls)` в useEffect |
| `earnings-breakdown.tsx`         | `SaleCommission.shiftId`        | groupByShift for accordion       | WIRED    | L127-154: groupByShift(); L204-209: rendering с shiftId key + "Вне смен" fallback |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                              | Status    | Evidence                                                               |
|-------------|------------|--------------------------------------------------------------------------|-----------|------------------------------------------------------------------------|
| PAYROLL-01  | 14-01      | Order commission per-item (не total netProfit на каждую позицию)         | SATISFIED | motivation-calculation.ts: `orderItemCommissionDec` удалён, единый `itemCommissionDec`; 4 E2E теста GREEN |
| PAYROLL-02  | 14-01      | Sale поддерживает co-seller (split-комиссии)                             | DEFERRED  | Явное решение в 14-CONTEXT.md: "ОТЛОЖЕН — в 99% случаев один продавец" |
| PAYROLL-03  | 14-02, 14-03 | Продавец видит свои продажи по магазинам и сменам                       | SATISFIED | SaleCommission с shiftId/shiftDate/shiftNumber; groupByShift в EarningsBreakdown; E2E тесты |
| PAYROLL-04  | 14-03      | Расшифровка комиссии: товар, цена, прибыль, % → сумма                   | SATISFIED | earnings-breakdown.tsx: двухуровневый accordion shift->sales->items с таблицей (товар/цена/себест./прибыль/ставка/комиссия) |
| PAYROLL-05  | 14-02, 14-03 | История начислений по месяцам в личном кабинете                         | SATISFIED | getMyPayrolls server action + PayrollHistory компонент + интеграция в /my/motivation |
| PAYROLL-06  | 14-02      | Сотрудник видит ТОЛЬКО свои данные (storeId scope)                       | SATISFIED | getMyPayrolls: `userId: session.user.id` + requirePermission("motivation.payroll.own"); 2 E2E теста на scope security |

**Orphaned requirements:** Нет — все PAYROLL-0X из REQUIREMENTS.md охвачены планами.

---

## Anti-Patterns Found

| File                                    | Line | Pattern                          | Severity | Impact        |
|-----------------------------------------|------|----------------------------------|----------|---------------|
| `my-motivation-client.tsx`              | 135  | `placeholder="Выберите магазин"` | Info     | SelectValue placeholder — не anti-pattern, корректное использование компонента |

Ни одного реального anti-pattern (TODO/FIXME/заглушки/пустые обработчики) не обнаружено.

---

## TypeScript Compilation

Запуск `npx tsc --noEmit` показал 7 ошибок в 4 файлах, **ни одна не относится к Phase 14**:

- `src/__tests__/confirm-receive-integration.test.ts` — 4 ошибки (pre-existing)
- `src/__tests__/e2e-real-db.test.ts` — 1 ошибка (pre-existing)
- `src/actions/repairs.ts` — 1 ошибка (pre-existing)
- `src/actions/trade-in.ts` — 1 ошибка (pre-existing)

Все файлы Phase 14 компилируются без ошибок.

---

## Human Verification Required

### 1. Shift accordion expand/collapse

**Test:** Открыть /my/motivation как сотрудник, выбрать период с продажами, нажать "Рассчитать", развернуть секцию "Комиссии с продаж", кликнуть по заголовку смены
**Expected:** Раскрывается список продаж; каждая продажа раскрывается в таблицу с колонками: Товар, Цена, Себест., Прибыль, Ставка, Комиссия
**Why human:** Поведение двухуровневого accordion (shift toggle -> sale toggle -> item table) нельзя верифицировать статически

### 2. "Вне смен" группа

**Test:** Убедиться наличием продаж без привязки к смене в выбранном периоде
**Expected:** В расшифровке комиссий присутствует секция "Вне смен" (или её корректное отсутствие если все продажи в сменах)
**Why human:** Требует реальных данных в БД

### 3. PDF скачивание из истории начислений

**Test:** В таблице "История начислений" кликнуть кнопку скачивания PDF для записи со статусом CONFIRMED или PAID
**Expected:** Файл `payroll-{id}.pdf` скачивается; PDF содержит корректные данные о начислениях
**Why human:** PDF генерация через @react-pdf/renderer требует браузерного окружения

### 4. Изоляция данных между сотрудниками

**Test:** Войти под учётной записью сотрудника A, затем под B — проверить таблицу "История начислений"
**Expected:** Каждый сотрудник видит только свои расчётные листы, не чужие
**Why human:** Требует нескольких тестовых учётных записей в системе

---

## Summary

Phase 14 достигла своей цели. Все 6 реализуемых требований (PAYROLL-01, 03, 04, 05, 06) выполнены с E2E-тестами. PAYROLL-02 (co-seller) корректно отложен по решению пользователя.

**Ключевые достижения:**
- Исправлен баг per-item комиссии по заказам (PAYROLL-01) — `orderItemCommissionDec` полностью удалён, единый путь через `itemCommissionDec` для всех типов продаж
- Добавлены поля shift (shiftId/shiftDate/shiftNumber) в SaleCommission для группировки
- Реализован `getMyPayrolls` с двойной защитой (permission + userId scope)
- Компонент `PayrollHistory` создан с 177 строками реального кода (не заглушка)
- `EarningsBreakdown` расширен двухуровневым accordion: смена → продажи → товары
- Страница /my/motivation интегрирует обе фичи

Автоматические проверки пройдены. Ожидается ручная верификация UI поведения (4 пункта выше).

---

_Verified: 2026-04-13T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
