# Motivation Module Extensions — Design Spec

## Overview

Three independent extensions to the existing motivation module:
1. **Approval Flow UI** — scheme approval with diff & simulation
2. **Payroll Page** — dedicated payroll management with details
3. **PDF Export** — downloadable payroll breakdown

All three build on existing backend (server actions, Prisma models, calculation engine). The primary work is UI + one new server action for simulation + minor schema extension.

---

## 1. Approval Flow

### Context

Backend already supports scheme versioning:
- Director creates/edits scheme → status `PENDING_APPROVAL`, linked via `parentSchemeId`
- Owner approves → old becomes `ARCHIVED`, assignments migrate
- Owner rejects → new scheme archived
- `getPendingSchemeCount()` returns count for badge
- `approveMotivationScheme(id)` and `rejectMotivationScheme(id)` exist

### What's New

#### 1.1 Badge in Sidebar

- Show pending count badge next to "Мотивация" item in `app-sidebar.tsx`
- Only visible to users with `motivation.schemes.approve` permission
- Fetch `getPendingSchemeCount()` in the dashboard layout server component and pass as prop to `AppSidebar`. No polling — count refreshes on navigation via Next.js server component re-rendering
- Badge style: small red circle with number (consistent with other badges in sidebar)

#### 1.2 Approvals List Page (`/motivation/approvals`)

- Route: `src/app/(dashboard)/motivation/approvals/page.tsx`
- Permission: `motivation.schemes.approve`
- Content: list of all `PENDING_APPROVAL` schemes
- Each card shows: scheme name, creator name, creation date, store (or "Общая"), link to detail page
- Empty state: "Нет схем, ожидающих подтверждения"

#### 1.3 Approval Detail Page (`/motivation/approvals/[id]`)

- Route: `src/app/(dashboard)/motivation/approvals/[id]/page.tsx`
- Permission: `motivation.schemes.approve`
- Three sections:

**Formula Diff (side-by-side):**
- Left: parent scheme formula (current active). Right: proposed formula
- Highlight changed values (different background color)
- Fields: dailyRate, commissionRules (table), defaultCommission, crossSellBonuses (table), repairBonus
- If no parent (new scheme, not edit) — show only proposed formula without diff

**Simulation Table:**
- Period selector: "Текущий месяц" / "Прошлый месяц" toggle (default: current)
- Table columns: Сотрудник, Смены, По старой схеме, По новой схеме, Разница, Разница %
- Row per affected employee (those assigned to the parent scheme)
- For store-specific schemes: employees from that store. For general schemes: groups by store using each employee's `MotivationAssignment.storeId`
- Summary row at bottom: totals
- Data source: new `simulateSchemeComparison()` server action
- **New schemes (no parent):** simulation table is hidden — no employees to compare against. Only the formula view is shown

**Actions:**
- "Подтвердить" button → calls `approveMotivationScheme(id)`, redirects to `/motivation/approvals`
- "Отклонить" button → opens dialog with optional textarea for reason → calls `rejectMotivationScheme(id, reason?)`, redirects

#### 1.4 Schema Change

```prisma
model MotivationScheme {
  // existing fields...
  rejectionReason  String?   // NEW: optional reason when rejected
}
```

#### 1.5 New Server Action: `simulateSchemeComparison`

```typescript
simulateSchemeComparison(schemeId: string, periodStart: string, periodEnd: string)
```

- Permission: `motivation.schemes.approve`
- Converts string dates to Date objects internally before passing to `calculateEarningsWithFormula`
- Finds the pending scheme and its parent
- Finds all employees assigned to the parent scheme (via `MotivationAssignment` where `schemeId === parentSchemeId`). Uses each assignment's `storeId` for store-specific calculation
- For each employee: calls `calculateEarningsWithFormula` twice (with old formula, with new formula)
- Gets `shiftsCount` from existing Payroll record for the period (same as current `getMyEarnings` logic), defaults to 0
- Returns array of `{ userId, userName, storeId, storeName, shiftsCount, oldTotal, newTotal, diff, diffPercent }`
- **Edge case:** if parent scheme has no assignments, returns empty array

**Implementation note:** `calculateEarnings` currently fetches the assignment internally. For simulation, we need a variant `calculateEarningsWithFormula(userId, storeId, periodStart, periodEnd, shiftsCount, formula)` that accepts the formula directly instead of looking it up from DB. Extract the core logic into this function, and have the original `calculateEarnings` call it after fetching the assignment.

#### 1.6 Backend Update: `rejectMotivationScheme`

Update signature: `rejectMotivationScheme(id: string, reason?: string)`
- Saves `rejectionReason` to the scheme record when provided

---

## 2. Payroll Page

### Context

Backend fully supports payroll CRUD: `getPayrolls`, `generatePayroll`, `confirmPayroll`, `markPayrollPaid`, `deletePayroll`. Currently payroll table lives inside `motivation-dashboard-client.tsx`.

### What's New

#### 2.1 Dedicated Page (`/motivation/payrolls`)

- Route: `src/app/(dashboard)/motivation/payrolls/page.tsx`
- Permission: `motivation.payroll.view`
- Filters row: store selector, period (date range), status dropdown (Все/Черновик/Подтверждён/Выплачен)
- Employee filtering: client-side on already loaded data (dataset is small — max ~35 employees across 5 stores)

**Table columns:**
- Сотрудник (name)
- Период (formatted date range)
- Тип (Аванс / Расчёт)
- Смены
- Итого (formatted money)
- Статус (badge: DRAFT=yellow, CONFIRMED=blue, PAID=green)
- Действия (contextual buttons)

**Expandable row detail:**
- Click row → expands to show full `EarningsBreakdown` component
- Data source: `breakdown` JSON field from Payroll record (already stored by `generatePayroll`)

**Actions per row:**
- DRAFT: "Подтвердить" + "Удалить"
- CONFIRMED: "Выплатить"
- PAID: no actions (read-only)

**Calculate button:**
- Same dialog as current dashboard (advance/settlement, employee list with shifts input)
- Available at top of page

#### 2.2 Dashboard Simplification

- Remove payroll table from `motivation-dashboard-client.tsx`
- Add link card: "Расчётные листы →" pointing to `/motivation/payrolls`
- Keep: employee earnings table + calculate button on dashboard

---

## 3. PDF Export

### Context

`@react-pdf/renderer` is in the project (used for price labels and document templates). Payroll breakdown data is stored as JSON in `Payroll.breakdown` field.

### What's New

#### 3.1 PDF Document Component

- File: `src/components/motivation/payroll-pdf-document.tsx`
- Uses `@react-pdf/renderer` (Document, Page, View, Text, StyleSheet)
- Russian text support: register font (same approach as existing PDF components in the project)

**Layout (A4 portrait):**

```
┌─────────────────────────────────────┐
│  a:store — Расчётный лист           │
│  Магазин: [store name]              │
│  Период: [date range]              │
│  Сотрудник: [full name]            │
│  Тип: Аванс / Расчёт              │
├─────────────────────────────────────┤
│  СТАВКА                            │
│  N смен × X ₽ = Y ₽               │
├─────────────────────────────────────┤
│  КОМИССИИ С ПРОДАЖ                 │
│  Продажа №001 — дата               │
│    Товар 1  | группа | 10% | 500₽  │
│    Товар 2  | группа | фикс | 300₽ │
│  Итого комиссии: Z ₽              │
├─────────────────────────────────────┤
│  КРОСС-ПРОДАЖИ                     │
│  Продажа №001 — 3 позиции — 200₽   │
├─────────────────────────────────────┤
│  РЕМОНТЫ                           │
│  Ремонт №R001 — дата — 500₽        │
├─────────────────────────────────────┤
│  ВОЗВРАТЫ (УДЕРЖАНИЯ)              │
│  Товар — по чеку №001 — -300₽      │
├─────────────────────────────────────┤
│  ИТОГО К НАЧИСЛЕНИЮ: XXXX ₽        │
│  Аванс выплачен: YYYY ₽  (if any)  │
│  К выплате: ZZZZ ₽       (if any)  │
└─────────────────────────────────────┘
```

#### 3.2 Server Action: `getPayrollPdfData`

```typescript
getPayrollPdfData(payrollId: string)
```

- Permission: dual check — if user has `motivation.payroll.view`, allow access to any payroll. Otherwise, check `motivation.payroll.own` and verify `payroll.userId === session.user.id`. Throw if neither condition is met
- Returns: `{ userName, storeName, periodStart, periodEnd, isAdvance, breakdown, advanceAmount? }`
- Fetches Payroll with related User and Store
- If settlement (`isAdvance === false`): finds CONFIRMED/PAID advance in same period to populate `advanceAmount`. If no advance exists, `advanceAmount` is omitted
- PDF shows "Аванс выплачен" and "К выплате" lines only when `isAdvance === false` and `advanceAmount` is present

#### 3.3 Download Button Placement

- Payroll page (`/motivation/payrolls`): "PDF" icon button per row
- My motivation page (`/my/motivation`): "Скачать расчётный лист" button (if payroll exists for selected period)
- Both use client-side PDF generation: `pdf(<PayrollPdfDocument />).toBlob()` → download

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `src/app/(dashboard)/motivation/approvals/page.tsx` | Approvals list (server component) |
| `src/app/(dashboard)/motivation/approvals/approvals-client.tsx` | Approvals list UI |
| `src/app/(dashboard)/motivation/approvals/[id]/page.tsx` | Approval detail (server component) |
| `src/app/(dashboard)/motivation/approvals/[id]/approval-detail-client.tsx` | Detail UI with diff + simulation |
| `src/components/motivation/formula-diff.tsx` | Side-by-side formula comparison |
| `src/components/motivation/simulation-table.tsx` | Earnings simulation comparison table |
| `src/app/(dashboard)/motivation/payrolls/page.tsx` | Payrolls list (server component) |
| `src/app/(dashboard)/motivation/payrolls/payrolls-client.tsx` | Payrolls list UI |
| `src/components/motivation/payroll-pdf-document.tsx` | @react-pdf PDF template |
| `src/actions/motivation-simulation.ts` | simulateSchemeComparison action |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `rejectionReason` to MotivationScheme |
| `src/actions/motivation-calculation.ts` | Extract `calculateEarningsWithFormula`, refactor `calculateEarnings` to use it |
| `src/actions/motivation-schemes.ts` | Update `rejectMotivationScheme` to accept optional reason |
| `src/actions/motivation-payroll.ts` | Add `getPayrollPdfData` action |
| `src/components/layout/app-sidebar.tsx` | Add pending count badge to "Мотивация" |
| `src/app/(dashboard)/motivation/motivation-dashboard-client.tsx` | Remove payroll table, add link to payrolls page |
| `src/app/(dashboard)/my/motivation/my-motivation-client.tsx` | Add "Скачать расчётный лист" PDF button |

### Unchanged (reused as-is)
| File | Used by |
|------|---------|
| `src/components/motivation/earnings-breakdown.tsx` | Payroll detail expansion |
| `src/actions/motivation-payroll.ts` (existing actions) | Payroll page actions |
| `src/actions/motivation-schemes.ts` (approve/reject) | Approval actions |

---

## Permissions

No new permissions needed. Existing ones cover all cases:
- `motivation.schemes.approve` — approval flow (badge, list, detail, approve/reject)
- `motivation.payroll.view` — payroll page, PDF download for any employee
- `motivation.payroll.own` — PDF download for own payroll

---

## Dependencies

The three features are independent and can be built in any order. Recommended order:
1. **Approval Flow** — most complex, highest business value
2. **Payroll Page** — straightforward, moves UI to dedicated page
3. **PDF Export** — builds on payroll page, needs font setup

No new npm packages needed. `@react-pdf/renderer` already installed.
