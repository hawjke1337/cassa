# Shifts & Funds Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shift management, cash operations, and fund tracking to the ERP — every shift is a digital record with opening/closing cash counts, cash operations have mandatory reasons and fund assignments, and shift counts feed into payroll automatically.

**Architecture:** Shift model wraps sales — every Payment gets `shiftId` during open shifts regardless of source (Sale, CustomOrder, Repair, Trade-in). ExpectedCash is calculated from `openingCash + cash_income - cash_outflows - withdrawals - refunds`. Funds are customizable per store or global, linked to cash operations.

**Tech Stack:** Next.js 14+ App Router, Prisma/PostgreSQL, @base-ui/react (NOT Radix — uses `render` prop, not `asChild`; Select `onValueChange` is `(value: string | null, eventDetails) => void`), TailwindCSS, Zod, Zustand, sonner, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-15-shifts-and-funds-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` (modify) | Add ShiftStatus, CashOpType enums + Shift, Fund, CashOperation models + modify Sale, Payment, Return, Store, User, Supplier |
| `src/lib/permissions-list.ts` (modify) | Add 6 shift/fund permission codes + update role presets |
| `src/lib/validations/shifts.ts` (create) | Zod schemas for shift and cash operation inputs |
| `src/actions/shifts.ts` (create) | Server actions: openShift, closeShift, getShifts, getShift, getShiftSummary, getCurrentShift |
| `src/actions/funds.ts` (create) | Server actions: getFunds, createFund, updateFund, toggleFundActive |
| `src/actions/cash-operations.ts` (create) | Server actions: createCashOperation, getCashOperations |
| `src/actions/sales.ts` (modify) | Add shiftId to createSale and createReturn |
| `src/actions/trade-in.ts` (modify) | Add shiftId to createTradeIn payment |
| `src/actions/orders.ts` (modify) | Add shiftId to custom order payments |
| `src/actions/repairs.ts` (modify) | Add shiftId to repair payments |
| `src/actions/motivation-payroll.ts` (modify) | Auto-calculate shiftsCount from shift records |
| `src/components/pos/shift-banner.tsx` (create) | POS shift status banner with open/close/cash-op buttons |
| `src/components/pos/open-shift-dialog.tsx` (create) | Dialog for opening a shift |
| `src/components/pos/close-shift-dialog.tsx` (create) | Dialog for closing a shift with summary |
| `src/components/pos/cash-operation-dialog.tsx` (create) | Dialog for withdraw/deposit |
| `src/components/pos/pos-interface.tsx` (modify) | Integrate ShiftBanner at top |
| `src/app/(dashboard)/shifts/page.tsx` (create) | Shift list server page |
| `src/app/(dashboard)/shifts/shifts-page-client.tsx` (create) | Shift list client component |
| `src/app/(dashboard)/shifts/[id]/page.tsx` (create) | Shift detail server page |
| `src/app/(dashboard)/shifts/[id]/shift-detail-client.tsx` (create) | Shift detail client component |
| `src/app/(dashboard)/settings/funds/page.tsx` (create) | Fund management server page |
| `src/app/(dashboard)/settings/funds/funds-page-client.tsx` (create) | Fund management client component |
| `src/app/(dashboard)/reports/funds/page.tsx` (create) | Fund report server page |
| `src/app/(dashboard)/reports/funds/funds-report-client.tsx` (create) | Fund report client component |
| `src/actions/reports.ts` (modify) | Add getFundReport action |
| `src/app/(dashboard)/print/shift/[id]/page.tsx` (create) | Shift A4 print page |
| `src/components/layout/app-sidebar.tsx` (modify) | Add "Смены" nav item |

---

## Chunk 1: Database Schema & Permissions

### Task 1: Prisma Schema — New Enums and Models

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** Enums go near existing enums (after line ~273). New models go at the end of the file (after TradeIn model at line 814). The project uses `@db.Decimal(12, 2)` for money, `@default(cuid())` for IDs, `@default(now())` for timestamps, `@updatedAt` for updatedAt. Relations use named `@relation("Name")` when a model has multiple relations to the same target.

- [ ] **Step 1: Add enums**

Add after the existing `TradeInStatus` enum block:

```prisma
// ---- Shifts & Funds ----

enum ShiftStatus {
  OPEN
  CLOSED
  AUTO_CLOSED
}

enum CashOpType {
  WITHDRAW
  DEPOSIT
}
```

- [ ] **Step 2: Add Shift model**

```prisma
model Shift {
  id           String      @id @default(cuid())
  number       String      @unique
  store        Store       @relation(fields: [storeId], references: [id])
  storeId      String
  openedBy     User        @relation("ShiftOpenedBy", fields: [openedById], references: [id])
  openedById   String
  closedBy     User?       @relation("ShiftClosedBy", fields: [closedById], references: [id])
  closedById   String?
  status       ShiftStatus @default(OPEN)
  openedAt     DateTime    @default(now())
  closedAt     DateTime?
  openingCash  Decimal     @db.Decimal(12, 2)
  closingCash  Decimal?    @db.Decimal(12, 2)
  expectedCash Decimal?    @db.Decimal(12, 2)
  discrepancy  Decimal?    @db.Decimal(12, 2)
  note         String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  sales          Sale[]
  payments       Payment[]
  returns        Return[]
  cashOperations CashOperation[]

  @@index([storeId, status])
}
```

- [ ] **Step 3: Add Fund model**

```prisma
model Fund {
  id        String   @id @default(cuid())
  name      String
  store     Store?   @relation(fields: [storeId], references: [id])
  storeId   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  cashOperations CashOperation[]

  @@unique([name, storeId])
}
```

- [ ] **Step 4: Add CashOperation model**

```prisma
model CashOperation {
  id            String     @id @default(cuid())
  shift         Shift      @relation(fields: [shiftId], references: [id])
  shiftId       String
  type          CashOpType
  amount        Decimal    @db.Decimal(12, 2)
  fund          Fund?      @relation(fields: [fundId], references: [id])
  fundId        String?
  supplier      Supplier?  @relation(fields: [supplierId], references: [id])
  supplierId    String?
  reason        String
  performedBy   User       @relation("CashOpPerformedBy", fields: [performedById], references: [id])
  performedById String
  createdAt     DateTime   @default(now())

  @@index([shiftId])
}
```

- [ ] **Step 5: Add shiftId to Sale model**

In the `Sale` model (line ~200), add after the `comment` field:

```prisma
  shift      Shift?  @relation(fields: [shiftId], references: [id])
  shiftId    String?
```

Add index: `@@index([shiftId])` (inside the Sale model block — if no indexes section exists, add before closing brace)

- [ ] **Step 6: Add shiftId to Payment model**

In the `Payment` model (line ~249), add after the `storeId`/`store` fields:

```prisma
  shift      Shift?  @relation(fields: [shiftId], references: [id])
  shiftId    String?
```

Add: `@@index([shiftId])`

- [ ] **Step 7: Add refundMethod and shiftId to Return model**

In the `Return` model (line ~275), add after `createdAt`:

```prisma
  refundMethod PaymentMethod?
  shift        Shift?  @relation(fields: [shiftId], references: [id])
  shiftId      String?
```

Add: `@@index([shiftId])`

- [ ] **Step 8: Add reverse relations to Store, User, Supplier**

In `Store` model (line ~10), add to the relations:
```prisma
  shifts           Shift[]
  funds            Fund[]
```

In `User` model (line ~39), add to the relations:
```prisma
  shiftsOpened     Shift[]          @relation("ShiftOpenedBy")
  shiftsClosed     Shift[]          @relation("ShiftClosedBy")
  cashOperations   CashOperation[]  @relation("CashOpPerformedBy")
```

In `Supplier` model (line ~300), add to the relations:
```prisma
  cashOperations CashOperation[]
```

- [ ] **Step 9: Generate Prisma client and create migration**

```bash
cd astore-erp && npx prisma generate
cd astore-erp && npx prisma migrate dev --name add-shifts-funds
```

Expected: migration created successfully, Prisma client generated.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat(shifts): add Shift, Fund, CashOperation models and modify Sale, Payment, Return"
```

---

### Task 2: Permissions & Role Presets

**Files:**
- Modify: `src/lib/permissions-list.ts`

**Context:** Permissions follow `{ code: "module.action", module: "module", name: "Russian Name" }` pattern. Role presets define which permissions each role gets. After modifying, `prisma db seed` will upsert the new permissions.

- [ ] **Step 1: Add shift and fund permissions**

Add after the Trade-in section (line ~65, before `} as const`):

```typescript
  // Shifts
  SHIFTS_OPEN: { code: "shifts.open", module: "shifts", name: "Открытие смены" },
  SHIFTS_CLOSE: { code: "shifts.close", module: "shifts", name: "Закрытие смены" },
  SHIFTS_VIEW: { code: "shifts.view", module: "shifts", name: "Просмотр своих смен" },
  SHIFTS_VIEW_ALL: { code: "shifts.view_all", module: "shifts", name: "Просмотр всех смен магазина" },
  SHIFTS_CASH_OPS: { code: "shifts.cash_ops", module: "shifts", name: "Операции с наличными" },

  // Funds
  FUNDS_MANAGE: { code: "funds.manage", module: "funds", name: "Управление фондами" },
```

- [ ] **Step 2: Update role presets**

In `seller` preset, add to permissions array:
```typescript
"shifts.open", "shifts.close", "shifts.view", "shifts.cash_ops",
```

The `director` and `owner` presets already include ALL permissions (owner gets `Object.values(PERMISSIONS).map(p => p.code)`, director gets all except `reports.full` and `settings.stores`), so they automatically get the new ones.

- [ ] **Step 3: Re-seed permissions**

```bash
cd astore-erp && npx prisma db seed
```

Expected: new permissions seeded, existing roles updated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions-list.ts
git commit -m "feat(shifts): add shift and fund permissions, update seller role preset"
```

---

### Task 3: Validation Schemas

**Files:**
- Create: `src/lib/validations/shifts.ts`

**Context:** Follow the pattern from `src/lib/validations/catalog.ts` — use `z.coerce.number()` for numeric inputs, `z.string().min(1, "error")` for required strings.

- [ ] **Step 1: Create validation schemas**

```typescript
import { z } from "zod"

export const openShiftSchema = z.object({
  storeId: z.string().min(1, "Магазин обязателен"),
  openingCash: z.coerce.number().min(0, "Сумма не может быть отрицательной"),
})

export const closeShiftSchema = z.object({
  shiftId: z.string().min(1),
  closingCash: z.coerce.number().min(0, "Сумма не может быть отрицательной"),
  note: z.string().optional(),
})

export const cashOperationSchema = z.object({
  shiftId: z.string().min(1),
  type: z.enum(["WITHDRAW", "DEPOSIT"]),
  amount: z.coerce.number().positive("Сумма должна быть положительной"),
  fundId: z.string().optional(),
  supplierId: z.string().optional(),
  reason: z.string().min(1, "Укажите причину"),
})

export const fundSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  storeId: z.string().optional(),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/shifts.ts
git commit -m "feat(shifts): add Zod validation schemas for shifts, cash ops, and funds"
```

---

## Chunk 2: Server Actions

### Task 4: Fund Actions

**Files:**
- Create: `src/actions/funds.ts`

**Context:** Follow the action pattern: `"use server"` directive, import `db`, `auth`, `requirePermission`. Serialize Decimal to Number, Date to `.toISOString()`. The `funds.manage` permission gates CRUD operations.

- [ ] **Step 1: Create fund actions**

```typescript
"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"

export async function getFunds(storeId?: string) {
  await requirePermission("funds.manage")

  const funds = await db.fund.findMany({
    where: storeId
      ? { OR: [{ storeId }, { storeId: null }] }
      : undefined,
    include: {
      store: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })

  return funds.map((f) => ({
    id: f.id,
    name: f.name,
    storeId: f.storeId,
    storeName: f.store?.name ?? null,
    isActive: f.isActive,
    createdAt: f.createdAt.toISOString(),
  }))
}

export async function createFund(data: { name: string; storeId?: string }) {
  await requirePermission("funds.manage")

  if (!data.name.trim()) throw new Error("Название обязательно")

  const existing = await db.fund.findFirst({
    where: { name: data.name.trim(), storeId: data.storeId ?? null },
  })
  if (existing) throw new Error("Фонд с таким названием уже существует")

  const fund = await db.fund.create({
    data: {
      name: data.name.trim(),
      storeId: data.storeId || null,
    },
  })

  return { id: fund.id }
}

export async function updateFund(
  id: string,
  data: { name?: string; storeId?: string }
) {
  await requirePermission("funds.manage")

  const fund = await db.fund.findUnique({ where: { id } })
  if (!fund) throw new Error("Фонд не найден")

  await db.fund.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.storeId !== undefined && { storeId: data.storeId || null }),
    },
  })
}

export async function toggleFundActive(id: string) {
  await requirePermission("funds.manage")

  const fund = await db.fund.findUnique({ where: { id } })
  if (!fund) throw new Error("Фонд не найден")

  await db.fund.update({
    where: { id },
    data: { isActive: !fund.isActive },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/funds.ts
git commit -m "feat(funds): add server actions for fund CRUD"
```

---

### Task 5: Shift Actions

**Files:**
- Create: `src/actions/shifts.ts`

**Context:** This is the core of the module. `openShift` auto-closes previous open shift in a transaction. `closeShift` calculates expectedCash inside a transaction. `getCurrentShift` is used by POS banner. Use `getNextNumber("SH")` for shift numbers.

- [ ] **Step 1: Create shift actions**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"

export async function getCurrentShift(storeId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findFirst({
    where: { storeId, status: "OPEN" },
    include: {
      openedBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!shift) return null

  return {
    id: shift.id,
    number: shift.number,
    openedAt: shift.openedAt.toISOString(),
    openingCash: Number(shift.openingCash),
    openedByName: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
  }
}

export async function openShift(data: {
  storeId: string
  openingCash: number
}) {
  await requirePermission("shifts.open", data.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const result = await db.$transaction(async (tx) => {
    const number = await getNextNumber("SH")

    // Auto-close any open shift for this store
    const existingOpen = await tx.shift.findFirst({
      where: { storeId: data.storeId, status: "OPEN" },
    })

    let hadPreviousOpen = false
    if (existingOpen) {
      await tx.shift.update({
        where: { id: existingOpen.id },
        data: {
          status: "AUTO_CLOSED",
          closedAt: new Date(),
          closedById: session.user!.id,
        },
      })
      hadPreviousOpen = true
    }

    // Create new shift
    const shift = await tx.shift.create({
      data: {
        number,
        storeId: data.storeId,
        openedById: session.user!.id,
        openingCash: data.openingCash,
      },
    })

    return { id: shift.id, number: shift.number, hadPreviousOpen }
  })

  return result
}

export async function getShiftSummary(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findUnique({
    where: { id: shiftId },
  })
  if (!shift) throw new Error("Смена не найдена")

  // Permission check
  const canViewAll = await checkPermission("shifts.view_all", shift.storeId)
  const canView = await checkPermission("shifts.view", shift.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")
  if (!canViewAll && shift.openedById !== session.user.id) {
    throw new Error("Нет доступа к этой смене")
  }

  // Cash sales (income)
  const cashIncome = await db.payment.aggregate({
    where: { shiftId, method: "CASH", isExpense: false },
    _sum: { amount: true },
  })

  // Cash expenses (trade-in buybacks)
  const cashExpenses = await db.payment.aggregate({
    where: { shiftId, method: "CASH", isExpense: true },
    _sum: { amount: true },
  })

  // Deposits
  const deposits = await db.cashOperation.aggregate({
    where: { shiftId, type: "DEPOSIT" },
    _sum: { amount: true },
  })

  // Withdrawals
  const withdrawals = await db.cashOperation.aggregate({
    where: { shiftId, type: "WITHDRAW" },
    _sum: { amount: true },
  })

  // Cash refunds
  const cashRefunds = await db.return.aggregate({
    where: { shiftId, refundMethod: "CASH" },
    _sum: { amount: true },
  })

  // Payment breakdown by method
  const paymentsByMethod = await db.payment.groupBy({
    by: ["method"],
    where: { shiftId, isExpense: false },
    _sum: { amount: true },
  })

  // Sales count
  const salesCount = await db.sale.count({ where: { shiftId } })

  // Returns count and total
  const returnsAgg = await db.return.aggregate({
    where: { shiftId },
    _sum: { amount: true },
    _count: true,
  })

  const expectedCash =
    Number(shift.openingCash) +
    Number(cashIncome._sum.amount ?? 0) +
    Number(deposits._sum.amount ?? 0) -
    Number(cashExpenses._sum.amount ?? 0) -
    Number(withdrawals._sum.amount ?? 0) -
    Number(cashRefunds._sum.amount ?? 0)

  return {
    openingCash: Number(shift.openingCash),
    cashIncome: Number(cashIncome._sum.amount ?? 0),
    cashExpenses: Number(cashExpenses._sum.amount ?? 0),
    deposits: Number(deposits._sum.amount ?? 0),
    withdrawals: Number(withdrawals._sum.amount ?? 0),
    cashRefunds: Number(cashRefunds._sum.amount ?? 0),
    expectedCash,
    salesCount,
    returnsCount: returnsAgg._count,
    returnsTotal: Number(returnsAgg._sum.amount ?? 0),
    paymentsByMethod: paymentsByMethod.map((p) => ({
      method: p.method,
      total: Number(p._sum.amount ?? 0),
    })),
  }
}

export async function closeShift(data: {
  shiftId: string
  closingCash: number
  note?: string
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Fetch shift first to get storeId for permission check
  const shiftCheck = await db.shift.findUnique({ where: { id: data.shiftId } })
  if (!shiftCheck) throw new Error("Смена не найдена")
  await requirePermission("shifts.close", shiftCheck.storeId)

  const result = await db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: data.shiftId } })
    if (!shift) throw new Error("Смена не найдена")
    if (shift.status !== "OPEN") throw new Error("Смена уже закрыта")

    // Calculate expectedCash inside transaction for consistency
    const cashIncome = await tx.payment.aggregate({
      where: { shiftId: data.shiftId, method: "CASH", isExpense: false },
      _sum: { amount: true },
    })
    const cashExpenses = await tx.payment.aggregate({
      where: { shiftId: data.shiftId, method: "CASH", isExpense: true },
      _sum: { amount: true },
    })
    const deposits = await tx.cashOperation.aggregate({
      where: { shiftId: data.shiftId, type: "DEPOSIT" },
      _sum: { amount: true },
    })
    const withdrawals = await tx.cashOperation.aggregate({
      where: { shiftId: data.shiftId, type: "WITHDRAW" },
      _sum: { amount: true },
    })
    const cashRefunds = await tx.return.aggregate({
      where: { shiftId: data.shiftId, refundMethod: "CASH" },
      _sum: { amount: true },
    })

    const expectedCash =
      Number(shift.openingCash) +
      Number(cashIncome._sum.amount ?? 0) +
      Number(deposits._sum.amount ?? 0) -
      Number(cashExpenses._sum.amount ?? 0) -
      Number(withdrawals._sum.amount ?? 0) -
      Number(cashRefunds._sum.amount ?? 0)

    const discrepancy = +(data.closingCash - expectedCash).toFixed(2)

    if (discrepancy !== 0 && !data.note?.trim()) {
      throw new Error("При расхождении необходимо указать комментарий")
    }

    return tx.shift.update({
      where: { id: data.shiftId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: session.user!.id,
        closingCash: data.closingCash,
        expectedCash,
        discrepancy,
        note: data.note?.trim() || null,
      },
    })
  })

  return { id: result.id, number: result.number }
}

export async function getShifts(params: {
  storeId: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  perPage?: number
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const canViewAll = await checkPermission("shifts.view_all", params.storeId)
  const canView = await checkPermission("shifts.view", params.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")

  const page = params.page ?? 1
  const perPage = params.perPage ?? 20

  const where: Record<string, unknown> = {
    storeId: params.storeId,
  }

  // If user can only view own shifts
  if (!canViewAll) {
    where.openedById = session.user.id
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status
  }

  if (params.dateFrom || params.dateTo) {
    where.openedAt = {
      ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
      ...(params.dateTo && { lte: new Date(params.dateTo + "T23:59:59.999Z") }),
    }
  }

  const [shifts, total] = await Promise.all([
    db.shift.findMany({
      where,
      include: {
        openedBy: { select: { firstName: true, lastName: true } },
        closedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.shift.count({ where }),
  ])

  return {
    shifts: shifts.map((s) => ({
      id: s.id,
      number: s.number,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openedByName: `${s.openedBy.firstName} ${s.openedBy.lastName}`,
      closedByName: s.closedBy
        ? `${s.closedBy.firstName} ${s.closedBy.lastName}`
        : null,
      openingCash: Number(s.openingCash),
      closingCash: s.closingCash ? Number(s.closingCash) : null,
      expectedCash: s.expectedCash ? Number(s.expectedCash) : null,
      discrepancy: s.discrepancy ? Number(s.discrepancy) : null,
    })),
    total,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function getShift(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: {
      store: { select: { id: true, name: true } },
      openedBy: { select: { firstName: true, lastName: true } },
      closedBy: { select: { firstName: true, lastName: true } },
      sales: {
        select: {
          id: true,
          number: true,
          finalAmount: true,
          createdAt: true,
          payments: { select: { method: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      returns: {
        select: {
          id: true,
          number: true,
          amount: true,
          refundMethod: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      cashOperations: {
        include: {
          fund: { select: { name: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!shift) throw new Error("Смена не найдена")

  // Permission check — user must have view or view_all
  const canViewAll = await checkPermission("shifts.view_all", shift.storeId)
  const canView = await checkPermission("shifts.view", shift.storeId)
  if (!canViewAll && !canView) throw new Error("Нет доступа")
  if (!canViewAll && shift.openedById !== session.user.id) {
    throw new Error("Нет доступа к этой смене")
  }

  return {
    id: shift.id,
    number: shift.number,
    status: shift.status,
    storeId: shift.store.id,
    storeName: shift.store.name,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openedByName: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
    closedByName: shift.closedBy
      ? `${shift.closedBy.firstName} ${shift.closedBy.lastName}`
      : null,
    openingCash: Number(shift.openingCash),
    closingCash: shift.closingCash ? Number(shift.closingCash) : null,
    expectedCash: shift.expectedCash ? Number(shift.expectedCash) : null,
    discrepancy: shift.discrepancy ? Number(shift.discrepancy) : null,
    note: shift.note,
    sales: shift.sales.map((s) => ({
      id: s.id,
      number: s.number,
      amount: Number(s.finalAmount),
      createdAt: s.createdAt.toISOString(),
      payments: s.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
    })),
    returns: shift.returns.map((r) => ({
      id: r.id,
      number: r.number,
      amount: Number(r.amount),
      refundMethod: r.refundMethod,
      createdAt: r.createdAt.toISOString(),
    })),
    cashOperations: shift.cashOperations.map((co) => ({
      id: co.id,
      type: co.type,
      amount: Number(co.amount),
      fundName: co.fund?.name ?? null,
      reason: co.reason,
      performedByName: `${co.performedBy.firstName} ${co.performedBy.lastName}`,
      createdAt: co.createdAt.toISOString(),
    })),
  }
}

export async function checkOpenShift(storeId: string) {
  const shift = await db.shift.findFirst({
    where: { storeId, status: "OPEN" },
    select: { id: true, number: true, openedAt: true },
  })
  return shift
    ? {
        id: shift.id,
        number: shift.number,
        openedAt: shift.openedAt.toISOString(),
      }
    : null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/shifts.ts
git commit -m "feat(shifts): add server actions for shift open/close/list/detail"
```

---

### Task 6: Cash Operation Actions

**Files:**
- Create: `src/actions/cash-operations.ts`

- [ ] **Step 1: Create cash operation actions**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"

export async function createCashOperation(data: {
  shiftId: string
  type: "WITHDRAW" | "DEPOSIT"
  amount: number
  fundId?: string
  supplierId?: string
  reason: string
}) {
  await requirePermission("shifts.cash_ops")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (data.amount <= 0) throw new Error("Сумма должна быть положительной")
  if (!data.reason.trim()) throw new Error("Укажите причину")
  if (data.type === "WITHDRAW" && !data.fundId) {
    throw new Error("Для выемки укажите фонд")
  }

  // Verify shift is open
  const shift = await db.shift.findUnique({ where: { id: data.shiftId } })
  if (!shift) throw new Error("Смена не найдена")
  if (shift.status !== "OPEN") throw new Error("Смена закрыта")

  const op = await db.cashOperation.create({
    data: {
      shiftId: data.shiftId,
      type: data.type,
      amount: data.amount,
      fundId: data.fundId || null,
      supplierId: data.supplierId || null,
      reason: data.reason.trim(),
      performedById: session.user.id,
    },
  })

  return { id: op.id }
}

export async function getCashOperations(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const operations = await db.cashOperation.findMany({
    where: { shiftId },
    include: {
      fund: { select: { name: true } },
      supplier: { select: { name: true } },
      performedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return operations.map((op) => ({
    id: op.id,
    type: op.type,
    amount: Number(op.amount),
    fundName: op.fund?.name ?? null,
    supplierName: op.supplier?.name ?? null,
    reason: op.reason,
    performedByName: `${op.performedBy.firstName} ${op.performedBy.lastName}`,
    createdAt: op.createdAt.toISOString(),
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/cash-operations.ts
git commit -m "feat(shifts): add cash operation server actions"
```

---

### Task 7: Integrate shiftId into Existing Actions

**Files:**
- Modify: `src/actions/sales.ts` (createSale ~line 89, createReturn ~line 338)
- Modify: `src/actions/trade-in.ts` (createTradeIn — inside the $transaction)

**Context:** Inside each `db.$transaction`, add a shift lookup query and set `shiftId` on created records. The shift lookup pattern is:

```typescript
const openShift = await tx.shift.findFirst({
  where: { storeId, status: "OPEN" },
  select: { id: true },
})
const shiftId = openShift?.id ?? null
```

- [ ] **Step 1: Modify createSale**

In `src/actions/sales.ts`, inside the `db.$transaction` callback (around line 89), add at the start of the transaction body (before "Check stock"):

```typescript
    // Lookup open shift
    const openShift = await tx.shift.findFirst({
      where: { storeId: data.storeId, status: "OPEN" },
      select: { id: true },
    })
    const shiftId = openShift?.id ?? null
```

Then in `tx.sale.create({ data: { ... } })` (around line 106), add `shiftId` to the data object:

```typescript
        shiftId,
```

And in the `payments.create` map (around line 127), add `shiftId` to each payment:

```typescript
          create: data.payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            shiftId,
          })),
```

- [ ] **Step 2: Modify createReturn**

In `src/actions/sales.ts`, inside `createReturn`'s `db.$transaction` (around line 338), add at the start:

```typescript
    // Lookup open shift
    const openShift = await tx.shift.findFirst({
      where: { storeId: sale.storeId, status: "OPEN" },
      select: { id: true },
    })
    const shiftId = openShift?.id ?? null
```

Then add a `refundMethod` parameter to `createReturn`'s data type:

```typescript
export async function createReturn(data: {
  saleId: string
  items: Array<{ saleItemId: string; quantity: number }>
  reason: string
  refundMethod: "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"
}) {
```

And in `tx.return.create({ data: { ... } })` (around line 367), add:

```typescript
        refundMethod: data.refundMethod,
        shiftId,
```

- [ ] **Step 3: Modify createTradeIn**

In `src/actions/trade-in.ts`, inside `createTradeIn`'s `db.$transaction`, when creating the buyback Payment, add shift lookup and set `shiftId`:

Find the Payment creation for buyback and add `shiftId`:

```typescript
    // Before creating the payout Payment, lookup open shift
    const openShift = await tx.shift.findFirst({
      where: { storeId: data.storeId, status: "OPEN" },
      select: { id: true },
    })
    const shiftId = openShift?.id ?? null
```

And add `shiftId` to the Payment create data.

- [ ] **Step 4: Modify custom order payment creation**

In `src/actions/orders.ts`, find where Payments are created for custom orders. Add the shift lookup pattern inside the existing transaction (or wrap in a transaction if not already):

```typescript
    // Lookup open shift
    const openShift = await tx.shift.findFirst({
      where: { storeId: order.storeId, status: "OPEN" },
      select: { id: true },
    })
    const shiftId = openShift?.id ?? null
```

Add `shiftId` to each Payment create call for custom orders.

- [ ] **Step 5: Modify repair payment creation**

In `src/actions/repairs.ts`, find where Payments are created for repairs. The payment creation may not be inside a transaction — if so, wrap the shift lookup + payment create in `db.$transaction`:

```typescript
    const payment = await db.$transaction(async (tx) => {
      const openShift = await tx.shift.findFirst({
        where: { storeId: repair.storeId, status: "OPEN" },
        select: { id: true },
      })
      return tx.payment.create({
        data: {
          repairId: repair.id,
          method: data.method,
          amount: data.amount,
          shiftId: openShift?.id ?? null,
        },
      })
    })
```

- [ ] **Step 6: Update POS return dialog to pass refundMethod**

Find the component that calls `createReturn` (likely in `src/components/pos/` or the returns page) and add a `refundMethod` field/parameter. If the return dialog doesn't have a payment method selector, add one (a simple Select with PaymentMethod options).

- [ ] **Step 7: Verify build**

```bash
cd astore-erp && npx next build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/actions/sales.ts src/actions/trade-in.ts src/actions/orders.ts src/actions/repairs.ts
git commit -m "feat(shifts): integrate shiftId into createSale, createReturn, createTradeIn, orders, repairs"
```

---

### Task 7b: Payroll Integration — Auto-calculate shiftsCount

**Files:**
- Modify: `src/actions/motivation-payroll.ts` (or wherever payroll records are created)

**Context:** The spec (section 6.5) requires auto-calculating `shiftsCount` when creating a payroll record. The `shiftsCount` field already exists in the Payroll model. Query `db.shift.count()` for closed shifts by user/store/period, pre-fill the field. Allow manual override (if count is 0, user can still enter a number).

- [ ] **Step 1: Add shift count auto-calculation**

Find the payroll creation function. Before creating the Payroll record, add:

```typescript
    // Auto-calculate shifts count
    const shiftsCount = await db.shift.count({
      where: {
        openedById: userId,
        status: { in: ["CLOSED", "AUTO_CLOSED"] },
        storeId,
        openedAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      },
    })
```

Use this `shiftsCount` as the default value when creating the payroll. If the form allows manual override, use the user-provided value when explicitly set, otherwise use the auto-calculated value.

- [ ] **Step 2: Commit**

```bash
git add src/actions/motivation-payroll.ts
git commit -m "feat(shifts): auto-calculate shiftsCount in payroll from shift records"
```

---

## Chunk 3: POS Integration (Banner + Dialogs)

### Task 8: Shift Banner Component

**Files:**
- Create: `src/components/pos/shift-banner.tsx`

**Context:** The banner goes at the top of POS interface. Shows shift status with action buttons. Uses `getCurrentShift` action. Colors: no shift = yellow warning, open shift = green strip. Must import from `@/components/ui/*`, `lucide-react`, `sonner`.

- [ ] **Step 1: Create ShiftBanner**

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, DoorOpen, DoorClosed, Banknote } from "lucide-react"
import { getCurrentShift } from "@/actions/shifts"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatMoney } from "@/lib/format"
import { OpenShiftDialog } from "./open-shift-dialog"
import { CloseShiftDialog } from "./close-shift-dialog"
import { CashOperationDialog } from "./cash-operation-dialog"

interface ShiftInfo {
  id: string
  number: string
  openedAt: string
  openingCash: number
  openedByName: string
}

export function ShiftBanner() {
  const { currentStoreId } = useCurrentStore()
  const [shift, setShift] = useState<ShiftInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [cashOpDialogOpen, setCashOpDialogOpen] = useState(false)

  const loadShift = useCallback(async () => {
    if (!currentStoreId) return
    try {
      const result = await getCurrentShift(currentStoreId)
      setShift(result)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId])

  useEffect(() => {
    loadShift()
  }, [loadShift])

  if (loading || !currentStoreId) return null

  if (!shift) {
    return (
      <>
        <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 dark:border-yellow-700 dark:bg-yellow-950">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <Clock className="size-4" />
            <span>Смена не открыта</span>
          </div>
          <Button size="sm" onClick={() => setOpenDialogOpen(true)}>
            <DoorOpen className="size-4" />
            Открыть смену
          </Button>
        </div>
        <OpenShiftDialog
          storeId={currentStoreId}
          open={openDialogOpen}
          onOpenChange={setOpenDialogOpen}
          onSuccess={loadShift}
        />
      </>
    )
  }

  const openedTime = new Date(shift.openedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-4 py-2 dark:border-green-700 dark:bg-green-950">
        <div className="flex items-center gap-3 text-sm text-green-800 dark:text-green-200">
          <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
            {shift.number}
          </Badge>
          <span>{shift.openedByName}</span>
          <span className="text-muted-foreground">с {openedTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCashOpDialogOpen(true)}
          >
            <Banknote className="size-4" />
            Инкассация
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCloseDialogOpen(true)}
          >
            <DoorClosed className="size-4" />
            Закрыть смену
          </Button>
        </div>
      </div>
      <CloseShiftDialog
        shiftId={shift.id}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        onSuccess={loadShift}
      />
      <CashOperationDialog
        shiftId={shift.id}
        storeId={currentStoreId}
        open={cashOpDialogOpen}
        onOpenChange={setCashOpDialogOpen}
        onSuccess={loadShift}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pos/shift-banner.tsx
git commit -m "feat(shifts): add POS shift banner component"
```

---

### Task 9: Open Shift Dialog

**Files:**
- Create: `src/components/pos/open-shift-dialog.tsx`

**Context:** Uses `@base-ui/react` Dialog (imported as `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` from `@/components/ui/dialog`). Number input for opening cash amount. Shows alert if unclosed shift exists.

- [ ] **Step 1: Create OpenShiftDialog**

```typescript
"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from "lucide-react"
import { openShift, checkOpenShift } from "@/actions/shifts"
import { toast } from "sonner"

interface OpenShiftDialogProps {
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function OpenShiftDialog({
  storeId,
  open,
  onOpenChange,
  onSuccess,
}: OpenShiftDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [openingCash, setOpeningCash] = useState("")
  const [existingShift, setExistingShift] = useState<{
    number: string
    openedAt: string
  } | null>(null)

  useEffect(() => {
    if (open) {
      setOpeningCash("")
      checkOpenShift(storeId).then((s) => setExistingShift(s))
    }
  }, [open, storeId])

  function handleSubmit() {
    const cash = parseFloat(openingCash)
    if (isNaN(cash) || cash < 0) {
      toast.error("Укажите корректную сумму")
      return
    }

    startTransition(async () => {
      try {
        await openShift({ storeId, openingCash: cash })
        toast.success("Смена открыта")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка открытия смены")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Открыть смену</DialogTitle>
          <DialogDescription>
            Введите сумму наличных в кассе на начало смены
          </DialogDescription>
        </DialogHeader>

        {existingShift && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-700 dark:bg-yellow-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Есть незакрытая смена
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                Смена {existingShift.number} от{" "}
                {new Date(existingShift.openedAt).toLocaleDateString("ru-RU")}{" "}
                будет закрыта автоматически
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-2 py-2">
          <Label htmlFor="opening-cash">Сумма наличных в кассе, ₽</Label>
          <Input
            id="opening-cash"
            type="number"
            min="0"
            step="0.01"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Открыть смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pos/open-shift-dialog.tsx
git commit -m "feat(shifts): add open shift dialog"
```

---

### Task 10: Close Shift Dialog

**Files:**
- Create: `src/components/pos/close-shift-dialog.tsx`

**Context:** Shows shift summary (sales by payment method, returns, withdrawals, deposits, expected cash). User enters actual cash. Shows discrepancy with color coding. Requires note if discrepancy ≠ 0.

- [ ] **Step 1: Create CloseShiftDialog**

```typescript
"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"
import { getShiftSummary, closeShift } from "@/actions/shifts"
import { formatMoney } from "@/lib/format"
import { toast } from "sonner"

const METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

interface CloseShiftDialogProps {
  shiftId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Summary = Awaited<ReturnType<typeof getShiftSummary>>

export function CloseShiftDialog({
  shiftId,
  open,
  onOpenChange,
  onSuccess,
}: CloseShiftDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [closingCash, setClosingCash] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setClosingCash("")
      setNote("")
      setLoadingSummary(true)
      getShiftSummary(shiftId)
        .then(setSummary)
        .finally(() => setLoadingSummary(false))
    }
  }, [open, shiftId])

  const closingCashNum = parseFloat(closingCash) || 0
  const discrepancy = summary ? +(closingCashNum - summary.expectedCash).toFixed(2) : 0
  const hasDiscrepancy = closingCash !== "" && discrepancy !== 0

  function handleSubmit() {
    if (closingCash === "") {
      toast.error("Укажите фактическую сумму наличных")
      return
    }
    if (hasDiscrepancy && !note.trim()) {
      toast.error("При расхождении укажите комментарий")
      return
    }

    startTransition(async () => {
      try {
        await closeShift({
          shiftId,
          closingCash: closingCashNum,
          note: note.trim() || undefined,
        })
        toast.success("Смена закрыта")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка закрытия смены")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Закрыть смену</DialogTitle>
          <DialogDescription>Проверьте итоги смены и введите фактическую сумму</DialogDescription>
        </DialogHeader>

        {loadingSummary ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : summary ? (
          <div className="space-y-4 py-2">
            {/* Payment method breakdown */}
            <div>
              <p className="mb-2 text-sm font-medium">
                Продажи за смену ({summary.salesCount} шт.)
              </p>
              <div className="space-y-1 text-sm">
                {summary.paymentsByMethod.map((pm) => (
                  <div key={pm.method} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {METHOD_LABELS[pm.method] ?? pm.method}
                    </span>
                    <span>{formatMoney(pm.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {summary.returnsCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Возвраты ({summary.returnsCount})
                </span>
                <span className="text-red-600">−{formatMoney(summary.returnsTotal)}</span>
              </div>
            )}

            {(summary.withdrawals > 0 || summary.deposits > 0) && (
              <div className="space-y-1 text-sm">
                {summary.withdrawals > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Выемки</span>
                    <span className="text-red-600">−{formatMoney(summary.withdrawals)}</span>
                  </div>
                )}
                {summary.deposits > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Внесения</span>
                    <span className="text-green-600">+{formatMoney(summary.deposits)}</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-sm font-bold">
              <span>Ожидаемая сумма наличных</span>
              <span className="text-lg">{formatMoney(summary.expectedCash)}</span>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="closing-cash">Фактическая сумма наличных, ₽</Label>
              <Input
                id="closing-cash"
                type="number"
                min="0"
                step="0.01"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>

            {closingCash !== "" && (
              <div
                className={`flex justify-between rounded-lg p-2 text-sm font-medium ${
                  discrepancy === 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                <span>Расхождение</span>
                <span>
                  {discrepancy > 0 ? "+" : ""}
                  {formatMoney(discrepancy)}
                </span>
              </div>
            )}

            {hasDiscrepancy && (
              <div className="grid gap-2">
                <Label htmlFor="close-note">
                  Комментарий к расхождению *
                </Label>
                <Textarea
                  id="close-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Объясните причину расхождения..."
                />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || loadingSummary}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Закрыть смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pos/close-shift-dialog.tsx
git commit -m "feat(shifts): add close shift dialog with summary and discrepancy"
```

---

### Task 11: Cash Operation Dialog

**Files:**
- Create: `src/components/pos/cash-operation-dialog.tsx`

**Context:** Toggle between WITHDRAW/DEPOSIT. Amount, fund select (store + global funds), optional supplier select, required reason. Fund select: query `WHERE (storeId = currentStoreId OR storeId IS NULL) AND isActive = true`. Uses base-ui Select: `onValueChange={(val) => setFundId(val ?? "")}`.

- [ ] **Step 1: Create CashOperationDialog**

```typescript
"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { createCashOperation } from "@/actions/cash-operations"
import { getFunds } from "@/actions/funds"
import { getSuppliers } from "@/actions/suppliers"
import { toast } from "sonner"

interface CashOperationDialogProps {
  shiftId: string
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FundItem = { id: string; name: string; storeName: string | null }
type SupplierItem = { id: string; name: string }

export function CashOperationDialog({
  shiftId,
  storeId,
  open,
  onOpenChange,
  onSuccess,
}: CashOperationDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<"WITHDRAW" | "DEPOSIT">("WITHDRAW")
  const [amount, setAmount] = useState("")
  const [fundId, setFundId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [reason, setReason] = useState("")
  const [funds, setFunds] = useState<FundItem[]>([])
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])

  useEffect(() => {
    if (open) {
      setAmount("")
      setFundId("")
      setSupplierId("")
      setReason("")
      setType("WITHDRAW")
      getFunds(storeId).then((f) =>
        setFunds(f.filter((fund) => fund.isActive))
      )
      getSuppliers({ isActive: true, perPage: 100 }).then((r) =>
        setSuppliers(r.suppliers.map((s) => ({ id: s.id, name: s.name })))
      )
    }
  }, [open, storeId])

  function handleSubmit() {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Укажите корректную сумму")
      return
    }
    if (!reason.trim()) {
      toast.error("Укажите причину")
      return
    }
    if (type === "WITHDRAW" && !fundId) {
      toast.error("Для выемки выберите фонд")
      return
    }

    startTransition(async () => {
      try {
        await createCashOperation({
          shiftId,
          type,
          amount: amountNum,
          fundId: fundId || undefined,
          supplierId: supplierId || undefined,
          reason: reason.trim(),
        })
        toast.success(type === "WITHDRAW" ? "Выемка проведена" : "Внесение проведено")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Операция с наличными</DialogTitle>
          <DialogDescription>Выемка или внесение наличных в кассу</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              variant={type === "WITHDRAW" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setType("WITHDRAW")}
            >
              <ArrowUpFromLine className="size-4" />
              Выемка
            </Button>
            <Button
              variant={type === "DEPOSIT" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setType("DEPOSIT")}
            >
              <ArrowDownToLine className="size-4" />
              Внесение
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cash-op-amount">Сумма, ₽</Label>
            <Input
              id="cash-op-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-2">
            <Label>Фонд {type === "WITHDRAW" && "*"}</Label>
            <Select value={fundId} onValueChange={(val) => setFundId(val ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите фонд" />
              </SelectTrigger>
              <SelectContent>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                    {f.storeName ? "" : " (глобальный)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {suppliers.length > 0 && (
            <div className="grid gap-2">
              <Label>Поставщик</Label>
              <Select value={supplierId} onValueChange={(val) => setSupplierId(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Не выбран" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="cash-op-reason">Причина *</Label>
            <Input
              id="cash-op-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Укажите причину операции"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Провести
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pos/cash-operation-dialog.tsx
git commit -m "feat(shifts): add cash operation dialog (withdraw/deposit)"
```

---

### Task 12: Integrate ShiftBanner into POS

**Files:**
- Modify: `src/components/pos/pos-interface.tsx`

- [ ] **Step 1: Add ShiftBanner import and render**

At the top of imports, add:
```typescript
import { ShiftBanner } from "./shift-banner"
```

Inside the component's return, add `<ShiftBanner />` as the first element, before the search/cart area. It should be at the top of the main flex container. Find the outer `<div>` of the component's return and add:

```typescript
  return (
    <div className="flex flex-col gap-4">
      <ShiftBanner />
      {/* ... existing POS interface ... */}
    </div>
  )
```

If the outer div doesn't have `gap-4`, adjust the wrapping to include it.

- [ ] **Step 2: Verify build**

```bash
cd astore-erp && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/pos/pos-interface.tsx
git commit -m "feat(shifts): integrate shift banner into POS interface"
```

---

## Chunk 4: Shift List & Detail Pages

### Task 13: Shift List Page

**Files:**
- Create: `src/app/(dashboard)/shifts/page.tsx`
- Create: `src/app/(dashboard)/shifts/shifts-page-client.tsx`

**Context:** Follow the pattern from `src/app/(dashboard)/trade-in/page.tsx` (server component) and `trade-in-page-client.tsx` (client component with filters, table, pagination). Use `useCurrentStore()` for store context. Status badges: OPEN=green, CLOSED=gray, AUTO_CLOSED=red.

- [ ] **Step 1: Create server page**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ShiftsPageClient } from "./shifts-page-client"

export default async function ShiftsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("shifts.view")
  const canViewAll = await checkPermission("shifts.view_all")
  if (!canView && !canViewAll) redirect("/")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Смены</h1>
        <p className="text-muted-foreground">История смен и кассовых операций</p>
      </div>
      <ShiftsPageClient />
    </div>
  )
}
```

- [ ] **Step 2: Create client component**

Create `shifts-page-client.tsx` — a full client component with:
- Store filter from `useCurrentStore()`
- Date range filter (two date inputs)
- Status filter (Select: Все / Открыта / Закрыта / Не закрыта)
- Table with columns: Номер, Дата, Продавец, Время (open→close), Наличные (open→close), Расхождение, Статус
- Status badges with colors: OPEN=green "Открыта", CLOSED=gray "Закрыта", AUTO_CLOSED=red "Не закрыта"
- Pagination (same pattern as supplier-table.tsx)
- Row click → router.push(`/shifts/${shift.id}`)
- Uses `getShifts` action

Full implementation following the exact trade-in list pattern but with shift-specific filters and columns.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/shifts/
git commit -m "feat(shifts): add shift list page with filters and status badges"
```

---

### Task 14: Shift Detail Page

**Files:**
- Create: `src/app/(dashboard)/shifts/[id]/page.tsx`
- Create: `src/app/(dashboard)/shifts/[id]/shift-detail-client.tsx`

**Context:** Follow repair detail page pattern. Server page checks auth + permission, client component fetches and renders data. Shows: info cards, cash summary, payment breakdown, sales table, returns table, cash operations table, print button.

For AUTO_CLOSED shifts: cash summary shows only opening cash, rest shows "—" with warning text "Смена не была закрыта вручную. Данные по наличным отсутствуют."

For OPEN shifts: show live expectedCash calculation (call getShiftSummary).

- [ ] **Step 1: Create server page**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ShiftDetailClient } from "./shift-detail-client"

interface ShiftDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("shifts.view")
  const canViewAll = await checkPermission("shifts.view_all")
  if (!canView && !canViewAll) redirect("/")

  return <ShiftDetailClient shiftId={id} />
}
```

- [ ] **Step 2: Create client component**

Create `shift-detail-client.tsx` with:
- Fetch `getShift(shiftId)` on mount
- Back button "← Назад к списку" (Link to /shifts)
- Header: shift number + status badge
- Info cards: store, who opened, who closed, work time
- Cash summary card with conditional rendering by status
- Payment method breakdown card
- Sales table (number, time, amount, method)
- Returns table (number, time, amount, refund method)
- Cash operations table (time, type, amount, fund, reason, who)
- Print button: opens `/print/shift/${id}` in new tab

Full implementation — ~300 lines, referencing the same UI components as repair-detail.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/shifts/\[id\]/
git commit -m "feat(shifts): add shift detail page with summary and data tables"
```

---

## Chunk 5: Settings, Reports, Print, Navigation

### Task 15: Fund Management Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/funds/page.tsx`
- Create: `src/app/(dashboard)/settings/funds/funds-page-client.tsx`

**Context:** Follow the pattern from `settings/motivation-groups/motivation-groups-client.tsx` — table with create/edit dialog, no delete (only deactivate toggle). Uses `getFunds`, `createFund`, `updateFund`, `toggleFundActive` actions. Shows global funds as "Глобальный" in store column.

- [ ] **Step 1: Create server page**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { FundsPageClient } from "./funds-page-client"
import { getFunds } from "@/actions/funds"

export default async function FundsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("funds.manage")
  if (!canManage) redirect("/settings")

  const funds = await getFunds()

  return (
    <div className="space-y-6">
      <FundsPageClient initialFunds={funds} />
    </div>
  )
}
```

- [ ] **Step 2: Create client component**

Create `funds-page-client.tsx` following the motivation-groups-client.tsx pattern:
- Table: Name, Store ("Глобальный" if null), Status (active/inactive toggle)
- Create dialog: name, store select (or "Глобальный")
- Edit dialog: name, store
- Toggle active/inactive button (no delete)
- Uses `router.refresh()` after mutations

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/funds/
git commit -m "feat(funds): add fund management settings page"
```

---

### Task 16: Fund Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/funds/page.tsx`
- Create: `src/app/(dashboard)/reports/funds/funds-report-client.tsx`
- Modify: `src/actions/reports.ts` (or create if needed)

**Context:** Follow the reports page pattern — date range picker, store filter. Table: Fund name, Store, Total inflow (deposits), Total outflow (withdrawals), Operation count. Totals row. Uses `shifts.view_all` permission.

- [ ] **Step 1: Add fund report action**

Create or modify `src/actions/reports.ts` to add:

```typescript
export async function getFundReport(params: {
  storeId?: string
  dateFrom: string
  dateTo: string
}) {
  await requirePermission("shifts.view_all")

  const where: Record<string, unknown> = {
    createdAt: {
      gte: new Date(params.dateFrom),
      lte: new Date(params.dateTo + "T23:59:59.999Z"),
    },
  }

  if (params.storeId) {
    where.shift = { storeId: params.storeId }
  }

  const operations = await db.cashOperation.findMany({
    where,
    include: {
      fund: { select: { id: true, name: true, storeId: true } },
      shift: { select: { store: { select: { name: true } } } },
    },
  })

  // Group by fund + store (a global fund may have ops from different stores)
  const fundMap = new Map<string, {
    fundName: string
    storeName: string
    deposits: number
    withdrawals: number
    count: number
  }>()

  for (const op of operations) {
    const fundKey = op.fundId ?? "no-fund"
    const storeKey = op.shift.store.name
    const key = `${fundKey}::${storeKey}`
    const existing = fundMap.get(key) ?? {
      fundName: op.fund?.name ?? "Без фонда",
      storeName: storeKey,
      deposits: 0,
      withdrawals: 0,
      count: 0,
    }

    if (op.type === "DEPOSIT") {
      existing.deposits += Number(op.amount)
    } else {
      existing.withdrawals += Number(op.amount)
    }
    existing.count++
    fundMap.set(key, existing)
  }

  return Array.from(fundMap.values())
}
```

- [ ] **Step 2: Create fund report page and client component**

Server page with `shifts.view_all` permission gate. Client component with date range picker, store filter, table with fund breakdown.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/funds/ src/actions/reports.ts
git commit -m "feat(funds): add fund report page with period and store filters"
```

---

### Task 17: Shift Print Page

**Files:**
- Create: `src/app/(dashboard)/print/shift/[id]/page.tsx`

**Context:** Follow the print/sale pattern — server page, uses `PrintLayout` component. This is a simple A4 layout, NOT using the document template constructor. Two stub areas for receipts.

- [ ] **Step 1: Create print page**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PrintLayout } from "@/components/print/print-layout"
import { formatMoney } from "@/lib/format"

interface PrintShiftPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintShiftPage({ params }: PrintShiftPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      store: { select: { name: true } },
      openedBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!shift) redirect("/shifts")

  const date = shift.openedAt.toLocaleDateString("ru-RU")
  const employeeName = `${shift.openedBy.firstName} ${shift.openedBy.lastName}`

  return (
    <PrintLayout title={`Смена ${shift.number}`}>
      <div className="p-8 font-mono text-sm">
        <div className="mb-6 flex justify-between">
          <div>
            <p className="text-lg font-bold">{shift.store.name}</p>
            <p>Дата: {date}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Смена №{shift.number}</p>
            <p>Продавец: {employeeName}</p>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Opening stub */}
          <div className="flex-1 rounded border-2 border-dashed border-gray-400 p-6">
            <p className="mb-4 text-center font-bold">ОТКРЫТИЕ СМЕНЫ</p>
            <p>Наличные: {formatMoney(Number(shift.openingCash))}</p>
            <div className="mt-8 border-t border-gray-300 pt-2 text-center text-xs text-gray-500">
              (место для чека)
            </div>
            <div className="h-40" />
          </div>

          {/* Closing stub */}
          <div className="flex-1 rounded border-2 border-dashed border-gray-400 p-6">
            <p className="mb-4 text-center font-bold">ЗАКРЫТИЕ СМЕНЫ</p>
            {shift.closingCash !== null ? (
              <>
                <p>Наличные: {formatMoney(Number(shift.closingCash))}</p>
                <p>Ожидалось: {formatMoney(Number(shift.expectedCash))}</p>
                <p>
                  Расхождение:{" "}
                  {shift.discrepancy !== null
                    ? formatMoney(Number(shift.discrepancy))
                    : "—"}
                </p>
              </>
            ) : (
              <p className="text-gray-500">—</p>
            )}
            <div className="mt-8 border-t border-gray-300 pt-2 text-center text-xs text-gray-500">
              (место для чека)
            </div>
            <div className="h-40" />
          </div>
        </div>
      </div>
    </PrintLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/print/shift/
git commit -m "feat(shifts): add shift A4 print page with receipt stubs"
```

---

### Task 18: Sidebar & Navigation Links

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: Settings page (wherever settings links are listed — check `src/app/(dashboard)/settings/page.tsx` or its layout)
- Modify: Reports page (`src/app/(dashboard)/reports/reports-page-client.tsx`)

**Context:** Add "Смены" to main sidebar. Add "Фонды" link inside the settings page. Add "Фонды" tab inside the reports page.

- [ ] **Step 1: Add Смены nav item to sidebar**

Import `Clock` from lucide-react (add to the existing import).

Add to `navItems` array after the "Трейд-ин" entry:

```typescript
  {
    title: "Смены",
    href: "/shifts",
    icon: Clock,
    requiredPermissions: ["shifts.view"],
  },
```

- [ ] **Step 2: Add Фонды link in settings page**

Find the settings page that lists setting sections (likely `src/app/(dashboard)/settings/page.tsx` or a layout). Add a link card/item for "Фонды" pointing to `/settings/funds` with `funds.manage` permission.

- [ ] **Step 3: Add Фонды tab in reports page**

In `src/app/(dashboard)/reports/reports-page-client.tsx`, add a new tab for "Фонды" that links to `/reports/funds` or embeds the fund report component. The reports page server component should also pass a `canViewFunds` prop based on `shifts.view_all` permission.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/app/\(dashboard\)/settings/ src/app/\(dashboard\)/reports/
git commit -m "feat(shifts): add shifts to sidebar, funds to settings and reports navigation"
```

---

### Task 19: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd astore-erp && npx next build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Fix any build errors**

Common issues to check:
- `asChild` → must be `render` prop on AlertDialogTrigger, DialogTrigger
- Select `onValueChange` → must handle `(val: string | null)` signature
- Missing imports
- Type mismatches on Decimal fields

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A && git commit -m "fix(shifts): resolve build errors"
```

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Schema, permissions, validations |
| 2 | 4-7b | Server actions (funds, shifts, cash ops, integrations, payroll) |
| 3 | 8-12 | POS integration (banner + 3 dialogs) |
| 4 | 13-14 | Shift list & detail pages |
| 5 | 15-19 | Settings, reports, print, sidebar/navigation, build |
