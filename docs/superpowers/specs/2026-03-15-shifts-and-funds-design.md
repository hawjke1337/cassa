# Shifts & Funds — Design Specification

> **Module:** Shift management, cash operations, and fund tracking
> **Status:** Approved design
> **Date:** 2026-03-15
> **Approach:** Shift as wrapper over sales (Approach A)

---

## 1. Overview

### Problem
Sellers currently track shifts informally — counting cash by hand, printing receipts onto A4 sheets, no digital record. There's no way to track where cash goes after collection (rent, purchasing, taxes, payroll). Discrepancies are discovered late.

### Solution
A shift management system where:
- Every shift is a digital record with opening/closing cash counts
- Sales and payments are automatically linked to the active shift
- Cash operations (withdrawals/deposits) have mandatory reasons and fund assignments
- Funds are fully customizable per store or global
- Shift counts feed into payroll automatically
- Fund reports show where money goes

---

## 2. Data Model

### 2.1 New Models

#### ShiftStatus enum
```
OPEN        — active shift
CLOSED      — manually closed
AUTO_CLOSED — auto-closed when new shift opens (warning state)
```

#### CashOpType enum
```
WITHDRAW — cash out (выемка)
DEPOSIT  — cash in (внесение)
```

#### Shift
| Field | Type | Description |
|-------|------|-------------|
| id | String @id @default(cuid()) | PK |
| number | String @unique | "SH-2026-000001" via getNextNumber("SH") |
| storeId | String → Store | Store |
| openedById | String → User | Who opened |
| closedById | String? → User | Who closed (can be different person) |
| status | ShiftStatus @default(OPEN) | Current status |
| openedAt | DateTime @default(now()) | Opening time |
| closedAt | DateTime? | Closing time |
| openingCash | Decimal(12,2) | Cash counted at opening |
| closingCash | Decimal(12,2)? | Actual cash at closing |
| expectedCash | Decimal(12,2)? | System-calculated expected cash |
| discrepancy | Decimal(12,2)? | closingCash - expectedCash |
| note | String? | Comment (e.g. discrepancy explanation) |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

Relations: `sales Sale[]`, `payments Payment[]`, `returns Return[]`, `cashOperations CashOperation[]`, `store Store`, `openedBy User`, `closedBy User?`

Indexes:
- `@@index([storeId, status])` — quick lookup of open shift per store

#### Fund
| Field | Type | Description |
|-------|------|-------------|
| id | String @id @default(cuid()) | PK |
| name | String | "Аренда", "Закуп техники", "ЗП", etc. |
| storeId | String? → Store | null = global fund, otherwise store-specific |
| isActive | Boolean @default(true) | Can be deactivated |
| createdAt | DateTime @default(now()) | |

#### CashOperation
| Field | Type | Description |
|-------|------|-------------|
| id | String @id @default(cuid()) | PK |
| shiftId | String → Shift | Linked to shift |
| type | CashOpType | WITHDRAW or DEPOSIT |
| amount | Decimal(12,2) | Amount (always positive) |
| fundId | String? → Fund | Target fund (required for WITHDRAW) |
| supplierId | String? → Supplier | If linked to a specific supplier |
| reason | String | Mandatory reason text |
| performedById | String → User | Who performed |
| createdAt | DateTime @default(now()) | |

Indexes:
- `@@index([shiftId])` — aggregation queries on shift close

### 2.2 Modified Models

#### Sale
Add: `shiftId String?` → Shift (nullable for historical sales without shifts)

Reverse relation on Shift: `sales Sale[]`

Index: `@@index` on `shiftId` (for shift summary queries)

#### Payment
Add: `shiftId String?` → Shift (nullable for historical payments)

Index: `@@index` on `shiftId` (for shift cash calculation)

#### Return
Add: `refundMethod PaymentMethod?` — how the refund was paid out (CASH, CARD, etc.). Required for new returns, null for historical.
Add: `shiftId String?` → Shift — links return to the shift it happened in.

Index: `@@index` on `shiftId`

> **Why:** The existing Return model has no record of payment method used for refund. Without this, the expectedCash formula cannot calculate cash refunds during a shift. Adding `refundMethod` and `shiftId` to Return is the cleanest solution — it mirrors how Sale tracks payment method via Payment, but returns are simpler (single refund method per return).

#### Store
Add reverse relations: `shifts Shift[]`, `funds Fund[]`

#### Supplier
Add reverse relation: `cashOperations CashOperation[]`

#### User
Add reverse relations: `shiftsOpened Shift[] @relation("ShiftOpenedBy")`, `shiftsClosed Shift[] @relation("ShiftClosedBy")`, `cashOperations CashOperation[]`

---

## 3. Permissions

| Code | Module | Name | Default roles |
|------|--------|------|---------------|
| shifts.open | shifts | Открытие смены | seller, director, owner |
| shifts.close | shifts | Закрытие смены | seller, director, owner |
| shifts.view | shifts | Просмотр своих смен | seller, director, owner |
| shifts.view_all | shifts | Просмотр всех смен магазина | director, owner |
| shifts.cash_ops | shifts | Операции с наличными | seller, director, owner |
| funds.manage | funds | Управление фондами | director, owner |

---

## 4. Business Logic

### 4.1 Opening a Shift

1. Check permission `shifts.open` for the store
2. All operations inside a single `db.$transaction`:
   a. Check if there's an open shift for this store (`WHERE storeId AND status = OPEN`)
   b. If yes → auto-close it: status=AUTO_CLOSED, closedAt=now(), closedById=current user
   c. Create new Shift: number via `getNextNumber("SH")`, status=OPEN, openingCash from user input
3. UI flow: if unclosed shift detected, show alert first, then proceed on confirm

### 4.2 During a Shift

- **Sales:** POS creates Sale with `shiftId` = current open shift for the store. If no open shift → `shiftId = null` (POS still works, just warns).
- **Returns:** `createReturn` action sets `refundMethod` (required) and `shiftId` from current open shift. Cash refunds (refundMethod=CASH) count toward expectedCash calculation.
- **Trade-in buyback:** Payment with `isExpense=true, method=CASH` gets `shiftId` — counts as cash outflow.
- **Custom order payments:** When a Payment is created for a CustomOrder (e.g. pickup payment), query open shift → set `shiftId`. Cash payments count toward expectedCash.
- **Repair payments:** When a Payment is created for a Repair (e.g. repair completed, customer pays), query open shift → set `shiftId`. Cash payments count toward expectedCash.
- **Cash operations:** User can create WITHDRAW or DEPOSIT via dialog.

> **Key principle:** Every Payment created during a shift gets `shiftId` set, regardless of whether it's for a Sale, CustomOrder, Repair, or Trade-in. The expectedCash formula works on Payments by `shiftId + method`, so it automatically covers all payment sources.

### 4.3 Closing a Shift

1. Check permission `shifts.close`
2. Calculate `expectedCash` (all queries within `db.$transaction`):
   ```
   openingCash
   + SUM(Payment.amount WHERE shiftId=this AND method=CASH AND isExpense=false)   — cash sales
   + SUM(CashOperation.amount WHERE shiftId=this AND type=DEPOSIT)                — deposits
   - SUM(Payment.amount WHERE shiftId=this AND method=CASH AND isExpense=true)    — cash expenses (trade-in buybacks)
   - SUM(CashOperation.amount WHERE shiftId=this AND type=WITHDRAW)               — withdrawals
   - SUM(Return.amount WHERE shiftId=this AND refundMethod=CASH)                  — cash refunds
   = expectedCash
   ```
3. User inputs `closingCash` (actual cash counted)
4. Calculate `discrepancy` = closingCash - expectedCash
5. If discrepancy ≠ 0 → require note
6. Update Shift: status=CLOSED, closedAt=now(), closedById, closingCash, expectedCash, discrepancy, note

### 4.4 Auto-Close

When a new shift is opened while previous is still OPEN:
- Previous shift: status=AUTO_CLOSED, closedAt=now(), closedById=person opening new shift
- closingCash, expectedCash, discrepancy remain **null** (no data — nobody counted cash)
- Highlighted as warning in shift list and detail page

### 4.5 Cash Operation Rules

- WITHDRAW: amount > 0, reason required, fundId required
- DEPOSIT: amount > 0, reason required, fundId optional
- supplierId always optional
- Only possible during an open shift

### 4.6 Shift Lookup in POS (race condition prevention)

When `createSale` is called:
1. Inside the existing `db.$transaction`, query: `db.shift.findFirst({ where: { storeId, status: "OPEN" } })`
2. Set `shiftId` on the created Sale and all its Payments
3. If no open shift found → `shiftId = null` on both Sale and Payments

Same pattern for `createReturn`: lookup open shift inside the transaction, set `shiftId` and `refundMethod`.

This ensures consistency — the shift lookup and the sale/return creation are atomic.

---

## 5. Pages & UI

### 5.1 POS Banner (modify existing POS page)

Top of POS interface:
- **No shift:** Yellow banner "Смена не открыта" + "Открыть смену" button
- **Shift open:** Green strip: "Смена №SH-2026-000042 | Иванова М. | с 09:15" + "Инкассация" + "Закрыть смену" buttons

POS works without an open shift (shiftId=null) — banner is a warning, not a blocker.

### 5.2 Open Shift Dialog

- Modal triggered from POS banner
- Field: "Сумма наличных в кассе" (number input, required, ≥ 0)
- If unclosed shift exists: alert at top with shift number and date
- Button: "Открыть смену"
- On success: toast, POS banner updates

### 5.3 Close Shift Dialog

- Modal with shift summary:
  - Продажи за смену: total (нал: X ₽, карта: X ₽, СБП: X ₽, перевод: X ₽, рассрочка: X ₽)
  - Возвраты: total (нал: X ₽, безнал: X ₽)
  - Выемки: total / Внесения: total
  - **Ожидаемая сумма наличных: X ₽** (bold, highlighted)
- Field: "Фактическая сумма наличных" (number input)
- Auto-calculated discrepancy display (green if 0, red if ≠ 0)
- If discrepancy ≠ 0: textarea "Комментарий к расхождению" (required)
- Button: "Закрыть смену"

### 5.4 Cash Operation Dialog

- Toggle: Выемка / Внесение
- Amount (number input, required)
- Fund (Select from store funds + global funds — required for WITHDRAW, optional for DEPOSIT)
  - Query: `WHERE (storeId = currentStoreId OR storeId IS NULL) AND isActive = true`
- Supplier (optional Select — for linking to specific supplier)
- Reason (text input, required)
- Button: "Провести"

### 5.5 /shifts — Shift List Page

- Server component with permission gate (`shifts.view` or `shifts.view_all`)
- **Query scoping:**
  - `shifts.view_all` → all shifts for the store
  - `shifts.view` only → `WHERE openedById = currentUser.id`
- Filters: store (from useCurrentStore), date range, status, employee
- Table columns: Номер, Дата, Продавец, Время (открытие→закрытие), Наличные (открытие→закрытие), Расхождение, Статус
- Status badges:
  - OPEN: green "Открыта"
  - CLOSED: gray "Закрыта"
  - AUTO_CLOSED: red "Не закрыта" with warning icon
- Row click → `/shifts/[id]`

### 5.6 /shifts/[id] — Shift Detail Page

- Back button "← Назад к списку"
- Header: shift number + status badge
- **Info cards:**
  - Магазин, кто открыл, кто закрыл, время работы
  - Cash summary card:
    - For CLOSED shifts: открытие → ожидаемые → факт → расхождение (with color)
    - For AUTO_CLOSED shifts: открытие only, rest shows "—" with warning: "Смена не была закрыта вручную. Данные по наличным отсутствуют."
    - For OPEN shifts: открытие + текущий расчёт ожидаемых (live)
- **Payment method breakdown card:**
  - Наличные, Карта, СБП, Перевод, Рассрочка — суммы за смену
- **Sales table:** all sales linked to this shift (number, time, amount, method)
- **Returns table:** returns during this shift (number, time, amount, refund method)
- **Cash operations table:** all withdrawals/deposits (time, type, amount, fund, reason, who)
- **Print button:** opens `/print/shift/[id]` — the A4 sheet

### 5.7 /settings/funds — Fund Management Page

- Server component with `funds.manage` permission gate
- Table: name, store (or "Глобальный"), status (active/inactive)
- Create dialog: name, store (select or "Глобальный"), create button
- Edit: inline or dialog — name, store, active toggle
- No delete — only deactivate (funds may be referenced by cash operations)

### 5.8 /reports/funds — Fund Report Page

- Permission: `shifts.view_all` (directors+)
- Period selector (month/custom range)
- Store filter (or all stores)
- Table: Fund name, Store, Total inflow (deposits), Total outflow (withdrawals), Operation count
- Totals row
- Expandable rows → individual operations

### 5.9 Print: /print/shift/[id] — Shift A4 Sheet

Simple fixed layout (not via document constructor). Contains:
- Header: store name, shift number, date, employee name
- Two receipt stub areas side by side (for physically attaching opening/closing receipts)

```
{storeName}                    Смена №{number}
Дата: {date}                   Продавец: {employeeName}

┌────────────────────┐    ┌────────────────────┐
│   ОТКРЫТИЕ СМЕНЫ   │    │   ЗАКРЫТИЕ СМЕНЫ   │
│                    │    │                    │
│   Наличные: {amt}  │    │   Наличные: {amt}  │
│                    │    │   Ожидалось: {exp}  │
│   (место для       │    │   Расхождение: {d}  │
│    чека)           │    │                    │
│                    │    │   (место для       │
│                    │    │    чека)           │
└────────────────────┘    └────────────────────┘
```

No detailed sales list on print — all analytics are in the system.

---

## 6. Integrations

### 6.1 POS Integration

- Modify `createSale` in `actions/sales.ts`: inside the existing `db.$transaction`, query open shift for the store → set `shiftId` on Sale and all its Payments. If no open shift → `shiftId = null`.
- Modify `createReturn` in `actions/sales.ts`: add `refundMethod` parameter (required), inside transaction query open shift → set `shiftId` and `refundMethod` on Return.

### 6.2 Trade-in Integration

- Modify `createTradeIn` in `actions/trade-in.ts`: when creating buyback Payment, query open shift inside the transaction → set `shiftId`.
- This counts as cash outflow in expectedCash calculation.

### 6.3 Custom Order Integration

- Modify payment creation in `actions/custom-orders.ts`: when creating a Payment for a custom order, query open shift inside the transaction → set `shiftId`.
- Cash payments for custom orders count toward expectedCash (as cash income).

### 6.4 Repair Integration

- Modify payment creation in `actions/repairs.ts`: when creating a Payment for a repair, query open shift inside the transaction → set `shiftId`.
- Cash payments for repairs count toward expectedCash (as cash income).

### 6.5 Payroll Integration

- Auto-calculate `shiftsCount` in payroll:
  ```
  db.shift.count({
    where: {
      openedById: userId,
      status: { in: ["CLOSED", "AUTO_CLOSED"] },
      storeId,
      openedAt: { gte: periodStart, lte: periodEnd }
    }
  })
  ```
- Modify payroll creation flow to auto-fill `shiftsCount` from this query.
- **Simulation path:** `calculateEarningsWithFormula` keeps `shiftsCount` as an explicit parameter (for what-if scenarios). Only the payroll creation path auto-calculates.
- **Historical data:** If `db.shift.count()` returns 0 for a period (no shifts existed yet), the payroll form pre-fills 0 but allows manual override. This way existing payrolls with manually-entered counts are not affected.

### 6.6 Sidebar Navigation

- Add "Смены" to sidebar: `/shifts`, icon: Clock, permission: `shifts.view`
- Add "Фонды" under Settings: `/settings/funds`, permission: `funds.manage`

### 6.7 Reports

- New fund report page at `/reports/funds`
- Existing sales reports are not modified

---

## 7. NOT in Scope

- Tying funds to a monthly budget/target (future: expense module)
- Recurring expenses (rent auto-deduction) — future expense module
- Multi-currency support
- Cash register hardware integration
- Fiscal receipt printing (Wave 3)
- Wholesale-related changes
