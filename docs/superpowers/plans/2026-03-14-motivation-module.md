# Motivation Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a category-based commission system where employees earn daily rate + per-item commissions (by motivation group) + cross-sell bonuses + repair bonuses, with real-time dashboard and payroll generation.

**Architecture:** Prisma models store motivation groups, schemes (JSON formula), assignments, and payroll records. A calculation engine computes earnings on the fly from sales/repair data. Settings UI for managing groups and schemes; dashboards for viewing earnings.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, Zod, shadcn/ui, Zustand, TailwindCSS 4

**Spec:** `docs/superpowers/specs/2026-03-14-motivation-module-design.md`

---

## File Structure

### New Files

**Prisma & Seed:**
- `prisma/schema.prisma` — Add MotivationGroup, MotivationGroupProduct, MotivationScheme, MotivationAssignment, Payroll models + enums
- `prisma/seed.ts` — Add motivation permissions, seed default groups and scheme

**Validations:**
- `src/lib/validations/motivation.ts` — Zod schemas for groups, schemes, formula, assignments, payroll

**Server Actions:**
- `src/actions/motivation-groups.ts` — CRUD for motivation groups + product assignment
- `src/actions/motivation-schemes.ts` — CRUD for schemes + formula management + approval flow
- `src/actions/motivation-assignments.ts` — Assign/unassign schemes to employees
- `src/actions/motivation-calculation.ts` — Core calculation engine (real-time + payroll generation)
- `src/actions/motivation-payroll.ts` — Payroll CRUD, advance/settlement generation

**Settings Pages:**
- `src/app/(dashboard)/settings/motivation-groups/page.tsx` — Server page
- `src/app/(dashboard)/settings/motivation-groups/motivation-groups-client.tsx` — Client list
- `src/app/(dashboard)/settings/motivation-groups/[id]/page.tsx` — Server page (group editor)
- `src/app/(dashboard)/settings/motivation-groups/[id]/editor-client.tsx` — Group editor with product picker
- `src/app/(dashboard)/settings/motivation-schemes/page.tsx` — Server page
- `src/app/(dashboard)/settings/motivation-schemes/motivation-schemes-client.tsx` — Client list
- `src/app/(dashboard)/settings/motivation-schemes/[id]/page.tsx` — Server page (scheme editor)
- `src/app/(dashboard)/settings/motivation-schemes/[id]/editor-client.tsx` — Scheme formula editor

**Dashboard Pages:**
- `src/app/(dashboard)/motivation/page.tsx` — Server page (management)
- `src/app/(dashboard)/motivation/motivation-dashboard-client.tsx` — Management dashboard
- `src/app/(dashboard)/my/motivation/page.tsx` — Server page (employee)
- `src/app/(dashboard)/my/motivation/my-motivation-client.tsx` — Employee dashboard

**Components:**
- `src/components/motivation/commission-rules-editor.tsx` — Editable commission rules table
- `src/components/motivation/cross-sell-editor.tsx` — Cross-sell bonuses editor
- `src/components/motivation/assignment-manager.tsx` — Employee assignment UI
- `src/components/motivation/earnings-breakdown.tsx` — Detailed earnings breakdown component

### Modified Files

- `src/lib/permissions-list.ts` — Add motivation permissions + update role presets
- `src/components/layout/app-sidebar.tsx` — Add "Мотивация" nav item
- `src/components/settings/settings-nav.tsx` — Add "Мотивационные группы" and "Схемы мотивации" items

---

## Chunk 1: Foundation

### Task 1: Prisma Schema — Models and Enums

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums**

Add after existing enums in `prisma/schema.prisma`:

```prisma
enum SchemeStatus {
  ACTIVE
  PENDING_APPROVAL
  ARCHIVED
}

enum PayrollStatus {
  DRAFT
  CONFIRMED
  PAID
}
```

- [ ] **Step 2: Add MotivationGroup and MotivationGroupProduct models**

```prisma
model MotivationGroup {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
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
  @@unique([productId])
}
```

Add to the existing `Product` model:

```prisma
motivationGroup  MotivationGroupProduct?
```

- [ ] **Step 3: Add MotivationScheme model**

```prisma
model MotivationScheme {
  id           String       @id @default(cuid())
  name         String
  description  String?
  formula      Json
  storeId      String?
  store        Store?       @relation(fields: [storeId], references: [id])
  createdById  String
  createdBy    User         @relation("SchemeCreator", fields: [createdById], references: [id])
  approvedById   String?
  approvedBy     User?        @relation("SchemeApprover", fields: [approvedById], references: [id])
  approvedAt     DateTime?
  parentSchemeId String?
  parentScheme   MotivationScheme?  @relation("SchemeVersions", fields: [parentSchemeId], references: [id])
  childSchemes   MotivationScheme[] @relation("SchemeVersions")
  status         SchemeStatus @default(ACTIVE)
  assignments    MotivationAssignment[]
  payrolls       Payroll[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}
```

Add to `Store` model: `motivationSchemes MotivationScheme[]`
Add to `User` model: `createdSchemes MotivationScheme[] @relation("SchemeCreator")` and `approvedSchemes MotivationScheme[] @relation("SchemeApprover")`

- [ ] **Step 4: Add MotivationAssignment model**

```prisma
model MotivationAssignment {
  id        String            @id @default(cuid())
  schemeId  String
  scheme    MotivationScheme  @relation(fields: [schemeId], references: [id])
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  storeId   String
  store     Store             @relation(fields: [storeId], references: [id])
  startDate DateTime
  endDate   DateTime?

  @@unique([userId, storeId, startDate])
}
```

Add to `User` model: `motivationAssignments MotivationAssignment[]`
Add to `Store` model: `motivationAssignments MotivationAssignment[]`

- [ ] **Step 5: Add Payroll model**

```prisma
model Payroll {
  id            String            @id @default(cuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id])
  storeId       String
  store         Store             @relation(fields: [storeId], references: [id])
  schemeId      String
  scheme        MotivationScheme  @relation(fields: [schemeId], references: [id])
  periodStart   DateTime
  periodEnd     DateTime
  shiftsCount   Int
  dailyTotal    Decimal           @db.Decimal(12, 2)
  commissions   Decimal           @db.Decimal(12, 2)
  crossBonuses  Decimal           @db.Decimal(12, 2)
  repairBonuses Decimal           @db.Decimal(12, 2)
  returns       Decimal           @db.Decimal(12, 2)
  totalAmount   Decimal           @db.Decimal(12, 2)
  isAdvance     Boolean           @default(false)
  status        PayrollStatus     @default(DRAFT)
  breakdown     Json
  createdAt     DateTime          @default(now())
}
```

Add to `User` model: `payrolls Payroll[]`
Add to `Store` model: `payrolls Payroll[]`

- [ ] **Step 6: Generate Prisma client and create migration**

Run:
```bash
cd astore-erp && npx prisma migrate dev --name add-motivation-module
```

Expected: Migration created, client generated, no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(motivation): add Prisma models for motivation module

MotivationGroup, MotivationGroupProduct, MotivationScheme,
MotivationAssignment, Payroll models with SchemeStatus and
PayrollStatus enums."
```

---

### Task 2: Zod Validations

**Files:**
- Create: `src/lib/validations/motivation.ts`

- [ ] **Step 1: Create validation file with all schemas**

```typescript
import { z } from "zod"

// --- Motivation Group ---

export const motivationGroupSchema = z.object({
  code: z.string().min(1, "Код обязателен").max(20, "Код слишком длинный"),
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional().nullable(),
})

export type MotivationGroupFormData = z.infer<typeof motivationGroupSchema>

// --- Commission Rule ---

export const commissionBasisSchema = z.enum(["PROFIT", "RETAIL_PRICE"])

export type CommissionBasis = z.infer<typeof commissionBasisSchema>

export const commissionRuleSchema = z.object({
  groupId: z.string().optional(),
  rate: z.coerce.number().min(0, "Ставка не может быть отрицательной").max(1, "Ставка не может быть больше 100%"),
  basis: commissionBasisSchema,
})

export type CommissionRule = z.infer<typeof commissionRuleSchema>

// --- Cross-Sell Bonus ---

export const crossSellBonusSchema = z.object({
  minItems: z.coerce.number().int().min(2, "Минимум 2 позиции"),
  bonus: z.coerce.number().positive("Бонус должен быть положительным"),
})

export type CrossSellBonus = z.infer<typeof crossSellBonusSchema>

// --- Motivation Formula (JSON stored in scheme) ---

export const motivationFormulaSchema = z.object({
  dailyRate: z.coerce.number().min(0, "Ставка не может быть отрицательной"),
  commissionRules: z.array(commissionRuleSchema),
  defaultCommission: commissionRuleSchema,
  crossSellBonuses: z.array(crossSellBonusSchema),
  repairBonus: z.coerce.number().min(0, "Бонус не может быть отрицательным"),
})

export type MotivationFormula = z.infer<typeof motivationFormulaSchema>

// --- Motivation Scheme ---

export const motivationSchemeSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  formula: motivationFormulaSchema,
})

export type MotivationSchemeFormData = z.infer<typeof motivationSchemeSchema>

// --- Motivation Assignment ---

export const motivationAssignmentSchema = z.object({
  schemeId: z.string().min(1, "Схема обязательна"),
  userId: z.string().min(1, "Сотрудник обязателен"),
  storeId: z.string().min(1, "Магазин обязателен"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
})

export type MotivationAssignmentFormData = z.infer<typeof motivationAssignmentSchema>

// --- Payroll ---

export const generatePayrollSchema = z.object({
  userId: z.string().min(1, "Сотрудник обязателен"),
  storeId: z.string().min(1, "Магазин обязателен"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  shiftsCount: z.coerce.number().int().min(0, "Количество смен не может быть отрицательным"),
  isAdvance: z.boolean().default(false),
})

export type GeneratePayrollData = z.infer<typeof generatePayrollSchema>

// --- Constants ---

export const COMMISSION_BASIS_LABELS: Record<CommissionBasis, string> = {
  PROFIT: "От чистой прибыли",
  RETAIL_PRICE: "От розничной цены",
}

export const SCHEME_STATUS_LABELS = {
  ACTIVE: "Активна",
  PENDING_APPROVAL: "Ожидает подтверждения",
  ARCHIVED: "В архиве",
} as const

export const PAYROLL_STATUS_LABELS = {
  DRAFT: "Черновик",
  CONFIRMED: "Подтверждён",
  PAID: "Выплачен",
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/motivation.ts
git commit -m "feat(motivation): add Zod validation schemas

Schemas for groups, schemes, formula, assignments, payroll.
Includes commission basis enum, cross-sell bonus, and label constants."
```

---

### Task 3: Permissions

**Files:**
- Modify: `src/lib/permissions-list.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add motivation permissions to permissions-list.ts**

Add to the `PERMISSIONS` object:

```typescript
// Motivation
MOTIVATION_GROUPS_MANAGE: { code: "motivation.groups.manage", module: "motivation", name: "Управление мотивационными группами" },
MOTIVATION_SCHEMES_MANAGE: { code: "motivation.schemes.manage", module: "motivation", name: "Управление схемами мотивации" },
MOTIVATION_SCHEMES_ASSIGN: { code: "motivation.schemes.assign", module: "motivation", name: "Назначение схем сотрудникам" },
MOTIVATION_SCHEMES_APPROVE: { code: "motivation.schemes.approve", module: "motivation", name: "Подтверждение изменений схем" },
MOTIVATION_PAYROLL_VIEW: { code: "motivation.payroll.view", module: "motivation", name: "Просмотр расчётов по всем сотрудникам" },
MOTIVATION_PAYROLL_OWN: { code: "motivation.payroll.own", module: "motivation", name: "Просмотр своей мотивации" },
```

- [ ] **Step 2: Update ROLE_PRESETS**

Add to owner preset permissions array:
```typescript
PERMISSIONS.MOTIVATION_GROUPS_MANAGE.code,
PERMISSIONS.MOTIVATION_SCHEMES_MANAGE.code,
PERMISSIONS.MOTIVATION_SCHEMES_ASSIGN.code,
PERMISSIONS.MOTIVATION_SCHEMES_APPROVE.code,
PERMISSIONS.MOTIVATION_PAYROLL_VIEW.code,
PERMISSIONS.MOTIVATION_PAYROLL_OWN.code,
```

Add to director preset:
```typescript
PERMISSIONS.MOTIVATION_GROUPS_MANAGE.code,
PERMISSIONS.MOTIVATION_SCHEMES_MANAGE.code,
PERMISSIONS.MOTIVATION_SCHEMES_ASSIGN.code,
PERMISSIONS.MOTIVATION_PAYROLL_VIEW.code,
PERMISSIONS.MOTIVATION_PAYROLL_OWN.code,
```

Add to seller, master, courier, warehouse, purchaser presets:
```typescript
PERMISSIONS.MOTIVATION_PAYROLL_OWN.code,
```

- [ ] **Step 3: Add motivation permissions to seed.ts**

In the permissions seeding section, the new permission codes will be auto-created from `PERMISSIONS` object. No additional seed code needed if the seed iterates `Object.values(PERMISSIONS)`.

Verify the seed pattern: read `prisma/seed.ts` to confirm permissions are seeded from `PERMISSIONS` object. If they are, no changes needed here. If permissions are listed manually, add the new ones.

- [ ] **Step 4: Run seed to verify**

```bash
cd astore-erp && npx prisma db seed
```

Expected: Seed completes without errors, new permissions created.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions-list.ts prisma/seed.ts
git commit -m "feat(motivation): add motivation permissions

6 new permissions: groups.manage, schemes.manage, schemes.assign,
schemes.approve, payroll.view, payroll.own. Updated all role presets."
```

---

## Chunk 2: Server Actions — Groups and Schemes

### Task 4: Motivation Groups Server Actions

**Files:**
- Create: `src/actions/motivation-groups.ts`

- [ ] **Step 1: Create motivation-groups.ts with CRUD operations**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { motivationGroupSchema } from "@/lib/validations/motivation"

export async function getMotivationGroups() {
  await requirePermission("motivation.groups.manage")

  const groups = await db.motivationGroup.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  })

  return groups.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    description: g.description,
    productCount: g._count.products,
    createdAt: g.createdAt.toISOString(),
  }))
}

export async function getMotivationGroup(id: string) {
  await requirePermission("motivation.groups.manage")

  const group = await db.motivationGroup.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })

  if (!group) throw new Error("Мотивационная группа не найдена")

  return {
    id: group.id,
    code: group.code,
    name: group.name,
    description: group.description,
    products: group.products.map((p) => ({
      id: p.product.id,
      name: p.product.name,
      sku: p.product.sku,
      categoryName: p.product.category.name,
    })),
  }
}

export async function createMotivationGroup(data: unknown) {
  await requirePermission("motivation.groups.manage")

  const validated = motivationGroupSchema.parse(data)

  const existing = await db.motivationGroup.findUnique({
    where: { code: validated.code },
  })
  if (existing) throw new Error("Группа с таким кодом уже существует")

  const group = await db.motivationGroup.create({
    data: validated,
  })

  return { id: group.id }
}

export async function updateMotivationGroup(id: string, data: unknown) {
  await requirePermission("motivation.groups.manage")

  const validated = motivationGroupSchema.parse(data)

  const existing = await db.motivationGroup.findFirst({
    where: { code: validated.code, id: { not: id } },
  })
  if (existing) throw new Error("Группа с таким кодом уже существует")

  await db.motivationGroup.update({
    where: { id },
    data: validated,
  })
}

export async function deleteMotivationGroup(id: string) {
  await requirePermission("motivation.groups.manage")

  await db.motivationGroup.delete({ where: { id } })
}

export async function addProductsToGroup(groupId: string, productIds: string[]) {
  await requirePermission("motivation.groups.manage")

  // Check for products already in other groups
  const existing = await db.motivationGroupProduct.findMany({
    where: { productId: { in: productIds } },
    include: { group: { select: { name: true } } },
  })

  const inOtherGroups = existing.filter((e) => e.groupId !== groupId)
  if (inOtherGroups.length > 0) {
    // Remove from old groups first
    await db.motivationGroupProduct.deleteMany({
      where: {
        productId: { in: inOtherGroups.map((e) => e.productId) },
      },
    })
  }

  // Filter out products already in this group
  const alreadyInGroup = new Set(existing.filter((e) => e.groupId === groupId).map((e) => e.productId))
  const newProductIds = productIds.filter((id) => !alreadyInGroup.has(id))

  if (newProductIds.length > 0) {
    await db.motivationGroupProduct.createMany({
      data: newProductIds.map((productId) => ({
        groupId,
        productId,
      })),
    })
  }

  return { added: newProductIds.length, moved: inOtherGroups.length }
}

export async function removeProductFromGroup(groupId: string, productId: string) {
  await requirePermission("motivation.groups.manage")

  await db.motivationGroupProduct.delete({
    where: {
      groupId_productId: { groupId, productId },
    },
  })
}

// Search products for adding to group
export async function searchProductsForGroup(query: string, groupId?: string) {
  await requirePermission("motivation.groups.manage")

  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { name: true } },
      motivationGroup: {
        select: { group: { select: { id: true, name: true } } },
      },
    },
    take: 20,
    orderBy: { name: "asc" },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryName: p.category.name,
    currentGroupId: p.motivationGroup?.group.id ?? null,
    currentGroupName: p.motivationGroup?.group.name ?? null,
  }))
}
```

- [ ] **Step 2: Verify by running dev server**

```bash
cd astore-erp && npx next dev -p 3000
```

Expected: No TypeScript compilation errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/motivation-groups.ts
git commit -m "feat(motivation): add motivation groups server actions

CRUD for groups, product assignment with auto-move from other groups,
product search with current group info."
```

---

### Task 5: Motivation Schemes Server Actions

**Files:**
- Create: `src/actions/motivation-schemes.ts`

- [ ] **Step 1: Create motivation-schemes.ts**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { motivationSchemeSchema } from "@/lib/validations/motivation"
import type { MotivationFormula } from "@/lib/validations/motivation"

export async function getMotivationSchemes(storeId?: string) {
  await requirePermission("motivation.schemes.manage")

  const schemes = await db.motivationScheme.findMany({
    where: storeId ? { OR: [{ storeId }, { storeId: null }] } : {},
    include: {
      store: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return schemes.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    storeName: s.store?.name ?? "Все магазины",
    storeId: s.storeId,
    createdByName: `${s.createdBy.firstName} ${s.createdBy.lastName}`,
    assignmentCount: s._count.assignments,
    createdAt: s.createdAt.toISOString(),
  }))
}

export async function getMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.manage")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          store: { select: { id: true, name: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  })

  if (!scheme) throw new Error("Схема мотивации не найдена")

  return {
    id: scheme.id,
    name: scheme.name,
    description: scheme.description,
    formula: scheme.formula as unknown as MotivationFormula,
    status: scheme.status,
    storeId: scheme.storeId,
    storeName: scheme.store?.name ?? "Все магазины",
    createdByName: `${scheme.createdBy.firstName} ${scheme.createdBy.lastName}`,
    approvedByName: scheme.approvedBy
      ? `${scheme.approvedBy.firstName} ${scheme.approvedBy.lastName}`
      : null,
    approvedAt: scheme.approvedAt?.toISOString() ?? null,
    assignments: scheme.assignments.map((a) => ({
      id: a.id,
      userId: a.user.id,
      userName: `${a.user.firstName} ${a.user.lastName}`,
      storeId: a.store.id,
      storeName: a.store.name,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate?.toISOString() ?? null,
    })),
    createdAt: scheme.createdAt.toISOString(),
  }
}

export async function createMotivationScheme(data: unknown) {
  await requirePermission("motivation.schemes.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = motivationSchemeSchema.parse(data)

  // Check if user is owner (has approve permission) — if not, set PENDING_APPROVAL
  const isOwner = await checkPermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.create({
    data: {
      name: validated.name,
      description: validated.description,
      formula: validated.formula as unknown as Record<string, unknown>,
      storeId: validated.storeId,
      createdById: session.user.id,
      status: isOwner ? "ACTIVE" : "PENDING_APPROVAL",
    },
  })

  return { id: scheme.id }
}

export async function updateMotivationScheme(id: string, data: unknown) {
  await requirePermission("motivation.schemes.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = motivationSchemeSchema.parse(data)
  const isOwner = await checkPermission("motivation.schemes.approve")

  const existing = await db.motivationScheme.findUnique({ where: { id } })
  if (!existing) throw new Error("Схема мотивации не найдена")

  if (isOwner) {
    // Owner: direct edit
    await db.motivationScheme.update({
      where: { id },
      data: {
        name: validated.name,
        description: validated.description,
        formula: validated.formula as unknown as Record<string, unknown>,
        storeId: validated.storeId,
      },
    })
    return { id }
  } else {
    // Director: create new version for approval, linked to original
    const newScheme = await db.motivationScheme.create({
      data: {
        name: validated.name,
        description: validated.description,
        formula: validated.formula as unknown as Record<string, unknown>,
        storeId: validated.storeId,
        createdById: session.user.id,
        parentSchemeId: id,  // link to original scheme
        status: "PENDING_APPROVAL",
      },
    })
    return { id: newScheme.id, pendingApproval: true }
  }
}

export async function approveMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.approve")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
  })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.$transaction(async (tx) => {
    // Activate new scheme
    await tx.motivationScheme.update({
      where: { id },
      data: {
        status: "ACTIVE",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    })

    // If this is a version of another scheme, archive parent and migrate assignments
    if (scheme.parentSchemeId) {
      await tx.motivationScheme.update({
        where: { id: scheme.parentSchemeId },
        data: { status: "ARCHIVED" },
      })

      await tx.motivationAssignment.updateMany({
        where: { schemeId: scheme.parentSchemeId },
        data: { schemeId: id },
      })
    }
  })
}

export async function rejectMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
  })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.motivationScheme.update({
    where: { id },
    data: { status: "ARCHIVED" },
  })
}

export async function archiveMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.manage")

  await db.motivationScheme.update({
    where: { id },
    data: { status: "ARCHIVED" },
  })
}

// Count pending schemes for sidebar badge
export async function getPendingSchemeCount() {
  const canApprove = await checkPermission("motivation.schemes.approve")
  if (!canApprove) return 0

  return db.motivationScheme.count({
    where: { status: "PENDING_APPROVAL" },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/motivation-schemes.ts
git commit -m "feat(motivation): add motivation schemes server actions

CRUD with owner/director approval flow. Owner edits directly,
director creates pending version. Approve/reject/archive actions."
```

---

### Task 6: Motivation Assignments Server Actions

**Files:**
- Create: `src/actions/motivation-assignments.ts`

- [ ] **Step 1: Create motivation-assignments.ts**

```typescript
"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { motivationAssignmentSchema } from "@/lib/validations/motivation"

export async function getAssignmentsForStore(storeId: string) {
  await requirePermission("motivation.schemes.assign")

  const assignments = await db.motivationAssignment.findMany({
    where: { storeId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      scheme: { select: { id: true, name: true, status: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  })

  return assignments.map((a) => ({
    id: a.id,
    userId: a.user.id,
    userName: `${a.user.firstName} ${a.user.lastName}`,
    schemeId: a.scheme.id,
    schemeName: a.scheme.name,
    schemeStatus: a.scheme.status,
    storeId: a.store.id,
    storeName: a.store.name,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate?.toISOString() ?? null,
  }))
}

export async function createAssignment(data: unknown) {
  await requirePermission("motivation.schemes.assign")

  const validated = motivationAssignmentSchema.parse(data)

  // Check for overlapping assignments
  const overlapping = await db.motivationAssignment.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: { lte: validated.endDate ?? new Date("2099-12-31") },
      OR: [
        { endDate: null },
        { endDate: { gte: validated.startDate } },
      ],
    },
  })

  if (overlapping) {
    throw new Error("У сотрудника уже есть назначенная схема на этот период")
  }

  // Verify scheme is ACTIVE
  const scheme = await db.motivationScheme.findUnique({
    where: { id: validated.schemeId },
  })
  if (!scheme || scheme.status !== "ACTIVE") {
    throw new Error("Можно назначать только активные схемы")
  }

  const assignment = await db.motivationAssignment.create({
    data: {
      schemeId: validated.schemeId,
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: validated.startDate,
      endDate: validated.endDate,
    },
  })

  return { id: assignment.id }
}

export async function endAssignment(id: string, endDate?: Date) {
  await requirePermission("motivation.schemes.assign")

  await db.motivationAssignment.update({
    where: { id },
    data: { endDate: endDate ?? new Date() },
  })
}

export async function deleteAssignment(id: string) {
  await requirePermission("motivation.schemes.assign")

  await db.motivationAssignment.delete({ where: { id } })
}

// Get employees available for assignment in a store
export async function getStoreEmployees(storeId: string) {
  await requirePermission("motivation.schemes.assign")

  const userStores = await db.userStore.findMany({
    where: { storeId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          motivationAssignments: {
            where: {
              storeId,
              OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            include: {
              scheme: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
    },
  })

  return userStores.map((us) => ({
    id: us.user.id,
    name: `${us.user.firstName} ${us.user.lastName}`,
    currentScheme: us.user.motivationAssignments[0]?.scheme.name ?? null,
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/motivation-assignments.ts
git commit -m "feat(motivation): add assignment server actions

Create/end/delete assignments with overlap validation.
Get store employees with current scheme info."
```

---

## Chunk 3: Calculation Engine and Payroll

### Task 7: Calculation Engine

**Files:**
- Create: `src/actions/motivation-calculation.ts`

- [ ] **Step 1: Create the calculation engine**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import type { MotivationFormula } from "@/lib/validations/motivation"

interface EarningsResult {
  dailyRate: { shiftsCount: number; ratePerShift: number; total: number }
  commissions: SaleCommission[]
  crossSellBonuses: CrossSellBonusResult[]
  repairBonuses: RepairBonusResult[]
  returnDeductions: ReturnDeduction[]
  totals: {
    daily: number
    commissions: number
    crossBonuses: number
    repairBonuses: number
    returns: number
    total: number
  }
}

interface SaleCommission {
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
  totalCommission: number
}

interface CrossSellBonusResult {
  saleId: string
  saleNumber: string
  itemCount: number
  bonus: number
}

interface RepairBonusResult {
  repairId: string
  repairNumber: string
  date: string
  bonus: number
}

interface ReturnDeduction {
  returnId: string
  saleNumber: string
  productName: string
  commission: number
}

// Get product group mapping for a list of product IDs
async function getProductGroupMap(productIds: string[]) {
  const mappings = await db.motivationGroupProduct.findMany({
    where: { productId: { in: productIds } },
    include: { group: { select: { id: true, code: true } } },
  })

  const map = new Map<string, { groupId: string; groupCode: string }>()
  for (const m of mappings) {
    map.set(m.productId, { groupId: m.group.id, groupCode: m.group.code })
  }
  return map
}

// Find matching commission rule for a product
function findCommissionRule(
  formula: MotivationFormula,
  groupId: string | undefined,
): { rate: number; basis: "PROFIT" | "RETAIL_PRICE" } {
  if (groupId) {
    const rule = formula.commissionRules.find((r) => r.groupId === groupId)
    if (rule) return { rate: rule.rate, basis: rule.basis }
  }
  return {
    rate: formula.defaultCommission.rate,
    basis: formula.defaultCommission.basis,
  }
}

// Calculate commission for a single sale item
function calculateItemCommission(
  sellPrice: number,
  costPrice: number,
  quantity: number,
  rate: number,
  basis: "PROFIT" | "RETAIL_PRICE",
): number {
  if (basis === "PROFIT") {
    return (sellPrice - costPrice) * quantity * rate
  }
  return sellPrice * quantity * rate
}

// Find the highest matching cross-sell bonus
function findCrossSellBonus(
  formula: MotivationFormula,
  itemCount: number,
): number {
  const sorted = [...formula.crossSellBonuses].sort((a, b) => b.minItems - a.minItems)
  for (const rule of sorted) {
    if (itemCount >= rule.minItems) return rule.bonus
  }
  return 0
}

// Core calculation: compute earnings for a user in a period
export async function calculateEarnings(
  userId: string,
  storeId: string,
  periodStart: Date,
  periodEnd: Date,
  shiftsCount: number,
): Promise<EarningsResult | null> {
  // Find active assignment
  const assignment = await db.motivationAssignment.findFirst({
    where: {
      userId,
      storeId,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
    include: { scheme: true },
  })

  if (!assignment) return null

  const formula = assignment.scheme.formula as unknown as MotivationFormula

  // Fetch sales by this seller in period
  const sales = await db.sale.findMany({
    where: {
      sellerId: userId,
      storeId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true } },
        },
      },
      returns: {
        include: {
          items: {
            include: {
              saleItem: {
                include: {
                  product: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Collect all product IDs for group lookup
  const allProductIds = new Set<string>()
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId) allProductIds.add(item.productId)
    }
  }

  const groupMap = await getProductGroupMap([...allProductIds])

  // Build returned item IDs set
  // Also query returns that happened in this period for sales from OTHER periods
  const returnedItemIds = new Set<string>()
  const returnDeductions: ReturnDeduction[] = []

  // 1. Returns nested in period sales
  for (const sale of sales) {
    for (const ret of sale.returns) {
      for (const retItem of ret.items) {
        returnedItemIds.add(retItem.saleItemId)

        const si = retItem.saleItem
        const productId = si.productId
        const group = productId ? groupMap.get(productId) : undefined
        const rule = findCommissionRule(formula, group?.groupId)
        const commission = calculateItemCommission(
          Number(si.price),
          Number(si.costPrice),
          retItem.quantity,
          rule.rate,
          rule.basis,
        )

        returnDeductions.push({
          returnId: ret.id,
          saleNumber: sale.number,
          productName: si.product?.name ?? si.name,
          commission: -commission,
        })
      }
    }
  }

  // 2. Returns in this period for sales from OTHER periods (cross-period returns)
  const crossPeriodReturns = await db.saleReturn.findMany({
    where: {
      createdAt: { gte: periodStart, lte: periodEnd },
      sale: {
        sellerId: userId,
        storeId,
        createdAt: { lt: periodStart }, // sale is from before this period
      },
    },
    include: {
      sale: { select: { number: true } },
      items: {
        include: {
          saleItem: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  for (const ret of crossPeriodReturns) {
    for (const retItem of ret.items) {
      const si = retItem.saleItem
      const productId = si.productId
      if (productId) allProductIds.add(productId)
    }
  }

  // Re-fetch group map if new products appeared
  const updatedGroupMap = crossPeriodReturns.length > 0
    ? await getProductGroupMap([...allProductIds])
    : groupMap

  for (const ret of crossPeriodReturns) {
    for (const retItem of ret.items) {
      returnedItemIds.add(retItem.saleItemId)

      const si = retItem.saleItem
      const productId = si.productId
      const group = productId ? updatedGroupMap.get(productId) : undefined
      const rule = findCommissionRule(formula, group?.groupId)
      const commission = calculateItemCommission(
        Number(si.price),
        Number(si.costPrice),
        retItem.quantity,
        rule.rate,
        rule.basis,
      )

      returnDeductions.push({
        returnId: ret.id,
        saleNumber: ret.sale.number,
        productName: si.product?.name ?? si.name,
        commission: -commission,
      })
    }
  }

  // Calculate commissions per sale
  const commissions: SaleCommission[] = []
  const crossSellBonuses: CrossSellBonusResult[] = []

  for (const sale of sales) {
    const saleItems = sale.items.filter((item) => !returnedItemIds.has(item.id))

    const items = saleItems.map((item) => {
      const productId = item.productId
      const group = productId ? groupMap.get(productId) : undefined
      const rule = findCommissionRule(formula, group?.groupId)
      const commission = calculateItemCommission(
        Number(item.price),
        Number(item.costPrice),
        item.quantity,
        rule.rate,
        rule.basis,
      )

      return {
        productName: item.product?.name ?? item.name,
        groupCode: group?.groupCode ?? null,
        sellPrice: Number(item.price),
        costPrice: Number(item.costPrice),
        rate: rule.rate,
        basis: rule.basis as "PROFIT" | "RETAIL_PRICE",
        commission,
      }
    })

    if (items.length > 0) {
      commissions.push({
        saleId: sale.id,
        saleNumber: sale.number,
        date: sale.createdAt.toISOString(),
        items,
        totalCommission: items.reduce((s, i) => s + i.commission, 0),
      })
    }

    // Cross-sell: count remaining line items (not returned)
    const remainingItemCount = saleItems.length
    const crossBonus = findCrossSellBonus(formula, remainingItemCount)
    if (crossBonus > 0) {
      crossSellBonuses.push({
        saleId: sale.id,
        saleNumber: sale.number,
        itemCount: remainingItemCount,
        bonus: crossBonus,
      })
    }
  }

  // Fetch completed repairs (DELIVERED in period, user is master)
  const repairs = await db.repair.findMany({
    where: {
      masterId: userId,
      status: "DELIVERED",
      deliveredAt: { gte: periodStart, lte: periodEnd },
    },
    select: { id: true, number: true, deliveredAt: true },
  })

  const repairBonuses: RepairBonusResult[] = repairs.map((r) => ({
    repairId: r.id,
    repairNumber: r.number,
    date: r.deliveredAt!.toISOString(),
    bonus: formula.repairBonus,
  }))

  // Totals
  const totalDaily = shiftsCount * formula.dailyRate
  const totalCommissions = commissions.reduce((s, c) => s + c.totalCommission, 0)
  const totalCross = crossSellBonuses.reduce((s, c) => s + c.bonus, 0)
  const totalRepairs = repairBonuses.reduce((s, r) => s + r.bonus, 0)
  const totalReturns = returnDeductions.reduce((s, r) => s + r.commission, 0)

  return {
    dailyRate: {
      shiftsCount,
      ratePerShift: formula.dailyRate,
      total: totalDaily,
    },
    commissions,
    crossSellBonuses,
    repairBonuses,
    returnDeductions,
    totals: {
      daily: totalDaily,
      commissions: totalCommissions,
      crossBonuses: totalCross,
      repairBonuses: totalRepairs,
      returns: totalReturns,
      total: totalDaily + totalCommissions + totalCross + totalRepairs + totalReturns,
    },
  }
}

// Real-time dashboard for the current user
export async function getMyEarnings(storeId: string, periodStart: string, periodEnd: string) {
  await requirePermission("motivation.payroll.own")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  // For now, shifts are not auto-counted (no shift module yet)
  // We count from existing payroll records or default to 0
  const existingPayroll = await db.payroll.findFirst({
    where: {
      userId: session.user.id,
      storeId,
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
    select: { shiftsCount: true },
  })
  const shiftsCount = existingPayroll?.shiftsCount ?? 0

  return calculateEarnings(session.user.id, storeId, start, end, shiftsCount)
}

// Management view: get earnings for all employees in a store
export async function getStoreEarnings(
  storeId: string,
  periodStart: string,
  periodEnd: string,
) {
  await requirePermission("motivation.payroll.view")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  // Get all employees with active assignments in this store
  const assignments = await db.motivationAssignment.findMany({
    where: {
      storeId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // Parallel calculation for all employees
  const results = await Promise.all(
    assignments.map(async (assignment) => {
      const payroll = await db.payroll.findFirst({
        where: {
          userId: assignment.userId,
          storeId,
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
        select: { shiftsCount: true },
      })

      const earnings = await calculateEarnings(
        assignment.userId,
        storeId,
        start,
        end,
        payroll?.shiftsCount ?? 0,
      )

      if (!earnings) return null

      return {
        userId: assignment.user.id,
        userName: `${assignment.user.firstName} ${assignment.user.lastName}`,
        ...earnings.totals,
        shiftsCount: earnings.dailyRate.shiftsCount,
      }
    }),
  )

  return results.filter((r) => r !== null)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/motivation-calculation.ts
git commit -m "feat(motivation): add calculation engine

Core earnings calculation: per-item commissions by motivation group,
cross-sell bonuses, repair bonuses, return deductions.
Real-time dashboard and management view endpoints."
```

---

### Task 8: Payroll Server Actions

**Files:**
- Create: `src/actions/motivation-payroll.ts`

- [ ] **Step 1: Create payroll actions**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { generatePayrollSchema } from "@/lib/validations/motivation"
import { calculateEarnings } from "@/actions/motivation-calculation"

export async function getPayrolls(storeId: string, periodStart: string, periodEnd: string) {
  await requirePermission("motivation.payroll.view")

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const payrolls = await db.payroll.findMany({
    where: {
      storeId,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      scheme: { select: { name: true } },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  })

  return payrolls.map((p) => ({
    id: p.id,
    userName: `${p.user.firstName} ${p.user.lastName}`,
    userId: p.user.id,
    schemeName: p.scheme.name,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    shiftsCount: p.shiftsCount,
    dailyTotal: Number(p.dailyTotal),
    commissions: Number(p.commissions),
    crossBonuses: Number(p.crossBonuses),
    repairBonuses: Number(p.repairBonuses),
    returns: Number(p.returns),
    totalAmount: Number(p.totalAmount),
    isAdvance: p.isAdvance,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }))
}

export async function generatePayroll(data: unknown) {
  await requirePermission("motivation.payroll.view")

  const validated = generatePayrollSchema.parse(data)

  // Check if DRAFT payroll already exists for this period
  const existing = await db.payroll.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      isAdvance: validated.isAdvance,
      status: "DRAFT",
    },
  })

  if (existing) {
    // Delete existing draft to recalculate
    await db.payroll.delete({ where: { id: existing.id } })
  }

  // Check no CONFIRMED/PAID exists
  const confirmed = await db.payroll.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      isAdvance: validated.isAdvance,
      status: { in: ["CONFIRMED", "PAID"] },
    },
  })

  if (confirmed) {
    throw new Error("Расчёт за этот период уже подтверждён или выплачен")
  }

  // Find assignment to get scheme and formula
  const assignment = await db.motivationAssignment.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: { lte: validated.periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: validated.periodStart } }],
    },
    include: { scheme: true },
  })

  if (!assignment) throw new Error("У сотрудника нет назначенной схемы мотивации на этот период")

  // For advance: only daily rate × shifts (no commissions)
  // For settlement: full calculation
  let earnings
  if (validated.isAdvance) {
    const formula = assignment.scheme.formula as unknown as import("@/lib/validations/motivation").MotivationFormula
    const dailyTotal = validated.shiftsCount * formula.dailyRate
    earnings = {
      dailyRate: { shiftsCount: validated.shiftsCount, ratePerShift: formula.dailyRate, total: dailyTotal },
      commissions: [],
      crossSellBonuses: [],
      repairBonuses: [],
      returnDeductions: [],
      totals: { daily: dailyTotal, commissions: 0, crossBonuses: 0, repairBonuses: 0, returns: 0, total: dailyTotal },
    }
  } else {
    const result = await calculateEarnings(
      validated.userId,
      validated.storeId,
      validated.periodStart,
      validated.periodEnd,
      validated.shiftsCount,
    )
    if (!result) throw new Error("Ошибка расчёта")
    earnings = result
  }

  // For month-end: subtract advance
  let advanceAmount = 0
  if (!validated.isAdvance) {
    const advance = await db.payroll.findFirst({
      where: {
        userId: validated.userId,
        storeId: validated.storeId,
        periodStart: validated.periodStart,
        periodEnd: validated.periodEnd,
        isAdvance: true,
        status: { in: ["CONFIRMED", "PAID"] },
      },
    })
    if (advance) {
      advanceAmount = Number(advance.totalAmount)
    }
  }

  const totalAmount = earnings.totals.total - advanceAmount

  const payroll = await db.payroll.create({
    data: {
      userId: validated.userId,
      storeId: validated.storeId,
      schemeId: assignment.schemeId,
      periodStart: validated.periodStart,
      periodEnd: validated.periodEnd,
      shiftsCount: validated.shiftsCount,
      dailyTotal: earnings.totals.daily,
      commissions: earnings.totals.commissions,
      crossBonuses: earnings.totals.crossBonuses,
      repairBonuses: earnings.totals.repairBonuses,
      returns: earnings.totals.returns,
      totalAmount,
      isAdvance: validated.isAdvance,
      status: "DRAFT",
      breakdown: {
        daily: earnings.dailyRate,
        commissions: earnings.commissions,
        crossSellBonuses: earnings.crossSellBonuses,
        repairBonuses: earnings.repairBonuses,
        returnDeductions: earnings.returnDeductions,
        advance: advanceAmount,
      } as unknown as Record<string, unknown>,
    },
  })

  return { id: payroll.id }
}

export async function confirmPayroll(id: string) {
  await requirePermission("motivation.payroll.view")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "DRAFT") throw new Error("Можно подтвердить только черновик")

  await db.payroll.update({
    where: { id },
    data: { status: "CONFIRMED" },
  })
}

export async function markPayrollPaid(id: string) {
  await requirePermission("motivation.payroll.view")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "CONFIRMED") throw new Error("Сначала подтвердите расчёт")

  await db.payroll.update({
    where: { id },
    data: { status: "PAID" },
  })
}

export async function deletePayroll(id: string) {
  await requirePermission("motivation.payroll.view")

  const payroll = await db.payroll.findUnique({ where: { id } })
  if (!payroll) throw new Error("Расчёт не найден")
  if (payroll.status !== "DRAFT") throw new Error("Можно удалить только черновик")

  await db.payroll.delete({ where: { id } })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/motivation-payroll.ts
git commit -m "feat(motivation): add payroll server actions

Generate advance/settlement payrolls with full breakdown.
Confirm, mark paid, delete draft. Advance subtraction at settlement."
```

---

## Chunk 4: UI — Settings Pages

### Task 9: Motivation Groups — Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/motivation-groups/page.tsx`
- Create: `src/app/(dashboard)/settings/motivation-groups/motivation-groups-client.tsx`

- [ ] **Step 1: Create server page**

```typescript
// src/app/(dashboard)/settings/motivation-groups/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationGroups } from "@/actions/motivation-groups"
import { MotivationGroupsClient } from "./motivation-groups-client"

export default async function MotivationGroupsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.groups.manage")
  if (!hasAccess) redirect("/")

  const groups = await getMotivationGroups()

  return <MotivationGroupsClient initialGroups={groups} />
}
```

- [ ] **Step 2: Create client component with table and CRUD dialogs**

Create `motivation-groups-client.tsx` with:
- Table showing groups: code, name, product count
- "Создать группу" button → dialog with code + name + description fields
- Edit button per row → same dialog in edit mode
- Delete button per row → confirmation dialog
- Click on row → navigate to `/settings/motivation-groups/[id]` for product management
- Use pattern from `src/components/documents/template-table.tsx` as reference

The component should:
- Use `useRouter` for navigation
- Use `useState` for dialog open/close
- Call server actions (createMotivationGroup, updateMotivationGroup, deleteMotivationGroup)
- Show toast on success/error
- Refresh data after mutations via `router.refresh()`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/motivation-groups/
git commit -m "feat(motivation): add motivation groups settings page

Table with CRUD dialogs for motivation groups.
Click row to navigate to group editor for product management."
```

---

### Task 10: Motivation Group Editor — Product Picker

**Files:**
- Create: `src/app/(dashboard)/settings/motivation-groups/[id]/page.tsx`
- Create: `src/app/(dashboard)/settings/motivation-groups/[id]/editor-client.tsx`

- [ ] **Step 1: Create server page**

```typescript
// page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationGroup } from "@/actions/motivation-groups"
import { EditorClient } from "./editor-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function MotivationGroupEditorPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.groups.manage")
  if (!hasAccess) redirect("/")

  const group = await getMotivationGroup(id)

  return <EditorClient group={group} />
}
```

- [ ] **Step 2: Create editor client**

Create `editor-client.tsx` with:
- Header: group name and code (editable)
- Product list: table showing currently assigned products (name, SKU, category)
- Remove button per product row
- "Добавить товары" button → dialog with search input
  - Search calls `searchProductsForGroup` with debounce
  - Results show product name, SKU, category, current group (if any)
  - Products in another group shown with warning badge
  - Checkbox selection, "Добавить" button
  - Calls `addProductsToGroup` with selected IDs
- Use `useTransition` for loading states

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/motivation-groups/\[id\]/
git commit -m "feat(motivation): add motivation group editor with product picker

Product list with remove, search dialog with group conflict warnings.
Products auto-moved from other groups when added."
```

---

### Task 11: Motivation Schemes — Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/motivation-schemes/page.tsx`
- Create: `src/app/(dashboard)/settings/motivation-schemes/motivation-schemes-client.tsx`

- [ ] **Step 1: Create server page**

```typescript
// page.tsx — same pattern as motivation groups page
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationSchemes } from "@/actions/motivation-schemes"
import { MotivationSchemesClient } from "./motivation-schemes-client"

export default async function MotivationSchemesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.schemes.manage")
  if (!hasAccess) redirect("/")

  const schemes = await getMotivationSchemes()

  return <MotivationSchemesClient initialSchemes={schemes} />
}
```

- [ ] **Step 2: Create client component**

Create `motivation-schemes-client.tsx` with:
- Table: name, status (badge with color), store, assigned count, created by
- Status badge colors: ACTIVE=green, PENDING_APPROVAL=yellow, ARCHIVED=gray
- "Создать схему" button → dialog with name + store selector
  - On create, initializes with default formula: `{ dailyRate: 1000, commissionRules: [], defaultCommission: { rate: 0.10, basis: "PROFIT" }, crossSellBonuses: [{ minItems: 2, bonus: 200 }, { minItems: 3, bonus: 400 }, { minItems: 4, bonus: 600 }], repairBonus: 300 }`
- Click row → navigate to `/settings/motivation-schemes/[id]`
- Archive button for active schemes
- For PENDING_APPROVAL: "Подтвердить" / "Отклонить" buttons (shown only if user has approve permission)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/motivation-schemes/
git commit -m "feat(motivation): add motivation schemes settings page

Table with status badges, create dialog, archive action.
Approve/reject buttons for pending schemes."
```

---

### Task 12: Motivation Scheme Editor

**Files:**
- Create: `src/app/(dashboard)/settings/motivation-schemes/[id]/page.tsx`
- Create: `src/app/(dashboard)/settings/motivation-schemes/[id]/editor-client.tsx`
- Create: `src/components/motivation/commission-rules-editor.tsx`
- Create: `src/components/motivation/cross-sell-editor.tsx`
- Create: `src/components/motivation/assignment-manager.tsx`

- [ ] **Step 1: Create server page**

```typescript
// page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationScheme } from "@/actions/motivation-schemes"
import { getMotivationGroups } from "@/actions/motivation-groups"
import { EditorClient } from "./editor-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function MotivationSchemeEditorPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.schemes.manage")
  if (!hasAccess) redirect("/")

  const [scheme, groups] = await Promise.all([
    getMotivationScheme(id),
    getMotivationGroups(),
  ])

  return <EditorClient scheme={scheme} groups={groups} />
}
```

- [ ] **Step 2: Create commission rules editor component**

`src/components/motivation/commission-rules-editor.tsx`:
- Table with columns: Group (dropdown of motivation groups), Rate (% input), Basis (dropdown: Прибыль/Розница)
- "Добавить правило" button adds a new row
- Delete button per row
- Default commission shown separately (not deletable)
- Props: `rules`, `defaultCommission`, `groups`, `onChange`

- [ ] **Step 3: Create cross-sell editor component**

`src/components/motivation/cross-sell-editor.tsx`:
- Table: Min items (number input), Bonus (number input)
- "Добавить порог" button
- Delete button per row
- Sorted by minItems ascending
- Props: `bonuses`, `onChange`

- [ ] **Step 4: Create assignment manager component**

`src/components/motivation/assignment-manager.tsx`:
- List of current assignments: employee name, store, start date, end date
- "Назначить" button → dialog:
  - Store selector (dropdown)
  - Employee selector (dropdown, filtered by store via `getStoreEmployees`)
  - Start date picker
  - End date picker (optional)
- "Завершить" button per assignment → sets endDate to today
- Props: `schemeId`, `assignments`

- [ ] **Step 5: Create editor client**

`editor-client.tsx`:
- Tabs: "Формула" | "Назначения"
- Formula tab:
  - Daily rate input
  - CommissionRulesEditor component
  - CrossSellEditor component
  - Repair bonus input
  - "Сохранить" button → calls `updateMotivationScheme`
- Assignments tab:
  - AssignmentManager component
- Read-only mode if scheme status is ARCHIVED

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/settings/motivation-schemes/\[id\]/ src/components/motivation/
git commit -m "feat(motivation): add scheme editor with formula constructor

Commission rules editor, cross-sell editor, assignment manager.
Tabbed interface: Formula + Assignments. Auto-save on change."
```

---

## Chunk 5: UI — Dashboards and Navigation

### Task 13: Management Dashboard

**Files:**
- Create: `src/app/(dashboard)/motivation/page.tsx`
- Create: `src/app/(dashboard)/motivation/motivation-dashboard-client.tsx`

- [ ] **Step 1: Create server page**

```typescript
// page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { MotivationDashboardClient } from "./motivation-dashboard-client"

export default async function MotivationPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.payroll.view")
  if (!hasAccess) redirect("/my/motivation")

  return <MotivationDashboardClient />
}
```

- [ ] **Step 2: Create management dashboard client**

`motivation-dashboard-client.tsx`:
- **Controls:** Store selector (from useCurrentStore), period selector (date range, defaults to current month)
- **Summary cards:** total payroll, employees count, avg earnings
- **Employee table:** name, shifts, daily total, commissions, cross bonuses, repair bonuses, returns, total
  - Click row → expandable detail or dialog with full breakdown
- **Action buttons:**
  - "Рассчитать аванс" → dialog: select employees, enter shifts count per employee, period (1st–15th), generate
  - "Рассчитать зарплату" → dialog: select employees, enter shifts count, period (full month), generate
- **Payroll history section:**
  - Table of generated payrolls: employee, period, type (advance/settlement), status, total
  - Status buttons: Confirm (DRAFT→CONFIRMED), Pay (CONFIRMED→PAID)
  - Delete button for DRAFT payrolls

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/motivation/page.tsx src/app/\(dashboard\)/motivation/motivation-dashboard-client.tsx
git commit -m "feat(motivation): add management dashboard

Store/period selectors, employee earnings table, payroll generation
dialogs for advance and settlement. Payroll history with status management."
```

---

### Task 14: Employee Dashboard

**Files:**
- Create: `src/app/(dashboard)/my/motivation/page.tsx`
- Create: `src/app/(dashboard)/my/motivation/my-motivation-client.tsx`
- Create: `src/components/motivation/earnings-breakdown.tsx`

- [ ] **Step 1: Create server page**

```typescript
// page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { MyMotivationClient } from "./my-motivation-client"

export default async function MyMotivationPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.payroll.own")
  if (!hasAccess) redirect("/")

  return <MyMotivationClient />
}
```

- [ ] **Step 2: Create earnings breakdown component**

`src/components/motivation/earnings-breakdown.tsx`:
- Reusable component for both management and employee views
- Props: `earnings` (EarningsResult type from calculation engine)
- Sections:
  - **Ставка:** N смен × X₽ = total (card)
  - **Комиссии:** collapsible list of sales, each expandable to show items with commission per item
  - **Кросс-продажи:** table of qualifying sales: sale number, items count, bonus
  - **Ремонты:** table of completed repairs: number, date, bonus
  - **Возвраты:** table of returns with negative commission
  - **Итого:** bold total card

- [ ] **Step 3: Create employee dashboard client**

`my-motivation-client.tsx`:
- Uses `useCurrentStore` for store context
- Period selector (defaults to current month)
- **Header cards:** total earned, shifts, sales count
- **EarningsBreakdown** component with real-time data from `getMyEarnings`
- Auto-refreshes on period/store change

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/my/motivation/ src/components/motivation/earnings-breakdown.tsx
git commit -m "feat(motivation): add employee motivation dashboard

Real-time earnings view with full breakdown: commissions per item,
cross-sell bonuses, repair bonuses, return deductions."
```

---

### Task 15: Navigation Updates

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/settings/settings-nav.tsx`

- [ ] **Step 1: Add "Мотивация" to sidebar**

In `app-sidebar.tsx`, add to nav items:

```typescript
{
  title: "Мотивация",
  href: "/motivation",
  icon: Award,
  requiredPermissions: ["motivation.payroll.own"],
},
```

Import `Award` from `lucide-react`.

Note: The page `/motivation` redirects to `/my/motivation` for non-managers, so this single nav item works for all roles.

Additionally, wire the pending scheme count badge:
- Import and call `getPendingSchemeCount()` from `@/actions/motivation-schemes` in the sidebar server component (or via a client-side fetch)
- Show a notification badge (small red circle with count) next to "Мотивация" if count > 0
- Only visible to users with `motivation.schemes.approve` permission (the function already checks this)

- [ ] **Step 2: Add settings items to settings-nav.tsx**

Add two new items:

```typescript
{
  title: "Мотивационные группы",
  href: "/settings/motivation-groups",
  icon: FolderTree,
  permission: "motivation.groups.manage",
},
{
  title: "Схемы мотивации",
  href: "/settings/motivation-schemes",
  icon: Calculator,
  permission: "motivation.schemes.manage",
},
```

Import `FolderTree` and `Calculator` from `lucide-react`.

- [ ] **Step 3: Verify navigation**

Run dev server, log in as owner:
- "Мотивация" appears in sidebar → click → opens management dashboard
- Settings → "Мотивационные группы" appears → click → opens groups page
- Settings → "Схемы мотивации" appears → click → opens schemes page

Log in as seller:
- "Мотивация" appears → click → opens personal dashboard (redirected from /motivation)
- Settings → motivation items NOT visible

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/settings/settings-nav.tsx
git commit -m "feat(motivation): add navigation items

Sidebar: 'Мотивация' section with Award icon.
Settings: 'Мотивационные группы' and 'Схемы мотивации' items."
```

---

### Task 16: Seed Default Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add default motivation groups and scheme to seed**

Add after the permissions/roles section:

```typescript
// --- Motivation Groups ---
const motivationGroups = [
  { code: "ТехОсн", name: "Техника основная (Samsung, прочие)" },
  { code: "IPhCтр", name: "iPhone SE/11/12/13" },
  { code: "ТехОсн2", name: "iPhone остальные" },
  { code: "МакСтр", name: "iMac/MacBook Pro старые" },
  { code: "ТехОсн3", name: "MacBook, iPad, iMac Pro топы, приставки, AirPods, PS5, Watch, Dyson" },
  { code: "ПортА", name: "Портативная техника Apple" },
  { code: "АксПрем", name: "Аксессуары Премиум (>4000)" },
  { code: "Акс", name: "Аксессуары не премиум (<4000)" },
  { code: "КомпИгр", name: "Комплектующие к игровым приставкам" },
  { code: "Ориг", name: "Оригинальные аксессуары" },
  { code: "Экран", name: "Стёкла/Плёнки" },
  { code: "ПортТ", name: "Портативная техника (не Apple)" },
  { code: "СОКред", name: "Сервисное обслуживание (Кредит/Халва)" },
  { code: "СОНал", name: "Сервисное обслуживание (Наличные/Карта/QR)" },
  { code: "УслугиН", name: "Услуги/Настройка устройства" },
]

for (const mg of motivationGroups) {
  await db.motivationGroup.upsert({
    where: { code: mg.code },
    update: { name: mg.name },
    create: mg,
  })
}

// --- Default Motivation Scheme ---
const defaultFormula = {
  dailyRate: 1000,
  commissionRules: [], // Will be populated after groups are created with their IDs
  defaultCommission: { rate: 0.14, basis: "PROFIT" },
  crossSellBonuses: [
    { minItems: 2, bonus: 200 },
    { minItems: 3, bonus: 400 },
    { minItems: 4, bonus: 600 },
  ],
  repairBonus: 300,
}

// Create commission rules with actual group IDs
const allGroups = await db.motivationGroup.findMany()
const groupByCode = new Map(allGroups.map((g) => [g.code, g.id]))

const commissionRules = [
  { code: "ТехОсн", rate: 0.14, basis: "PROFIT" },
  { code: "IPhCтр", rate: 0.20, basis: "PROFIT" },
  { code: "ТехОсн2", rate: 0.14, basis: "PROFIT" },
  { code: "МакСтр", rate: 0.17, basis: "PROFIT" },
  { code: "ТехОсн3", rate: 0.14, basis: "PROFIT" },
  { code: "ПортА", rate: 0.80, basis: "PROFIT" },
  { code: "АксПрем", rate: 0.08, basis: "PROFIT" },
  { code: "Акс", rate: 0.10, basis: "RETAIL_PRICE" },
  { code: "КомпИгр", rate: 0.20, basis: "PROFIT" },
  { code: "Ориг", rate: 0.14, basis: "PROFIT" },
  { code: "Экран", rate: 0.15, basis: "RETAIL_PRICE" },
  { code: "ПортТ", rate: 0.10, basis: "PROFIT" },
  { code: "СОКред", rate: 0.20, basis: "RETAIL_PRICE" },
  { code: "СОНал", rate: 0.40, basis: "RETAIL_PRICE" },
  { code: "УслугиН", rate: 0.30, basis: "RETAIL_PRICE" },
].map((r) => ({
  groupId: groupByCode.get(r.code)!,
  rate: r.rate,
  basis: r.basis,
}))

const sellerSchemeFormula = { ...defaultFormula, commissionRules }

const ownerUser = await db.user.findFirst({ where: { username: "owner" } })

if (ownerUser) {
  await db.motivationScheme.upsert({
    where: { id: "default-seller-scheme" },
    update: { formula: sellerSchemeFormula as unknown as Record<string, unknown> },
    create: {
      id: "default-seller-scheme",
      name: "Продавец стандарт",
      description: "Стандартная схема мотивации для продавцов",
      formula: sellerSchemeFormula as unknown as Record<string, unknown>,
      createdById: ownerUser.id,
      status: "ACTIVE",
    },
  })
}
```

- [ ] **Step 2: Run seed**

```bash
cd astore-erp && npx prisma db seed
```

Expected: 15 motivation groups created, 1 default scheme created.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(motivation): seed default motivation groups and seller scheme

15 groups matching the real commission table. Default seller scheme
with all commission rules, cross-sell bonuses, and repair bonus."
```
