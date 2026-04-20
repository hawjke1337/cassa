# Motivation Module — Design Specification

## Overview

Category-based commission system for employee compensation. Each employee is assigned a motivation scheme that defines their daily rate, per-item commission rules (by motivation group), cross-sell bonuses, and repair bonuses. The system calculates earnings in real-time and generates payroll records at mid-month (advance) and month-end (settlement).

**Key insight:** This is NOT a generic formula builder — it's a structured commission engine with well-defined rule types. The JSON config stores the scheme parameters; the calculation engine applies them against sales/repair data. This is a deliberate departure from the original design document's generic formula approach (`% of personal_sales`, `bonus if [metric] > [value]`), driven by the real-world commission table which is category-based with per-item rules.

## Dependencies

- **Shift Schedule module** (not yet built) — provides shift count for daily rate calculation. Until available, shift count is entered manually during advance calculation (typical range: 14–16 shifts/month).

## Data Models

### MotivationGroup

Separate grouping layer for commission rules. Decoupled from catalog categories because commission groupings follow different business logic (price thresholds, brand splits, model generations).

```prisma
model MotivationGroup {
  id          String   @id @default(cuid())
  code        String   @unique  // "ТехОсн", "IPhCтр", "МакСтр"
  name        String             // "Техника основная", "iPhone старые"
  description String?
  products    MotivationGroupProduct[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model MotivationGroupProduct {
  groupId   String
  group     MotivationGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  productId String
  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([groupId, productId])
  @@unique([productId])  // enforces one group per product at DB level
}
```

**Constraint:** One product belongs to at most one group, enforced at both database level (`@@unique([productId])`) and application level (user-friendly error message). Products without a group use the scheme's `defaultCommission`.

### MotivationScheme

```prisma
model MotivationScheme {
  id           String    @id @default(cuid())
  name         String    // "Продавец стандарт", "Директор Q1"
  description  String?
  formula      Json      // MotivationFormula (see below)
  storeId      String?   // null = global template, non-null = store-specific
  store        Store?    @relation(fields: [storeId], references: [id])
  createdById  String
  createdBy    User      @relation("SchemeCreator", fields: [createdById], references: [id])
  approvedById String?
  approvedBy   User?     @relation("SchemeApprover", fields: [approvedById], references: [id])
  approvedAt   DateTime?
  status       SchemeStatus @default(ACTIVE)
  assignments  MotivationAssignment[]
  payrolls     Payroll[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

enum SchemeStatus {
  ACTIVE
  PENDING_APPROVAL
  ARCHIVED
}
```

### MotivationFormula (JSON structure, TypeScript type)

```typescript
interface MotivationFormula {
  dailyRate: number                    // e.g. 1000 (rubles per shift)
  commissionRules: CommissionRule[]    // per motivation group
  defaultCommission: CommissionRule    // fallback for ungrouped products
  crossSellBonuses: CrossSellBonus[]  // escalating bonuses
  repairBonus: number                 // fixed amount per completed repair
}

interface CommissionRule {
  groupId?: string        // reference to MotivationGroup, absent for default
  rate: number            // e.g. 0.14 (14%)
  basis: "PROFIT" | "RETAIL_PRICE"
}

interface CrossSellBonus {
  minItems: number   // minimum items in sale (e.g. 2)
  bonus: number      // fixed bonus amount (e.g. 200)
}
```

### MotivationAssignment

```prisma
model MotivationAssignment {
  id        String    @id @default(cuid())
  schemeId  String
  scheme    MotivationScheme @relation(fields: [schemeId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id])
  startDate DateTime
  endDate   DateTime?  // null = indefinite

  @@unique([userId, storeId, startDate])
}
```

**Overlap validation:** When creating/updating an assignment, the application must check that no other assignment exists for the same `userId + storeId` with an overlapping date range. This prevents conflicting scheme assignments.

### Payroll

```prisma
model Payroll {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  storeId       String
  store         Store    @relation(fields: [storeId], references: [id])
  schemeId      String
  scheme        MotivationScheme @relation(fields: [schemeId], references: [id])
  periodStart   DateTime
  periodEnd     DateTime
  shiftsCount   Int                         // number of shifts worked
  dailyTotal    Decimal  @db.Decimal(12, 2) // dailyRate × shifts
  commissions   Decimal  @db.Decimal(12, 2) // sum of per-item commissions
  crossBonuses  Decimal  @db.Decimal(12, 2) // cross-sell bonuses
  repairBonuses Decimal  @db.Decimal(12, 2) // repair completion bonuses
  returns       Decimal  @db.Decimal(12, 2) // deductions for returns
  totalAmount   Decimal  @db.Decimal(12, 2) // final total
  isAdvance     Boolean  @default(false)
  status        PayrollStatus @default(DRAFT)
  breakdown     Json         // PayrollBreakdown (detailed line items)
  createdAt     DateTime @default(now())
}

enum PayrollStatus {
  DRAFT      // calculated but not confirmed
  CONFIRMED  // confirmed, ready for payment
  PAID       // paid out
}
```

### PayrollBreakdown (JSON structure)

```typescript
interface PayrollBreakdown {
  daily: {
    shiftsCount: number
    ratePerShift: number
    total: number
  }
  commissions: {
    saleId: string
    saleNumber: string
    date: string
    items: {
      productName: string
      groupCode: string | null
      sellPrice: number
      costPrice: number
      rate: number
      basis: "PROFIT" | "RETAIL_PRICE"
      commission: number
    }[]
  }[]
  crossSellBonuses: {
    saleId: string
    saleNumber: string
    itemCount: number
    bonus: number
  }[]
  repairBonuses: {
    repairId: string
    repairNumber: string
    date: string
    bonus: number
  }[]
  returnDeductions: {
    returnId: string
    saleNumber: string
    productName: string
    commission: number  // negative
  }[]
  advance: number  // previously paid advance (subtracted at month-end)
}
```

## Calculation Engine

### Real-time Dashboard Calculation

No stored state — computed on the fly when the employee opens their dashboard:

1. **Get active assignment** for user + store for current date
2. **Fetch all sales** by this seller in period (with items, products, returns)
3. **For each SaleItem:**
   - Look up product's MotivationGroup
   - Find matching `commissionRule` in scheme, or use `defaultCommission`
   - `PROFIT` basis: `(sellPrice - costPrice) × rate`
   - `RETAIL_PRICE` basis: `sellPrice × rate`
4. **For each Sale with 2+ distinct line items (SaleItem rows):**
   - Count = number of SaleItem rows in the sale (NOT sum of quantities — buying 2 of the same item is 1 line item, not 2)
   - Find highest matching `crossSellBonus` threshold (e.g., 3 line items matches `minItems: 3` → bonus 400)
5. **Completed repairs** (status DELIVERED, deliveredAt in period) where the employee is the `master` (technician who performed the repair) → count × `repairBonus`
6. **Returns in period:**
   - Remove commission for returned items
   - Recalculate cross-sell bonus for affected sales (if a 3-item sale becomes 2-item after return, bonus drops from 400 to 200)
7. **Shifts** — from shift schedule module (manual input until module exists)
8. **Total** = (shifts × dailyRate) + commissions + crossBonuses + repairBonuses − returnDeductions

### Advance Calculation (mid-month)

- Triggered manually by owner/director
- Advance = dailyRate × shifts worked in 1st–15th
- Saved as `Payroll` record with `isAdvance: true`, status `DRAFT`
- Owner/director reviews → marks as `CONFIRMED` → then `PAID` after actual payment

### Month-end Settlement

- Triggered manually by owner/director
- Full calculation for entire month (steps 1–8 above)
- Subtracts already-paid advance
- Saved as `Payroll` record with `isAdvance: false`, status `DRAFT`
- `breakdown` JSON contains complete line-by-line detail
- `DRAFT` payrolls can be recalculated (deleted and recreated). `CONFIRMED`/`PAID` cannot.

### Return Handling

- Returns cancel the commission for the returned item
- If return is in a different month than the sale, deduction applies to the current period
- Cross-sell bonus is recalculated based on remaining items in the original sale

## UI Pages

### Settings → Motivation Groups (`/settings/motivation-groups`)

- Table: code, name, product count
- Create/edit group: name, code, description
- Product assignment: search catalog, checkboxes
- Warning if product already in another group (offer to move)
- Access: owner + director (own store)

### Settings → Motivation Schemes (`/settings/motivation-schemes`)

- Table: name, status (badge), assigned employee count
- Scheme editor page (`/settings/motivation-schemes/[id]`):
  - **Daily rate** — number input
  - **Commission rules** — table: group (dropdown) → rate (%) → basis (Profit/Retail)
  - **Default commission** — rate + basis for ungrouped products
  - **Cross-sell bonuses** — editable list: min items → bonus amount
  - **Repair bonus** — number input
  - **Assignments tab** — employee list, "Assign" button, store + start date selection
- Director creates/edits → status `PENDING_APPROVAL`

### Motivation Dashboard (`/motivation`)

For owner/director:
- Store selector, period selector
- Table of all employees: name, shifts, commissions, bonuses, total
- Click employee → detailed breakdown
- "Calculate advance" / "Calculate settlement" buttons

### Employee Dashboard (`/my/motivation`)

Real-time personal dashboard:
- **Header cards:** earned this period, shifts worked, sales count
- **Breakdown sections:**
  - Daily rate: N shifts × X₽ = total
  - Commissions: each sale → items → commission per item
  - Cross-sell bonuses: which sales qualified, bonus amount
  - Repairs: completed repairs × fixed amount
  - Returns: what was returned, how much deducted
  - **Total earned**

## Permissions

| Code | Description |
|------|-------------|
| `motivation.groups.manage` | Manage motivation groups (CRUD) |
| `motivation.schemes.manage` | Create/edit motivation schemes |
| `motivation.schemes.assign` | Assign schemes to employees |
| `motivation.schemes.approve` | Approve scheme changes (owner only) |
| `motivation.payroll.view` | View payroll for all employees |
| `motivation.payroll.own` | View own motivation dashboard |

### Role Matrix

| Role | groups.manage | schemes.manage | schemes.assign | schemes.approve | payroll.view | payroll.own |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Владелец | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Директор | ✓ (own store) | ✓ (own store) | ✓ (own store) | ✗ | ✓ (own store) | ✓ |
| Продавец | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Остальные | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

### Approval Flow

**Creating a new scheme (by director):**
1. Director creates scheme → status `PENDING_APPROVAL` (scheme is not used in calculations until approved)
2. Owner sees notification badge in sidebar on "Мотивация" section
3. Owner opens → sees the new scheme → "Подтвердить" or "Отклонить"
4. Approved → status `ACTIVE`, scheme can be assigned to employees
5. Rejected → status `ARCHIVED`, director notified

**Editing an existing active scheme (by director):**
1. Director edits an ACTIVE scheme → system creates a **new scheme** as a copy with the changes, status `PENDING_APPROVAL`. Original scheme remains ACTIVE and in use.
2. Owner reviews the new version → "Подтвердить" or "Отклонить"
3. Approved → new scheme becomes `ACTIVE`, original scheme becomes `ARCHIVED`, all assignments are migrated to the new scheme
4. Rejected → new scheme is `ARCHIVED`, original remains `ACTIVE`, nothing changes

**Owner edits:** Direct modification, no approval needed, status stays `ACTIVE`.

## Sidebar Navigation

- New section: **"Мотивация"** (icon: `Award`)
  - Owner/Director → `/motivation` (management view)
  - Seller/Others → `/my/motivation` (personal dashboard)
- Settings: **"Мотивационные группы"** under existing settings items

## Out of Scope (Deferred)

- **Special sales channels** (Avito, online store, private channel, Trade-in) — deferred until channels exist in the sales system
- **Shift Schedule module** — separate design & implementation; until available, shift count is entered manually (typical: 14–16 shifts/month)
- **PDF payroll slips** — can be added later via document template constructor
- **Audit log** — change history for schemes
- **Penalties/fines** — not needed; returns simply reverse the commission
