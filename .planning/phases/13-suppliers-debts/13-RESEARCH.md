# Phase 13: Suppliers & Debts - Research

**Researched:** 2026-04-12
**Domain:** Supplier debt management, partial payments, CashOperation integration
**Confidence:** HIGH

## Summary

Phase 13 transforms the existing simple "mark as paid" supplier debt system into a full partial payment workflow with audit trail. The core change is introducing a new `SupplierPayment` model that tracks individual payments against a debt, creating `CashOperation(WITHDRAW, shiftId=null)` entries for each payment. This requires making `CashOperation.shiftId` nullable (currently NOT NULL FK) since debt payments are administrative operations performed outside of POS shifts.

The existing codebase already has substantial infrastructure: `SupplierDebt` model, `markSupplierDebtPaid` action (needs refactoring), `updateOrderCosts` action (already updates debt amount), `SupplierDebtsClient` component with filters, and `getSupplierDebtsReport` server action. The work is primarily refactoring existing code and adding new UI sections, not building from scratch.

**Primary recommendation:** Start with the schema migration (SupplierPayment model + CashOperation.shiftId nullable), then refactor `markSupplierDebtPaid` into partial payment logic, then update UI components, then add dashboard card and E2E tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- markSupplierDebtPaid creates **SupplierPayment** + **CashOperation(WITHDRAWAL, shiftId=null)** -- administrative operation without open shift
- **Partial payments**: operator enters amount, debt closes when sum(payments) >= debt.amount
- New permission: `suppliers.pay` (separate from orders.manage)
- **AlertDialog** before payment: shows amount, remaining, comment field
- New model **SupplierPayment**: (debtId, amount, paidAt, comment, cashOperationId?, userId)
- isPaid on SupplierDebt: computed from sum(payments) >= amount, updated automatically after each payment
- purchasePrice entered **AFTER COMPLETED** (no blocking of ORDERED transition)
- Debt created from **costPrice * qty** at ORDERED (existing behavior), updated when purchasePrice entered via updateOrderCosts
- purchasePrice is per **whole order** (not per-item) -- Phase 4 decision preserved
- If purchasePrice not entered: profit shows "He paccuumana" (grey text)
- Debt amount update via **updateOrderCosts** (permission orders.manage_costs) -- auto-updates debt.amount
- If part of debt already paid and amount changes: remaining = newAmount - sum(payments). If remaining <= 0, debt auto-closes
- Three amounts in order card: **Price for client / Purchase / Profit** -- visible only with permission **orders.costs**
- Supplier city pulled from **Supplier.city** (not stored in order), displayed in UI
- Debts page in **both places**: /reports/supplier-debts (exists) + /suppliers/debts (new)
- Navigation: **sub-item "Dolgi"** in "Suppliers" section in sidebar
- Dashboard card: "Dolgi postavshchikam: X rub (N neoplachennyh)" -- visible only with **orders.costs**
- Payment history in supplier card: **SupplierPayment[] table** (date, amount, order #, comment)
- **Audit log** via createAuditEntry on: debt payment, debt amount change, debt creation
- E2E tests: payment -> SupplierPayment + CashOperation(WITHDRAWAL, shiftId=null); two partial payments -> debt closes; amount update after partial payment -> remaining recalculated; order cancellation with partially paid debt -> correct cleanup

### Claude's Discretion
- Exact layout of debt card on /suppliers/debts page
- Pagination vs infinite scroll on /suppliers/debts
- Comment format for payment (free text or presets)
- Whether to group debts by supplier on /suppliers/debts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUP-01 | SupplierDebt created from purchasePrice (not totalAmount/sellPrice) | Debt currently created from costPrice*qty at ORDERED. Updated when purchasePrice entered via updateOrderCosts. No blocking of ORDERED -- per CONTEXT.md override |
| SUP-02 | purchasePrice required for ORDERED transition | **OVERRIDDEN by CONTEXT.md**: purchasePrice entered AFTER COMPLETED, NOT required for ORDERED. No blocking. |
| SUP-03 | Order card shows: Client price / Purchase / Profit separately | order-detail.tsx already shows purchasePrice/deliveryCost/profit but needs restructuring into three clear lines. Permission: orders.costs |
| SUP-04 | Supplier city auto-filled from Supplier.city at ORDERED | Supplier.city field exists in schema. CustomOrder.supplierCity field exists. Pull from Supplier.city, display in UI |
| SUP-05 | SupplierDebt.amount can be updated | updateOrderCosts already updates debt.amount. Need to handle partial payments: remaining = newAmount - sum(payments) |
| SUP-06 | markSupplierDebtPaid creates CashOperation + SupplierPayment | Refactor from simple isPaid=true to: create SupplierPayment + CashOperation(WITHDRAW, shiftId=null). New permission suppliers.pay |
| SUP-07 | /suppliers/debts page with filters and totals | Existing SupplierDebtsClient at /reports/supplier-debts. Create new /suppliers/debts page reusing/extending components |
| SUP-08 | Dashboard card "Supplier debts: X rub (N unpaid)" | DashboardContent component exists. Add StatCard with aggregate query. Permission: orders.costs |
| SUP-09 | Payment history in supplier card | supplier-detail.tsx exists with unpaid debts display. Add SupplierPayment[] table section |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.x | ORM, schema migration, SupplierPayment model | Already used project-wide |
| Next.js | 16.x | Server actions, pages, routing | Project framework |
| shadcn/ui | latest | AlertDialog, Table, Badge, Card, StatCard | Project UI kit |
| Tailwind CSS | 4.x | Styling | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | latest | Toast notifications for payment success/errors | Already used for toasts |
| lucide-react | latest | Icons (Check, DollarSign, etc.) | Already imported project-wide |
| src/lib/money.ts | n/a | Decimal-safe money arithmetic (sum, mul, sub) | ALL money calculations |
| src/lib/audit.ts | n/a | createAuditEntry for audit logging | Debt payment, amount change, creation |

## Architecture Patterns

### Recommended Changes Structure
```
prisma/
  schema.prisma          # Add SupplierPayment model, make CashOperation.shiftId nullable
  migrations/            # New migration

src/actions/
  orders.ts              # Refactor markSupplierDebtPaid, update cancelOrderWithDecision
  reports.ts             # Update getSupplierDebtsReport (include payments)
  suppliers.ts           # Add getSupplierPaymentHistory, update getSupplier

src/lib/
  permissions-list.ts    # Add SUPPLIERS_PAY permission

src/components/
  orders/order-detail.tsx         # Update finance card (3 amounts)
  suppliers/supplier-detail.tsx   # Add payment history table
  suppliers/debt-payment-dialog.tsx  # NEW: AlertDialog for partial payment
  dashboard/dashboard-content.tsx    # Add supplier debts stat card

src/app/(dashboard)/
  suppliers/debts/page.tsx           # NEW page
  page.tsx                           # Dashboard (no change, uses DashboardContent)

src/components/layout/
  app-sidebar.tsx                    # Add "Dolgi" sub-item under "Suppliers"
```

### Pattern 1: Partial Payment with CashOperation
**What:** Each partial payment creates a SupplierPayment record + CashOperation(WITHDRAW, shiftId=null) in a single transaction. Debt isPaid flag updated when sum(payments) >= amount.
**When to use:** Every debt payment operation.
**Example:**
```typescript
// In refactored markSupplierDebtPaid (now paySupplierDebt)
await db.$transaction(async (tx) => {
  // 1. Create CashOperation (shiftId=null for administrative ops)
  const cashOp = await tx.cashOperation.create({
    data: {
      shiftId: null, // administrative operation, no shift required
      type: "WITHDRAW",
      amount: paymentAmount,
      supplierId: debt.supplierId,
      reason: `Оплата долга поставщику по заказу #${debt.order.number}`,
      performedById: userId,
    },
  })

  // 2. Create SupplierPayment
  const payment = await tx.supplierPayment.create({
    data: {
      debtId: debt.id,
      amount: paymentAmount,
      comment: comment?.trim() || null,
      cashOperationId: cashOp.id,
      userId,
    },
  })

  // 3. Check if debt is fully paid
  const totalPaid = await tx.supplierPayment.aggregate({
    where: { debtId: debt.id },
    _sum: { amount: true },
  })
  const paidSum = Number(totalPaid._sum.amount ?? 0)
  
  if (paidSum >= Number(debt.amount)) {
    await tx.supplierDebt.update({
      where: { id: debt.id },
      data: { isPaid: true, paidAt: new Date() },
    })
  }

  // 4. Audit log
  await createAuditEntry({
    action: "CREATE",
    entity: "SupplierPayment",
    entityId: payment.id,
    userId,
    storeId: debt.order.storeId,
    metadata: { debtId: debt.id, amount: paymentAmount, totalPaid: paidSum },
    tx,
  })
})
```

### Pattern 2: Debt Amount Update with Partial Payments
**What:** When purchasePrice changes via updateOrderCosts, recalculate remaining debt considering existing payments.
**Example:**
```typescript
// In updateOrderCosts, after updating debt.amount:
const totalPaid = await tx.supplierPayment.aggregate({
  where: { debtId: order.debt.id },
  _sum: { amount: true },
})
const paidSum = Number(totalPaid._sum.amount ?? 0)
const newAmount = data.purchasePrice + (data.deliveryCost ?? 0)

await tx.supplierDebt.update({
  where: { id: order.debt.id },
  data: {
    amount: newAmount,
    isPaid: paidSum >= newAmount,
    paidAt: paidSum >= newAmount ? new Date() : null,
  },
})
```

### Pattern 3: Cancel Order with Partially Paid Debt
**What:** When cancelling an order that has partial payments, delete SupplierPayments first (cascade or manual), then delete SupplierDebt. CashOperations remain for audit trail.
**Important:** Current cancel code does `tx.supplierDebt.delete()`. Must handle SupplierPayments first -- either onDelete: Cascade on FK or manual deletion.

### Anti-Patterns to Avoid
- **Using Payment table for supplier payments:** CONTEXT.md explicitly says SupplierPayment is a separate table to avoid breaking CHECK constraints from Phase 15.
- **Requiring open shift for debt payment:** Debt payment is administrative, CashOperation.shiftId=null.
- **Using createCashOperation action directly:** That function requires shiftId and validates shift is OPEN. Debt payments must create CashOperation records directly in the transaction.
- **Blocking ORDERED without purchasePrice:** CONTEXT.md overrides the original requirement. No blocking.
- **Using Number() on Decimal fields:** Use money.ts helpers (sum, mul, sub) for all money arithmetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Money arithmetic | parseFloat/Number() math | src/lib/money.ts (sum, mul, sub) | Decimal precision -- project standard since Phase 7 |
| Audit logging | Custom logging | createAuditEntry from src/lib/audit.ts | Phase 12 infrastructure, consistent format |
| Rate limiting | Custom throttle | checkWriteRateLimit from src/lib/rate-limit.ts | Phase 12 infrastructure |
| Permission checks | Custom auth logic | requirePermission / checkPermission | Project standard pattern |
| Money formatting | toFixed(2) / template strings | formatMoney from src/lib/format.ts | Consistent ruble formatting |

## Common Pitfalls

### Pitfall 1: CashOperation.shiftId Migration
**What goes wrong:** Making shiftId nullable breaks existing code that assumes it's always present (e.g., shift cash reconciliation reports, getCashOperations).
**Why it happens:** Reports query CashOperations by shiftId -- null values need WHERE filtering.
**How to avoid:** 
1. Migration: ALTER COLUMN shiftId DROP NOT NULL, drop FK constraint, recreate as optional FK
2. Update reports that aggregate CashOperations: add `WHERE "shiftId" IS NOT NULL` to shift-scoped queries
3. The raw SQL in reports.ts (line ~657) filters by shiftId already, so null CashOps won't leak in
**Warning signs:** Shift reconciliation showing wrong numbers, FK constraint errors on migration

### Pitfall 2: Cancel Order with SupplierPayments
**What goes wrong:** Current cancel code does `tx.supplierDebt.delete()` (line 1387). If SupplierPayment has FK to SupplierDebt, this will fail with FK constraint error.
**Why it happens:** New SupplierPayment model references SupplierDebt.
**How to avoid:** Either set onDelete: Cascade on SupplierPayment.debtId FK, or delete payments first in cancel flow. Cascade is simpler and correct since cancelled order's payments are irrelevant.
**Warning signs:** FK violation errors when cancelling orders that have partial payments

### Pitfall 3: isPaid State Inconsistency
**What goes wrong:** isPaid becomes stale if payments are deleted or debt amount changes without recalculating.
**Why it happens:** isPaid is stored, not computed on read.
**How to avoid:** Always recalculate isPaid after ANY mutation that changes sum(payments) or debt.amount. Three mutation points: paySupplierDebt, updateOrderCosts, cancelOrder.
**Warning signs:** Debts showing as "paid" but with remaining balance, or vice versa

### Pitfall 4: Existing createCashOperation Action Validation
**What goes wrong:** Calling `createCashOperation` action for debt payments fails because it requires shiftId and validates shift is OPEN.
**Why it happens:** That function was designed for POS cash ops, not administrative operations.
**How to avoid:** Create CashOperation records directly in the transaction (raw Prisma create), not through the server action. The server action remains unchanged for POS operations.

### Pitfall 5: Supplier.city vs CustomOrder.supplierCity
**What goes wrong:** Displaying city from wrong source or duplicating data.
**Why it happens:** CustomOrder has supplierCity field (stored), but CONTEXT.md says pull from Supplier.city.
**How to avoid:** For display purposes, always join to Supplier.city. The supplierCity field on CustomOrder is legacy/redundant for this use case but should remain populated for orders without supplier.

## Code Examples

### SupplierPayment Prisma Model
```prisma
model SupplierPayment {
  id              String       @id @default(cuid())
  debt            SupplierDebt @relation(fields: [debtId], references: [id], onDelete: Cascade)
  debtId          String
  amount          Decimal      @db.Decimal(12, 2)
  comment         String?
  cashOperation   CashOperation? @relation(fields: [cashOperationId], references: [id], onDelete: SetNull)
  cashOperationId String?      @unique
  user            User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId          String
  paidAt          DateTime     @default(now())
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([debtId])
}
```

### CashOperation.shiftId Nullable Change
```prisma
model CashOperation {
  // ... existing fields ...
  shift         Shift?     @relation(fields: [shiftId], references: [id], onDelete: Restrict)
  shiftId       String?    // Was NOT NULL, now nullable for administrative operations
  // ... rest unchanged ...
}
```

### New Permission
```typescript
// In permissions-list.ts
SUPPLIERS_PAY: {
  code: "suppliers.pay",
  module: "suppliers",
  name: "Оплата долгов поставщикам",
},
```

### Dashboard Aggregate Query
```typescript
// Server action for dashboard
const supplierDebts = await db.supplierDebt.aggregate({
  where: { isPaid: false },
  _sum: { amount: true },
  _count: true,
})
```

### Sidebar Sub-item Pattern
```typescript
// In app-sidebar.tsx, modify suppliers entry to have sub-items:
{
  title: "Поставщики",
  href: "/suppliers",
  icon: Truck,
  requiredPermissions: ["suppliers.view"],
  items: [
    { title: "Все поставщики", href: "/suppliers" },
    { title: "Долги", href: "/suppliers/debts", requiredPermissions: ["orders.costs"] },
  ],
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| isPaid = true (one-shot) | SupplierPayment[] partial payments | Phase 13 | Full payment history, partial payments |
| CashOperation requires shift | shiftId nullable for admin ops | Phase 13 | Debt payments without POS shift |
| orders.manage for debt payment | suppliers.pay permission | Phase 13 | Granular access control |
| No payment audit trail | createAuditEntry on all debt mutations | Phase 13 | Full audit log |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts (projects: unit + e2e) |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUP-01 | Debt created from costPrice*qty at ORDERED | e2e | `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts -t "debt from costPrice"` | No - Wave 0 |
| SUP-02 | ORDERED allowed without purchasePrice | e2e | `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts -t "ORDERED without purchasePrice"` | No - Wave 0 |
| SUP-03 | Three amounts visible with orders.costs | manual-only | Visual UI verification | N/A |
| SUP-04 | Supplier city from Supplier.city | e2e | `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts -t "supplier city"` | No - Wave 0 |
| SUP-05 | Debt amount update with partial payments | e2e | `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts -t "amount update"` | No - Wave 0 |
| SUP-06 | Payment creates SupplierPayment + CashOperation | e2e | `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts -t "payment creates"` | No - Wave 0 |
| SUP-07 | Debts page with filters | manual-only | Visual UI verification | N/A |
| SUP-08 | Dashboard card shows totals | manual-only | Visual UI verification | N/A |
| SUP-09 | Payment history in supplier card | manual-only | Visual UI verification | N/A |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/__tests__/e2e/supplier-debts.e2e.test.ts`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `src/__tests__/e2e/supplier-debts.e2e.test.ts` -- covers SUP-01, SUP-02, SUP-04, SUP-05, SUP-06
- [ ] E2E fixture helpers for: createTestSupplier, createTestOrder (with supplier + debt), createTestShift
- [ ] Verify existing helpers in `src/__tests__/helpers/fixtures.ts` cover needed models

## Open Questions

1. **Sidebar sub-items pattern**
   - What we know: Current sidebar has flat list of items (line ~111 in app-sidebar.tsx). "Suppliers" is a single link.
   - What's unclear: Whether sidebar component supports nested sub-items or needs refactoring.
   - Recommendation: Check if sidebar uses collapsible groups (shadcn SidebarMenuSub). If not, add "Dolgi" as separate top-level item with indent, or add sub-menu support.

2. **CashOperation in shift reconciliation**
   - What we know: Reports query CashOperations filtered by shiftId. Null shiftId CashOps won't appear in shift reports.
   - What's unclear: Whether expectedCash / discrepancy calculation in auto-close-shift includes raw SQL that might be affected.
   - Recommendation: Verify shift reconciliation queries filter by shiftId (they do based on reports.ts line 657-658). Add WHERE clause if needed.

3. **Existing E2E test helpers**
   - What we know: Helpers exist in src/__tests__/helpers/fixtures.ts for createTestStore, createTestUser, createTestProduct, createTestStoreProduct.
   - What's unclear: Whether createTestSupplier and createTestCustomOrder helpers exist.
   - Recommendation: Check fixtures.ts; create missing helpers in Wave 0.

## Sources

### Primary (HIGH confidence)
- prisma/schema.prisma -- SupplierDebt model (line 655), CashOperation model (line 1149), CustomOrder (line 567), Supplier (line 400)
- src/actions/orders.ts -- markSupplierDebtPaid (line 484), updateOrderCosts (line 510), cancelOrderWithDecision (line 1287)
- src/actions/cash-operations.ts -- createCashOperation signature and validation logic
- src/actions/reports.ts -- getSupplierDebtsReport (line 731)
- src/actions/suppliers.ts -- getSupplier with unpaidDebts aggregate
- src/components/orders/order-detail.tsx -- existing finance card
- src/components/suppliers/supplier-detail.tsx -- existing unpaid debts display
- src/app/(dashboard)/reports/supplier-debts/ -- existing debts page and client component
- src/lib/permissions-list.ts -- current permission codes and role presets
- src/lib/audit.ts -- createAuditEntry interface
- src/components/layout/app-sidebar.tsx -- sidebar nav structure
- 13-CONTEXT.md -- all locked decisions

### Secondary (MEDIUM confidence)
- vitest.config.ts -- test infrastructure setup (e2e project config)
- src/__tests__/e2e/_template.e2e.test.ts -- e2e test patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extending existing patterns (server actions + Prisma transactions + shadcn UI)
- Pitfalls: HIGH -- identified from direct code inspection (FK constraints, shiftId nullable, cancel flow)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable -- internal project, no external dependency changes)
