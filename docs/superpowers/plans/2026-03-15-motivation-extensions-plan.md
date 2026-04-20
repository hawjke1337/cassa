# Motivation Module Extensions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add approval flow UI with diff/simulation, dedicated payroll page, and PDF export to the motivation module.

**Architecture:** Three independent features building on existing backend. Approval flow adds new pages under `/motivation/approvals` with formula comparison and earnings simulation. Payroll page moves existing UI to `/motivation/payrolls` with detail expansion. PDF export uses `@react-pdf/renderer` to generate downloadable payroll breakdowns.

**Tech Stack:** Next.js 14+ App Router, Prisma, shadcn/ui, @react-pdf/renderer, Zod, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-motivation-extensions-design.md`

---

## Chunk 1: Backend Foundation (Tasks 1-4)

### Task 1: Add `rejectionReason` to MotivationScheme

**Files:**
- Modify: `prisma/schema.prisma` (MotivationScheme model, ~line 672)

- [ ] **Step 1: Add field to schema**

In `prisma/schema.prisma`, add `rejectionReason` to the `MotivationScheme` model, after `status`:

```prisma
  rejectionReason String?
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd astore-erp
npx prisma migrate dev --name add-scheme-rejection-reason
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(motivation): add rejectionReason field to MotivationScheme"
```

---

### Task 2: Update `rejectMotivationScheme` to accept optional reason

**Files:**
- Modify: `src/actions/motivation-schemes.ts` (~lines 181-192)

- [ ] **Step 1: Update function signature and implementation**

Current code (lines 181-192):
```typescript
export async function rejectMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({ where: { id } })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.motivationScheme.update({
    where: { id },
    data: { status: "ARCHIVED" },
  })
}
```

Replace with:
```typescript
export async function rejectMotivationScheme(id: string, reason?: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({ where: { id } })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.motivationScheme.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      rejectionReason: reason || null,
    },
  })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/motivation-schemes.ts
git commit -m "feat(motivation): add optional rejection reason to rejectMotivationScheme"
```

---

### Task 3: Extract `calculateEarningsWithFormula` from `calculateEarnings`

This is the critical refactoring for simulation support. The existing `calculateEarnings` fetches the assignment internally. We need a variant that accepts the formula as a parameter.

**Files:**
- Modify: `src/actions/motivation-calculation.ts`

- [ ] **Step 1: Create `calculateEarningsWithFormula` function**

Add a new exported function that contains the core calculation logic. The existing `calculateEarnings` will call this after fetching the assignment.

Insert before the existing `calculateEarnings` function (before line 118):

```typescript
export async function calculateEarningsWithFormula(
  userId: string,
  storeId: string,
  periodStart: Date,
  periodEnd: Date,
  shiftsCount: number,
  formula: MotivationFormula,
): Promise<EarningsResult> {
  // This contains the core calculation logic extracted from calculateEarnings
  // Everything from line 140 to line 386 of the original function
  // (the part after assignment lookup and formula extraction)
```

The function body is everything currently inside `calculateEarnings` starting from the `sales` query (line 140) through the return statement (line 386), using the `formula` parameter instead of `assignment.scheme.formula`.

- [ ] **Step 2: Refactor `calculateEarnings` to delegate**

Replace the body of `calculateEarnings` (lines 118-387) with:

```typescript
export async function calculateEarnings(
  userId: string,
  storeId: string,
  periodStart: Date,
  periodEnd: Date,
  shiftsCount: number,
): Promise<EarningsResult | null> {
  const assignment = await db.motivationAssignment.findFirst({
    where: {
      userId,
      storeId,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      scheme: { status: "ACTIVE" },
    },
    include: { scheme: true },
  })

  if (!assignment) return null

  const formula = assignment.scheme.formula as unknown as MotivationFormula

  return calculateEarningsWithFormula(userId, storeId, periodStart, periodEnd, shiftsCount, formula)
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Quick smoke test: open the motivation dashboard in browser, verify earnings still load correctly.

- [ ] **Step 5: Commit**

```bash
git add src/actions/motivation-calculation.ts
git commit -m "refactor(motivation): extract calculateEarningsWithFormula for simulation support"
```

---

### Task 4: Create `simulateSchemeComparison` server action

**Files:**
- Create: `src/actions/motivation-simulation.ts`

- [ ] **Step 1: Create the simulation action**

```typescript
"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { calculateEarningsWithFormula } from "@/actions/motivation-calculation"
import type { MotivationFormula } from "@/lib/validations/motivation"

interface SimulationRow {
  userId: string
  userName: string
  storeId: string
  storeName: string
  shiftsCount: number
  oldTotal: number
  newTotal: number
  diff: number
  diffPercent: number
}

export async function simulateSchemeComparison(
  schemeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SimulationRow[]> {
  await requirePermission("motivation.schemes.approve")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  // Fetch pending scheme with parent
  const scheme = await db.motivationScheme.findUnique({
    where: { id: schemeId },
    include: {
      parentScheme: true,
    },
  })

  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")
  if (!scheme.parentSchemeId || !scheme.parentScheme) return []

  const newFormula = scheme.formula as unknown as MotivationFormula
  const oldFormula = scheme.parentScheme.formula as unknown as MotivationFormula

  // Find employees assigned to the parent scheme
  const assignments = await db.motivationAssignment.findMany({
    where: {
      schemeId: scheme.parentSchemeId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      store: { select: { id: true, name: true } },
    },
  })

  if (assignments.length === 0) return []

  // Get shifts counts from existing payrolls
  const payrolls = await db.payroll.findMany({
    where: {
      userId: { in: assignments.map((a) => a.userId) },
      storeId: { in: assignments.map((a) => a.storeId) },
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
    select: { userId: true, storeId: true, shiftsCount: true },
  })
  const shiftsMap = new Map(payrolls.map((p) => [`${p.userId}-${p.storeId}`, p.shiftsCount]))

  // Calculate earnings with both formulas for each employee
  const results = await Promise.all(
    assignments.map(async (assignment) => {
      const shiftsCount = shiftsMap.get(`${assignment.userId}-${assignment.storeId}`) ?? 0

      const [oldEarnings, newEarnings] = await Promise.all([
        calculateEarningsWithFormula(
          assignment.userId,
          assignment.storeId,
          start,
          end,
          shiftsCount,
          oldFormula,
        ),
        calculateEarningsWithFormula(
          assignment.userId,
          assignment.storeId,
          start,
          end,
          shiftsCount,
          newFormula,
        ),
      ])

      const oldTotal = oldEarnings.totals.total
      const newTotal = newEarnings.totals.total
      const diff = newTotal - oldTotal
      const diffPercent = oldTotal !== 0 ? (diff / oldTotal) * 100 : 0

      return {
        userId: assignment.user.id,
        userName: `${assignment.user.firstName} ${assignment.user.lastName}`,
        storeId: assignment.store.id,
        storeName: assignment.store.name,
        shiftsCount,
        oldTotal,
        newTotal,
        diff,
        diffPercent,
      }
    }),
  )

  return results
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/motivation-simulation.ts
git commit -m "feat(motivation): add simulateSchemeComparison action for approval flow"
```

---

### Task 5: Fix permission access and add missing return fields

Several existing server actions need modifications for the approval and payroll flows.

**Files:**
- Modify: `src/actions/motivation-schemes.ts`
- Modify: `src/actions/motivation-payroll.ts`

- [ ] **Step 1: Add `getPendingSchemes` action for approval flow**

The existing `getMotivationSchemes` requires `motivation.schemes.manage` permission, but the approval pages are gated on `motivation.schemes.approve`. Add a new action in `src/actions/motivation-schemes.ts`:

```typescript
export async function getPendingSchemes() {
  await requirePermission("motivation.schemes.approve")

  const schemes = await db.motivationScheme.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return schemes.map((s) => ({
    id: s.id,
    name: s.name,
    storeName: s.store?.name ?? null,
    createdByName: `${s.createdBy.firstName} ${s.createdBy.lastName}`,
    createdAt: s.createdAt.toISOString(),
  }))
}
```

- [ ] **Step 2: Add `getPendingSchemeDetail` action for approval detail page**

The existing `getMotivationScheme` requires `motivation.schemes.manage`. Add a new action that requires `motivation.schemes.approve` and includes the parent formula:

```typescript
export async function getPendingSchemeDetail(id: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      parentScheme: { select: { formula: true } },
    },
  })

  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  return {
    id: scheme.id,
    name: scheme.name,
    status: scheme.status,
    storeName: scheme.store?.name ?? null,
    createdByName: `${scheme.createdBy.firstName} ${scheme.createdBy.lastName}`,
    formula: scheme.formula,
    parentFormula: scheme.parentScheme?.formula ?? null,
    parentSchemeId: scheme.parentSchemeId,
  }
}
```

- [ ] **Step 3: Update `getPayrolls` to include `breakdown` field**

In `src/actions/motivation-payroll.ts`, find the `getPayrolls` function. In its Prisma query's `select` (or `include`), add `breakdown: true`. In the return mapping, add `breakdown: p.breakdown` to each mapped record.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/actions/motivation-schemes.ts src/actions/motivation-payroll.ts
git commit -m "feat(motivation): add approval-specific actions and include breakdown in payrolls"
```

---

## Chunk 2: Approval Flow UI (Tasks 6-9)

### Task 6: Add pending count badge to sidebar (was Task 5)

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Fetch pending count in layout**

In `src/app/(dashboard)/layout.tsx`, import and call `getPendingSchemeCount`:

Add import:
```typescript
import { getPendingSchemeCount } from "@/actions/motivation-schemes"
```

After the user object is built (after `const user = { ... }`), add:
```typescript
const pendingSchemeCount = await getPendingSchemeCount()
```

Pass to AppSidebar:
```tsx
<AppSidebar user={user} stores={stores} pendingSchemeCount={pendingSchemeCount} />
```

- [ ] **Step 2: Update AppSidebar to accept and display badge**

In `src/components/layout/app-sidebar.tsx`:

Update the `AppSidebarProps` interface to add:
```typescript
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: { ... }
  stores: StoreItem[]
  pendingSchemeCount?: number
}
```

Update the component destructuring:
```typescript
export function AppSidebar({ user, stores, pendingSchemeCount = 0, ...props }: AppSidebarProps) {
```

Find the "Мотивация" nav item in the items array. It currently looks like:
```typescript
{
  title: "Мотивация",
  href: "/motivation",
  icon: Award,
  requiredPermissions: ["motivation.payroll.view", "motivation.payroll.own"],
}
```

Add a `badge` field:
```typescript
{
  title: "Мотивация",
  href: "/motivation",
  icon: Award,
  requiredPermissions: ["motivation.payroll.view", "motivation.payroll.own"],
  badge: pendingSchemeCount > 0 ? pendingSchemeCount : undefined,
}
```

Update the `NavItem` type to include optional `badge`:
```typescript
interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredPermissions?: string[]
  badge?: number
}
```

In the nav item render (the `.map()` block), after the title text, add badge rendering:
```tsx
<item.icon className="size-4" />
<span>{item.title}</span>
{item.badge && (
  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
    {item.badge}
  </span>
)}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/components/layout/app-sidebar.tsx
git commit -m "feat(motivation): add pending scheme count badge to sidebar"
```

---

### Task 7: Create approvals list page

**Files:**
- Create: `src/app/(dashboard)/motivation/approvals/page.tsx`
- Create: `src/app/(dashboard)/motivation/approvals/approvals-client.tsx`

- [ ] **Step 1: Create server component page**

```typescript
// src/app/(dashboard)/motivation/approvals/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ApprovalsClient } from "./approvals-client"

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.schemes.approve")) redirect("/motivation")

  return <ApprovalsClient />
}
```

- [ ] **Step 2: Create client component**

```typescript
// src/app/(dashboard)/motivation/approvals/approvals-client.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPendingSchemes } from "@/actions/motivation-schemes"

interface PendingScheme {
  id: string
  name: string
  storeName: string | null
  createdByName: string
  createdAt: string
}

export function ApprovalsClient() {
  const router = useRouter()
  const [schemes, setSchemes] = useState<PendingScheme[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const pending = await getPendingSchemes()
        setSchemes(pending.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt).toLocaleDateString("ru-RU"),
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  if (schemes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Подтверждение схем</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <Clock className="mx-auto size-8 mb-2 opacity-50" />
          <p>Нет схем, ожидающих подтверждения</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Подтверждение схем</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schemes.map((scheme) => (
          <Card
            key={scheme.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/motivation/approvals/${scheme.id}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{scheme.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Магазин: {scheme.storeName ?? "Общая"}</p>
              <p>Автор: {scheme.createdByName}</p>
              <p>Создана: {scheme.createdAt}</p>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  Просмотреть <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/motivation/approvals/
git commit -m "feat(motivation): add approvals list page"
```

---

### Task 8: Create formula diff component

**Files:**
- Create: `src/components/motivation/formula-diff.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/motivation/formula-diff.tsx
"use client"

import type { MotivationFormula } from "@/lib/validations/motivation"
import {
  COMMISSION_BASIS_LABELS,
  COMMISSION_TYPE_LABELS,
} from "@/lib/validations/motivation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FormulaDiffProps {
  oldFormula: MotivationFormula | null
  newFormula: MotivationFormula
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatRate(rate: number, type?: string) {
  if (type === "FIXED") return formatMoney(rate) + "/шт"
  return (rate * 100).toFixed(1) + "%"
}

function DiffCell({
  oldVal,
  newVal,
  format = (v) => String(v),
}: {
  oldVal?: string | number | null
  newVal: string | number
  format?: (v: string | number) => string
}) {
  const changed = oldVal != null && oldVal !== newVal
  return (
    <div className="flex gap-3">
      {oldVal != null && (
        <span className={changed ? "line-through text-muted-foreground" : ""}>
          {format(oldVal)}
        </span>
      )}
      {changed && (
        <span className="font-medium text-green-700 dark:text-green-400">
          {format(newVal)}
        </span>
      )}
      {!changed && oldVal == null && (
        <span>{format(newVal)}</span>
      )}
    </div>
  )
}

export function FormulaDiff({ oldFormula, newFormula }: FormulaDiffProps) {
  return (
    <div className="space-y-6">
      {/* Daily Rate */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Ставка за смену</h4>
        <DiffCell
          oldVal={oldFormula?.dailyRate}
          newVal={newFormula.dailyRate}
          format={(v) => formatMoney(Number(v))}
        />
      </div>

      {/* Repair Bonus */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Бонус за ремонт</h4>
        <DiffCell
          oldVal={oldFormula?.repairBonus}
          newVal={newFormula.repairBonus}
          format={(v) => formatMoney(Number(v))}
        />
      </div>

      {/* Default Commission */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Комиссия по умолчанию</h4>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Тип: </span>
            <DiffCell
              oldVal={oldFormula?.defaultCommission.type ?? "PERCENT"}
              newVal={newFormula.defaultCommission.type ?? "PERCENT"}
              format={(v) => COMMISSION_TYPE_LABELS[v as "PERCENT" | "FIXED"]}
            />
          </div>
          <div>
            <span className="text-muted-foreground">Ставка: </span>
            <DiffCell
              oldVal={oldFormula?.defaultCommission.rate}
              newVal={newFormula.defaultCommission.rate}
              format={(v) => formatRate(Number(v), newFormula.defaultCommission.type)}
            />
          </div>
          {(newFormula.defaultCommission.type ?? "PERCENT") !== "FIXED" && (
            <div>
              <span className="text-muted-foreground">База: </span>
              <DiffCell
                oldVal={oldFormula?.defaultCommission.basis}
                newVal={newFormula.defaultCommission.basis}
                format={(v) => COMMISSION_BASIS_LABELS[v as "PROFIT" | "RETAIL_PRICE"]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Commission Rules */}
      <div className="rounded-md border">
        <div className="p-4 pb-2">
          <h4 className="text-sm font-medium">Правила комиссий по группам</h4>
        </div>
        {newFormula.commissionRules.length === 0 && (!oldFormula || oldFormula.commissionRules.length === 0) ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Нет правил по группам</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Группа</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Ставка</TableHead>
                <TableHead>База</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newFormula.commissionRules.map((rule, i) => {
                const oldRule = oldFormula?.commissionRules.find(
                  (r) => r.groupId === rule.groupId,
                )
                return (
                  <TableRow key={rule.groupId ?? i}>
                    <TableCell className="text-sm">{rule.groupId ?? "—"}</TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldRule?.type ?? "PERCENT"}
                        newVal={rule.type ?? "PERCENT"}
                        format={(v) => COMMISSION_TYPE_LABELS[v as "PERCENT" | "FIXED"]}
                      />
                    </TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldRule?.rate}
                        newVal={rule.rate}
                        format={(v) => formatRate(Number(v), rule.type)}
                      />
                    </TableCell>
                    <TableCell>
                      {(rule.type ?? "PERCENT") === "FIXED" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <DiffCell
                          oldVal={oldRule?.basis}
                          newVal={rule.basis}
                          format={(v) => COMMISSION_BASIS_LABELS[v as "PROFIT" | "RETAIL_PRICE"]}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Cross-Sell Bonuses */}
      <div className="rounded-md border">
        <div className="p-4 pb-2">
          <h4 className="text-sm font-medium">Кросс-продажи</h4>
        </div>
        {newFormula.crossSellBonuses.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Нет бонусов за кросс-продажи</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Мин. позиций</TableHead>
                <TableHead>Бонус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newFormula.crossSellBonuses.map((bonus, i) => {
                const oldBonus = oldFormula?.crossSellBonuses.find(
                  (b) => b.minItems === bonus.minItems,
                )
                return (
                  <TableRow key={i}>
                    <TableCell>{bonus.minItems}</TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldBonus?.bonus}
                        newVal={bonus.bonus}
                        format={(v) => formatMoney(Number(v))}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/motivation/formula-diff.tsx
git commit -m "feat(motivation): add FormulaDiff component for side-by-side formula comparison"
```

---

### Task 9: Create approval detail page with simulation

**Files:**
- Create: `src/app/(dashboard)/motivation/approvals/[id]/page.tsx`
- Create: `src/app/(dashboard)/motivation/approvals/[id]/approval-detail-client.tsx`

- [ ] **Step 1: Create server component**

```typescript
// src/app/(dashboard)/motivation/approvals/[id]/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ApprovalDetailClient } from "./approval-detail-client"

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.schemes.approve")) redirect("/motivation")

  const { id } = await params

  return <ApprovalDetailClient schemeId={id} />
}
```

Note: Validation that the scheme exists and is PENDING_APPROVAL is handled by `getPendingSchemeDetail` in the client component — it throws if the scheme is not found or not pending.

- [ ] **Step 2: Create client component**

```typescript
// src/app/(dashboard)/motivation/approvals/[id]/approval-detail-client.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPendingSchemeDetail, approveMotivationScheme, rejectMotivationScheme } from "@/actions/motivation-schemes"
import { simulateSchemeComparison } from "@/actions/motivation-simulation"
import { FormulaDiff } from "@/components/motivation/formula-diff"
import type { MotivationFormula } from "@/lib/validations/motivation"

interface SchemeData {
  id: string
  name: string
  storeName: string | null
  createdByName: string
  formula: MotivationFormula
  parentFormula: MotivationFormula | null
}

interface SimulationRow {
  userId: string
  userName: string
  storeId: string
  storeName: string
  shiftsCount: number
  oldTotal: number
  newTotal: number
  diff: number
  diffPercent: number
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function monthStart(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toISOString().slice(0, 10)
}

function monthEnd(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + 1 + offset, 0)
  return d.toISOString().slice(0, 10)
}

export function ApprovalDetailClient({ schemeId }: { schemeId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scheme, setScheme] = useState<SchemeData | null>(null)
  const [simulation, setSimulation] = useState<SimulationRow[]>([])
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [periodOffset, setPeriodOffset] = useState(0) // 0 = current month, -1 = last month
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    async function load() {
      const data = await getPendingSchemeDetail(schemeId)
      setScheme({
        id: data.id,
        name: data.name,
        storeName: data.storeName ?? null,
        createdByName: data.createdByName,
        formula: data.formula as unknown as MotivationFormula,
        parentFormula: data.parentFormula
          ? (data.parentFormula as unknown as MotivationFormula)
          : null,
      })
    }
    load()
  }, [schemeId])

  useEffect(() => {
    if (!scheme?.parentFormula) return
    async function loadSimulation() {
      setSimulationLoading(true)
      try {
        const rows = await simulateSchemeComparison(
          schemeId,
          monthStart(periodOffset),
          monthEnd(periodOffset),
        )
        setSimulation(rows)
      } finally {
        setSimulationLoading(false)
      }
    }
    loadSimulation()
  }, [schemeId, scheme?.parentFormula, periodOffset])

  function handleApprove() {
    startTransition(async () => {
      await approveMotivationScheme(schemeId)
      router.push("/motivation/approvals")
    })
  }

  function handleReject() {
    startTransition(async () => {
      await rejectMotivationScheme(schemeId, rejectReason || undefined)
      setRejectDialogOpen(false)
      router.push("/motivation/approvals")
    })
  }

  if (!scheme) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  const totalOld = simulation.reduce((s, r) => s + r.oldTotal, 0)
  const totalNew = simulation.reduce((s, r) => s + r.newTotal, 0)
  const totalDiff = totalNew - totalOld

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{scheme.name}</h1>
          <p className="text-sm text-muted-foreground">
            Автор: {scheme.createdByName} · Магазин: {scheme.storeName ?? "Общая"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApprove} disabled={isPending}>
            <Check className="mr-2 size-4" />
            Подтвердить
          </Button>
          <Button
            variant="destructive"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isPending}
          >
            <X className="mr-2 size-4" />
            Отклонить
          </Button>
        </div>
      </div>

      {/* Formula Diff */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {scheme.parentFormula ? "Изменения формулы" : "Формула"}
        </h2>
        <FormulaDiff
          oldFormula={scheme.parentFormula}
          newFormula={scheme.formula}
        />
      </div>

      {/* Simulation */}
      {scheme.parentFormula && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Симуляция расчёта</h2>
            <div className="flex gap-2">
              <Button
                variant={periodOffset === 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPeriodOffset(0)}
              >
                Текущий месяц
              </Button>
              <Button
                variant={periodOffset === -1 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPeriodOffset(-1)}
              >
                Прошлый месяц
              </Button>
            </div>
          </div>

          {simulationLoading ? (
            <div className="text-sm text-muted-foreground">Расчёт...</div>
          ) : simulation.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              Нет сотрудников для сравнения
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Магазин</TableHead>
                    <TableHead className="text-right">Смены</TableHead>
                    <TableHead className="text-right">По старой</TableHead>
                    <TableHead className="text-right">По новой</TableHead>
                    <TableHead className="text-right">Разница</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulation.map((row) => (
                    <TableRow key={`${row.userId}-${row.storeId}`}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell>{row.storeName}</TableCell>
                      <TableCell className="text-right">{row.shiftsCount}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.oldTotal)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.newTotal)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.diff >= 0 ? "+" : ""}{formatMoney(row.diff)}
                      </TableCell>
                      <TableCell className={`text-right ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.diff >= 0 ? "+" : ""}{row.diffPercent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Summary row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Итого</TableCell>
                    <TableCell className="text-right">{formatMoney(totalOld)}</TableCell>
                    <TableCell className="text-right">{formatMoney(totalNew)}</TableCell>
                    <TableCell className={`text-right ${totalDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {totalDiff >= 0 ? "+" : ""}{formatMoney(totalDiff)}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalOld !== 0 ? `${((totalDiff / totalOld) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить схему</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Укажите причину отклонения (необязательно):
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verify in browser**

Start dev server, navigate to `/motivation/approvals`. If there are no pending schemes, you should see the empty state. If your seed data or manual testing created pending schemes, you should see the list.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/motivation/approvals/
git commit -m "feat(motivation): add approval detail page with formula diff and simulation"
```

---

## Chunk 3: Payroll Page (Tasks 10-11)

### Task 10: Create dedicated payrolls page

**Files:**
- Create: `src/app/(dashboard)/motivation/payrolls/page.tsx`
- Create: `src/app/(dashboard)/motivation/payrolls/payrolls-client.tsx`

- [ ] **Step 1: Create server component**

```typescript
// src/app/(dashboard)/motivation/payrolls/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PayrollsClient } from "./payrolls-client"

export default async function PayrollsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.payroll.view")) redirect("/motivation")

  return <PayrollsClient />
}
```

- [ ] **Step 2: Create client component**

This is the largest component. It reuses patterns from `motivation-dashboard-client.tsx` but focuses solely on payroll management.

```typescript
// src/app/(dashboard)/motivation/payrolls/payrolls-client.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { ChevronDown, ChevronRight, FileDown, Trash2, Check, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  getPayrolls,
  confirmPayroll,
  markPayrollPaid,
  deletePayroll,
} from "@/actions/motivation-payroll"
import { getStores } from "@/actions/stores"
import { EarningsBreakdown } from "@/components/motivation/earnings-breakdown"
import type { EarningsResultForBreakdown } from "@/components/motivation/earnings-breakdown"

type Store = { id: string; name: string }

type PayrollRow = {
  id: string
  userName: string
  userId: string
  periodStart: string
  periodEnd: string
  shiftsCount: number
  dailyTotal: number
  commissions: number
  crossBonuses: number
  repairBonuses: number
  returns: number
  totalAmount: number
  isAdvance: boolean
  status: "DRAFT" | "CONFIRMED" | "PAID"
  breakdown: EarningsResultForBreakdown | null
  createdAt: string
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU")
}

function monthStartStr() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  CONFIRMED: "Подтверждён",
  PAID: "Выплачен",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
}

export function PayrollsClient() {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadStores() {
      const s = await getStores()
      setStores(s)
      if (s.length > 0 && !selectedStoreId) setSelectedStoreId(s[0].id)
    }
    loadStores()
  }, [])

  useEffect(() => {
    if (!selectedStoreId) return
    loadPayrolls()
  }, [selectedStoreId, dateFrom, dateTo])

  async function loadPayrolls() {
    const data = await getPayrolls(selectedStoreId, dateFrom, dateTo)
    setPayrolls(data as PayrollRow[])
  }

  const filteredPayrolls = payrolls.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false
    if (employeeFilter && !p.userName.toLowerCase().includes(employeeFilter.toLowerCase())) return false
    return true
  })

  function handleConfirm(id: string) {
    startTransition(async () => {
      await confirmPayroll(id)
      await loadPayrolls()
    })
  }

  function handlePay(id: string) {
    startTransition(async () => {
      await markPayrollPaid(id)
      await loadPayrolls()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePayroll(id)
      await loadPayrolls()
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Расчётные листы</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Магазин</label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Магазин" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">С</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">По</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Статус</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все</SelectItem>
              <SelectItem value="DRAFT">Черновик</SelectItem>
              <SelectItem value="CONFIRMED">Подтверждён</SelectItem>
              <SelectItem value="PAID">Выплачен</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Сотрудник</label>
          <Input
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            placeholder="Поиск..."
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Смены</TableHead>
              <TableHead className="text-right">Итого</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-32">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                  Нет расчётных листов
                </TableCell>
              </TableRow>
            ) : (
              filteredPayrolls.map((p) => (
                <>
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <TableCell>
                      {expandedId === p.id ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.userName}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                    </TableCell>
                    <TableCell>{p.isAdvance ? "Аванс" : "Расчёт"}</TableCell>
                    <TableCell className="text-right">{p.shiftsCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.totalAmount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {p.status === "DRAFT" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleConfirm(p.id)}
                              disabled={isPending}
                              title="Подтвердить"
                            >
                              <Check className="size-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon-sm" title="Удалить">
                                  <Trash2 className="size-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить расчётный лист?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Черновик будет удалён безвозвратно.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(p.id)}>
                                    Удалить
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {p.status === "CONFIRMED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handlePay(p.id)}
                            disabled={isPending}
                            title="Выплатить"
                          >
                            <DollarSign className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === p.id && p.breakdown && (
                    <TableRow key={`${p.id}-detail`}>
                      <TableCell colSpan={8} className="bg-muted/20 p-4">
                        <EarningsBreakdown earnings={p.breakdown} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/motivation/payrolls/
git commit -m "feat(motivation): add dedicated payrolls page with expandable details"
```

---

### Task 11: Simplify motivation dashboard

**Files:**
- Modify: `src/app/(dashboard)/motivation/motivation-dashboard-client.tsx`

- [ ] **Step 1: Remove payroll table and add link**

In `motivation-dashboard-client.tsx`:

1. Remove the payroll history table section (the entire block that renders payroll rows with confirm/pay/delete buttons)
2. Remove the `payrolls` state and `loadPayrolls` function
3. Remove imports no longer needed (related to payroll row rendering)
4. Add a link card after the earnings table:

```tsx
import Link from "next/link"
import { ArrowRight } from "lucide-react"

// ... in the JSX, after the earnings table section:
<Link
  href="/motivation/payrolls"
  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
>
  <span className="font-medium">Расчётные листы</span>
  <ArrowRight className="size-4 text-muted-foreground" />
</Link>
```

Keep the earnings table and the calculate advance/settlement dialog — those stay on the dashboard.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/motivation/motivation-dashboard-client.tsx
git commit -m "refactor(motivation): move payroll table to dedicated page, add link"
```

---

## Chunk 4: PDF Export (Tasks 12-14)

### Task 12: Add `getPayrollPdfData` server action

**Files:**
- Modify: `src/actions/motivation-payroll.ts`

- [ ] **Step 1: Add the action**

Add to `src/actions/motivation-payroll.ts`:

```typescript
export async function getPayrollPdfData(payrollId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const permissions = session.user.permissions ?? []
  const canViewAll = permissions.includes("motivation.payroll.view")
  const canViewOwn = permissions.includes("motivation.payroll.own")

  if (!canViewAll && !canViewOwn) throw new Error("Нет доступа")

  const payroll = await db.payroll.findUnique({
    where: { id: payrollId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      store: { select: { name: true } },
    },
  })

  if (!payroll) throw new Error("Расчётный лист не найден")

  // If user can only view own, verify ownership
  if (!canViewAll && payroll.userId !== session.user.id) {
    throw new Error("Нет доступа")
  }

  // Find advance amount for settlement payrolls
  let advanceAmount: number | undefined
  if (!payroll.isAdvance) {
    const advance = await db.payroll.findFirst({
      where: {
        userId: payroll.userId,
        storeId: payroll.storeId,
        isAdvance: true,
        status: { in: ["CONFIRMED", "PAID"] },
        periodStart: { gte: payroll.periodStart },
        periodEnd: { lte: payroll.periodEnd },
      },
      select: { totalAmount: true },
    })
    if (advance) {
      advanceAmount = Number(advance.totalAmount)
    }
  }

  return {
    userName: `${payroll.user.firstName} ${payroll.user.lastName}`,
    storeName: payroll.store.name,
    periodStart: payroll.periodStart.toISOString(),
    periodEnd: payroll.periodEnd.toISOString(),
    isAdvance: payroll.isAdvance,
    totalAmount: Number(payroll.totalAmount),
    breakdown: payroll.breakdown,
    advanceAmount,
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/motivation-payroll.ts
git commit -m "feat(motivation): add getPayrollPdfData action with dual permission check"
```

---

### Task 13: Create PDF document component

**Files:**
- Create: `src/components/motivation/payroll-pdf-document.tsx`

- [ ] **Step 1: Check existing PDF patterns for font registration**

Look at existing PDF components in the project to understand font registration pattern:

```bash
grep -r "Font.register" src/ --include="*.tsx" --include="*.ts" -l
```

Use the same font and registration approach.

- [ ] **Step 2: Create the PDF component**

```typescript
// src/components/motivation/payroll-pdf-document.tsx
"use client"

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"

// Register font — use the same font as other PDF components in the project
// (implementer: check grep results from Step 1 and use the same Font.register call)

interface PdfSaleItem {
  productName: string
  groupCode: string | null
  type: "PERCENT" | "FIXED"
  rate: number
  basis: "PROFIT" | "RETAIL_PRICE"
  commission: number
  sellPrice: number
  costPrice: number
}

interface PdfSaleCommission {
  saleNumber: string
  date: string
  items: PdfSaleItem[]
  totalCommission: number
}

interface PdfCrossSellBonus {
  saleNumber: string
  itemCount: number
  bonus: number
}

interface PdfRepairBonus {
  repairNumber: string
  date: string
  bonus: number
}

interface PdfReturnDeduction {
  saleNumber: string
  productName: string
  commission: number
}

interface PdfBreakdown {
  dailyRate: { shiftsCount: number; ratePerShift: number; total: number }
  commissions: PdfSaleCommission[]
  crossSellBonuses: PdfCrossSellBonus[]
  repairBonuses: PdfRepairBonus[]
  returnDeductions: PdfReturnDeduction[]
  totals: {
    daily: number
    commissions: number
    crossBonuses: number
    repairBonuses: number
    returns: number
    total: number
  }
}

interface PayrollPdfDocumentProps {
  userName: string
  storeName: string
  periodStart: string
  periodEnd: string
  isAdvance: boolean
  breakdown: PdfBreakdown
  advanceAmount?: number
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(n) + " ₽"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU")
}

function formatRate(rate: number, type: string): string {
  if (type === "FIXED") return formatMoney(rate) + "/шт"
  return (rate * 100).toFixed(1) + "%"
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Roboto", fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  meta: { fontSize: 9, color: "#666", marginBottom: 2 },
  section: { marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", padding: 8, backgroundColor: "#f9fafb" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  label: { color: "#374151" },
  value: { fontWeight: "bold" },
  valueNeg: { fontWeight: "bold", color: "#dc2626" },
  totalSection: { marginTop: 16, padding: 12, backgroundColor: "#f3f4f6", borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 13, fontWeight: "bold" },
  totalValue: { fontSize: 13, fontWeight: "bold" },
  subItem: { paddingLeft: 16, paddingVertical: 2 },
  subText: { fontSize: 8, color: "#6b7280" },
})

export function PayrollPdfDocument({
  userName,
  storeName,
  periodStart,
  periodEnd,
  isAdvance,
  breakdown,
  advanceAmount,
}: PayrollPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>a:store — Расчётный лист</Text>
          <Text style={styles.meta}>Магазин: {storeName}</Text>
          <Text style={styles.meta}>Период: {formatDate(periodStart)} — {formatDate(periodEnd)}</Text>
          <Text style={styles.meta}>Сотрудник: {userName}</Text>
          <Text style={styles.meta}>Тип: {isAdvance ? "Аванс" : "Расчёт"}</Text>
        </View>

        {/* Daily Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ставка</Text>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.label}>
              {breakdown.dailyRate.shiftsCount} смен × {formatMoney(breakdown.dailyRate.ratePerShift)}
            </Text>
            <Text style={styles.value}>{formatMoney(breakdown.dailyRate.total)}</Text>
          </View>
        </View>

        {/* Commissions */}
        {breakdown.commissions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Комиссии с продаж</Text>
            {breakdown.commissions.map((sale, i) => (
              <View key={i}>
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.label}>
                    Продажа №{sale.saleNumber} — {formatDate(sale.date)}
                  </Text>
                  <Text style={styles.value}>{formatMoney(sale.totalCommission)}</Text>
                </View>
                {sale.items.map((item, j) => (
                  <View key={j} style={styles.subItem}>
                    <Text style={styles.subText}>
                      {item.productName}
                      {item.groupCode ? ` [${item.groupCode}]` : ""}
                      {" — "}
                      {item.type === "FIXED"
                        ? `${formatMoney(item.rate)}/шт`
                        : `${(item.rate * 100).toFixed(1)}% ${item.basis === "PROFIT" ? "от прибыли" : "от цены"}`}
                      {" = "}
                      {formatMoney(item.commission)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Cross-sell */}
        {breakdown.crossSellBonuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Кросс-продажи</Text>
            {breakdown.crossSellBonuses.map((cb, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  Продажа №{cb.saleNumber} — {cb.itemCount} позиций
                </Text>
                <Text style={styles.value}>{formatMoney(cb.bonus)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Repairs */}
        {breakdown.repairBonuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ремонты</Text>
            {breakdown.repairBonuses.map((rb, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  Ремонт №{rb.repairNumber} — {formatDate(rb.date)}
                </Text>
                <Text style={styles.value}>{formatMoney(rb.bonus)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Returns */}
        {breakdown.returnDeductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Возвраты (удержания)</Text>
            {breakdown.returnDeductions.map((rd, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  {rd.productName} — по чеку №{rd.saleNumber}
                </Text>
                <Text style={styles.valueNeg}>{formatMoney(rd.commission)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Итого к начислению</Text>
            <Text style={styles.totalValue}>{formatMoney(breakdown.totals.total)}</Text>
          </View>
          {!isAdvance && advanceAmount != null && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.label}>Аванс выплачен</Text>
                <Text style={styles.value}>{formatMoney(advanceAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>К выплате</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(breakdown.totals.total - advanceAmount)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/motivation/payroll-pdf-document.tsx
git commit -m "feat(motivation): add PayrollPdfDocument component for PDF export"
```

---

### Task 14: Add PDF download buttons

**Files:**
- Modify: `src/app/(dashboard)/motivation/payrolls/payrolls-client.tsx`
- Modify: `src/app/(dashboard)/my/motivation/my-motivation-client.tsx`

- [ ] **Step 1: Add download helper and button to payrolls page**

In `payrolls-client.tsx`, add import and download function:

```typescript
import { getPayrollPdfData } from "@/actions/motivation-payroll"
import { pdf } from "@react-pdf/renderer"
import { PayrollPdfDocument } from "@/components/motivation/payroll-pdf-document"

async function downloadPayrollPdf(payrollId: string) {
  const data = await getPayrollPdfData(payrollId)
  const blob = await pdf(
    <PayrollPdfDocument
      userName={data.userName}
      storeName={data.storeName}
      periodStart={data.periodStart}
      periodEnd={data.periodEnd}
      isAdvance={data.isAdvance}
      breakdown={data.breakdown as any}
      advanceAmount={data.advanceAmount}
    />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `payroll-${data.userName}-${data.periodStart.slice(0, 7)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

In the table actions cell (for all statuses), add a PDF button:

```tsx
<Button
  variant="ghost"
  size="icon-sm"
  onClick={() => downloadPayrollPdf(p.id)}
  title="Скачать PDF"
>
  <FileDown className="size-4" />
</Button>
```

- [ ] **Step 2: Add PDF button to my-motivation page**

In `my-motivation-client.tsx`, add a "Скачать расчётный лист" button in the header area. This requires fetching the payroll ID for the current period first.

Add import:
```typescript
import { getPayrolls } from "@/actions/motivation-payroll"
import { getPayrollPdfData } from "@/actions/motivation-payroll"
import { pdf } from "@react-pdf/renderer"
import { PayrollPdfDocument } from "@/components/motivation/payroll-pdf-document"
import { FileDown } from "lucide-react"
```

Add state for payroll availability and the download handler (same `downloadPayrollPdf` function as above). Show the button conditionally when a payroll exists for the selected period.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verify PDF download**

In browser, navigate to `/motivation/payrolls`, click the PDF icon on any row. Verify the PDF downloads with correct Russian text and layout.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/motivation/payrolls/payrolls-client.tsx src/app/\(dashboard\)/my/motivation/my-motivation-client.tsx
git commit -m "feat(motivation): add PDF download buttons to payrolls and my-motivation pages"
```

---

## Final Verification

- [ ] **Type-check entire project**
```bash
npx tsc --noEmit
```

- [ ] **Start dev server and smoke test**
```bash
npm run dev
```

Test checklist:
1. Sidebar shows badge count for pending schemes (log in as owner)
2. `/motivation/approvals` shows pending schemes list
3. Approval detail page shows formula diff + simulation table
4. Approve/reject works with optional reason
5. `/motivation/payrolls` shows all payrolls with filters
6. Expanding payroll row shows EarningsBreakdown
7. PDF download works from payrolls page
8. PDF download works from my-motivation page
