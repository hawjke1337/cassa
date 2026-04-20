# Phase 14: Payroll & Employee Dashboard - Research

**Researched:** 2026-04-13
**Domain:** Per-item commission fix, payroll history UI, shift-grouped breakdown
**Confidence:** HIGH

## Summary

Phase 14 focuses on three distinct areas: (1) fixing the per-item commission bug for CustomOrder-based sales where commission is calculated from total netProfit instead of per-item margins, (2) adding a payroll history table to the employee dashboard with filtering and PDF download, and (3) grouping the commission breakdown by shifts with collapsible sections.

The codebase is well-structured for this work. The existing `calculateEarnings` function already returns per-sale commission data with items, and `Sale.shiftId` provides the shift linkage needed for grouping. The `EarningsBreakdown` component is a good base for the shift-grouped view. The `Payroll` model already stores all needed data including `breakdown` JSON with full earnings details.

**Primary recommendation:** Fix `orderItemCommissionDec` to calculate per-item (not total netProfit), add `getMyPayrolls` server action scoped to session user, build shift-grouped accordion in the existing `/my/motivation` page.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Co-seller DEFERRED** -- 99% of cases have one seller per shift, not needed now. Do NOT add coSellerId to Sale, do NOT change schema. Separate future phase.
- **PAYROLL-01**: Per-item commission bug is in orders (CustomOrder), not regular sales. `orderItemCommissionDec` receives total netProfit from `calculateNetProfit(totalAmount, discount, purchasePrice, deliveryCost)` -- this is whole-order profit. Fix: per-item calculation for orders like regular sales (sellPrice - costPrice per item).
- **PAYROLL-05**: History table in /my/motivation. Columns: period, type (advance/settlement), amount, status (draft/confirmed/paid). Click row -> breakdown (reuse EarningsBreakdown). PDF download from table.
- **PAYROLL-03/04**: Commission breakdown grouped by shifts (collapsible sections). Each shift: date, sales count, total commission. Expands to list of sales with items: product, price, profit, %, commission amount.
- **PAYROLL-06**: Employee sees ONLY own data (userId from session). storeId scope: only assigned stores. Existing `checkPermission("motivation.payroll.own")` already works.

### Claude's Discretion
- Exact layout of history table and collapsible sections
- Sorting and pagination of history
- Empty state handling

### Deferred Ideas (OUT OF SCOPE)
- **Co-seller (PAYROLL-02)** -- multiple sellers per sale, commission split. Deferred: 99% single seller.
- **Custom payment methods** -- CRUD, fees, names (recorded in memory).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAYROLL-01 | Order commission per-item (not total netProfit per item) | Bug identified in `orderItemCommissionDec` -- receives whole-order netProfit instead of per-item profit. CustomOrderItem has `costPrice` field (nullable). Fix: use item.costPrice and item.price for per-item profit. |
| PAYROLL-02 | Sale supports co-seller (min 2 sellerId) for split commissions | **DEFERRED** per CONTEXT.md. Do NOT implement. |
| PAYROLL-03 | Employee dashboard /my/payroll -- sales by stores and shifts | Sale.shiftId already links sales to shifts. Shift model has openedAt, closedAt, number. Group commissions array by sale.shiftId. |
| PAYROLL-04 | Commission breakdown: product, price, profit, % -> amount | EarningsBreakdown component already shows this per-sale. Extend to show within shift accordion. |
| PAYROLL-05 | Payroll history by months in employee dashboard | Need `getMyPayrolls` server action (scoped to session user). Payroll model has all needed fields. Reuse EarningsBreakdown for detail view. |
| PAYROLL-06 | Employee sees ONLY own data (storeId scope) | `requirePermission("motivation.payroll.own")` + session userId filtering. `getMyEarnings` already does this. New `getMyPayrolls` must follow same pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App framework | Project standard |
| Prisma | 7 | ORM | Project standard |
| shadcn/ui | latest | UI components | Project standard (Accordion, Table, Badge, Button) |
| Tailwind CSS | 4 | Styling | Project standard |
| @react-pdf/renderer | existing | PDF generation | Already used for payroll PDFs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons | ChevronDown/Right for accordions |
| sonner | existing | Toast notifications | Error handling |
| Decimal.js | existing (via Prisma) | Precision arithmetic | All money calculations via `@/lib/money.ts` |

No new libraries needed. Everything builds on existing infrastructure.

## Architecture Patterns

### Recommended File Structure
```
src/
  actions/
    motivation-calculation.ts  # FIX orderItemCommissionDec (PAYROLL-01)
    motivation-payroll.ts      # ADD getMyPayrolls (PAYROLL-05, PAYROLL-06)
  app/(dashboard)/my/motivation/
    my-motivation-client.tsx   # ADD payroll history + shift-grouped breakdown
  components/motivation/
    earnings-breakdown.tsx     # EXTEND with shift grouping (PAYROLL-03/04)
    payroll-history.tsx        # NEW: payroll history table (PAYROLL-05)
  __tests__/e2e/
    order-commission-peritem.e2e.test.ts  # NEW: PAYROLL-01 regression
```

### Pattern 1: Per-Item Commission Fix (PAYROLL-01)
**What:** The bug is in `orderItemCommissionDec` and its caller in `calculateEarningsWithFormula`. Currently:
1. `calculateNetProfit(totalAmount, discount, purchasePrice, deliveryCost)` computes WHOLE ORDER profit
2. This single number is passed to `orderItemCommissionDec` for EVERY item
3. Commission = `netProfit * rate` -- same total profit applied to each item

**The fix:** For order-based sales, iterate CustomOrderItems and compute per-item profit: `item.price - item.costPrice` (like regular sales use `item.price - item.costPrice`).

**Critical detail:** `CustomOrderItem.costPrice` is `Decimal?` (nullable). When null, fall back to proportional allocation of `CustomOrder.purchasePrice` across items by revenue share, or treat as zero-profit (safer).

**Example fix approach:**
```typescript
// INSTEAD of using whole-order netProfit for each item:
if (orderData && sale.customOrder) {
  // Load order items with their individual costPrice
  const orderItems = await db.customOrderItem.findMany({
    where: { orderId: sale.customOrder.id },
  })
  // Map SaleItem -> OrderItem by productId to get per-item costPrice
  // Use item-level costPrice for commission calc
}
```

**Wait -- check the actual data flow:** When a CustomOrder is completed via `completeOrder`, it creates a Sale with SaleItems. The SaleItem.costPrice is populated from StoreProduct.costPrice (the store's cost price), NOT from CustomOrderItem.costPrice. And CustomOrder.purchasePrice is the wholesale purchase price for the entire order from the supplier.

So the bug is: `orderItemCommissionDec` gets the ORDER-level netProfit (totalAmount - discount - purchasePrice - deliveryCost) and applies it as the profit base for EVERY item. If the order has 3 items, each item's commission is calculated on the FULL order profit, not 1/3 of it.

**Correct fix:** Use SaleItem.costPrice (already populated) for per-item profit, same as regular sales. The `orderItemCommissionDec` function should work like `itemCommissionDec`: `sellPrice - costPrice` per item. The special `calculateNetProfit` path is the bug.

### Pattern 2: Shift-Grouped Breakdown (PAYROLL-03/04)
**What:** Group the flat `commissions[]` array by `sale.shiftId`
**When to use:** In the EarningsBreakdown component

The data flow:
1. `calculateEarnings` already fetches sales with `sale.shiftId` (Sale model has it)
2. BUT the current `SaleCommission` interface does NOT include `shiftId`
3. Need to add `shiftId` and shift metadata (date, number) to `SaleCommission`
4. Client-side: group commissions by shiftId, render as accordion

```typescript
// Extend SaleCommission interface:
interface SaleCommission {
  saleId: string
  saleNumber: string
  date: string
  shiftId: string | null     // ADD
  shiftDate: string | null   // ADD (from shift.openedAt)
  shiftNumber: string | null // ADD (from shift.number)
  items: SaleCommissionItem[]
  totalCommission: number
}
```

### Pattern 3: Payroll History Table (PAYROLL-05)
**What:** New `getMyPayrolls` server action + PayrollHistory component
**Key insight:** Current `getPayrolls` requires `motivation.payroll.view` (manager permission). Employee page uses it and catches the error silently. Need proper `getMyPayrolls` with `motivation.payroll.own` permission and userId filter.

```typescript
// New server action:
export async function getMyPayrolls(storeId: string) {
  await requirePermission("motivation.payroll.own")
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authorized")
  
  return db.payroll.findMany({
    where: {
      userId: session.user.id, // ONLY own data
      storeId,
    },
    orderBy: { periodStart: "desc" },
    // ... select needed fields
  })
}
```

### Anti-Patterns to Avoid
- **Using whole-order netProfit for per-item commission** -- this IS the current bug (PAYROLL-01)
- **Calling getPayrolls from employee page** -- requires manager permission, should use getMyPayrolls
- **Number arithmetic for money** -- all calculations through `@/lib/money.ts` (sum, mul, sub)
- **Passing rate as number to Decimal** -- use string literals for rates to avoid float precision issues

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sections | Custom accordion | shadcn/ui Accordion or existing SectionHeader pattern | Already used in EarningsBreakdown |
| Money formatting | Custom formatter | Existing `formatMoney` (Intl.NumberFormat) | Consistent across app |
| PDF generation | Custom PDF | Existing PayrollPdfDocument | Already works, just needs data |
| Permission checking | Custom auth logic | `requirePermission` / `checkPermission` | Standardized pattern |
| Decimal arithmetic | Number math | `@/lib/money.ts` helpers | Precision-safe, project mandate |

## Common Pitfalls

### Pitfall 1: OrderItemCommission with Whole-Order Profit
**What goes wrong:** Each item in a multi-item order gets commission calculated on the FULL order profit, inflating total commission by N items.
**Why it happens:** `calculateNetProfit` returns a single number for the whole order, and `orderItemCommissionDec` applies it to each item without dividing.
**How to avoid:** Use `itemCommissionDec` (regular sale path) for order sales too -- SaleItem already has `price` and `costPrice`.
**Warning signs:** Commission total for a 3-item order is 3x what it should be.

### Pitfall 2: Nullable CustomOrderItem.costPrice
**What goes wrong:** CustomOrderItem.costPrice can be null (supplier price unknown at order time).
**Why it happens:** Order is placed before supplier confirms price.
**How to avoid:** When using per-item approach with SaleItem.costPrice (which comes from StoreProduct), this is less of an issue -- SaleItem.costPrice is NOT NULL in schema. But verify the completeOrder flow actually populates it correctly.

### Pitfall 3: getPayrolls Permission Mismatch
**What goes wrong:** Employee calls `getPayrolls` (requires `motivation.payroll.view`), gets permission error silently caught.
**Why it happens:** No separate `getMyPayrolls` endpoint exists.
**How to avoid:** Create dedicated `getMyPayrolls` with `motivation.payroll.own` permission and strict userId scoping.

### Pitfall 4: Sales Without Shift
**What goes wrong:** Some sales may have `shiftId = null` (edge case: admin sales, seed data, etc.).
**Why it happens:** Sale.shiftId is optional in schema (`Shift?`).
**How to avoid:** Group null-shiftId sales into an "Outside shifts" category in the breakdown.

### Pitfall 5: Decimal->Number Round-Trip in Commissions
**What goes wrong:** Converting Decimal to Number and back accumulates float errors.
**Why it happens:** The interface returns `commission: number` but internal calc uses Decimal.
**How to avoid:** Keep Decimal throughout calculation, only convert at the final display boundary. Use `commissionTotalsDec` pattern already in the codebase.

## Code Examples

### Current Bug (PAYROLL-01) -- Lines 332-359 of motivation-calculation.ts
```typescript
// CURRENT (BUGGY): netProfit is WHOLE ORDER profit, applied to EVERY item
const orderNetProfit = orderData
  ? calculateNetProfit(
      orderData.totalAmount.toNumber(),
      sale.discountAmount.toNumber(),
      orderData.purchasePrice !== null ? orderData.purchasePrice.toNumber() : null,
      orderData.deliveryCost !== null ? orderData.deliveryCost.toNumber() : null,
    )
  : undefined

// Each item gets: orderItemCommissionDec(orderNetProfit, ...) 
// orderNetProfit is SAME total for all items -> over-counting
```

### Fix: Use Per-Item Profit (like regular sales)
```typescript
// FIXED: For order-based sales, use the same per-item approach as regular sales.
// SaleItem.costPrice is populated from StoreProduct.costPrice when completeOrder creates the sale.
// So we can use itemCommissionDec (regular path) for ALL sales:
commissionDec = itemCommissionDec(
  item.price,      // sell price
  item.costPrice,  // per-item cost (from StoreProduct)
  item.quantity,
  rule.rate,
  rule.basis,
  rule.type,
)
```

**Important verification needed:** Confirm that `completeOrder` actually sets `SaleItem.costPrice` from `StoreProduct.costPrice` for order-based sales. If it uses a different source (or sets 0), the fix approach changes.

### Adding Shift Data to Commissions
```typescript
// In calculateEarningsWithFormula, the Sale query already includes shift via shiftId
// Just need to extend the query to include shift data:
const sales = await db.sale.findMany({
  where: { ... },
  include: {
    ...existing,
    shift: { select: { id: true, number: true, openedAt: true } }, // ADD
  },
})

// Then in the commission mapping:
commissions.push({
  ...existing,
  shiftId: sale.shiftId,
  shiftDate: sale.shift?.openedAt?.toISOString() ?? null,
  shiftNumber: sale.shift?.number ?? null,
})
```

### getMyPayrolls Server Action
```typescript
export async function getMyPayrolls(storeId: string) {
  await requirePermission("motivation.payroll.own")
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const payrolls = await db.payroll.findMany({
    where: {
      userId: session.user.id,
      storeId,
    },
    include: {
      scheme: { select: { name: true } },
    },
    orderBy: { periodStart: "desc" },
  })

  return payrolls.map((p) => ({
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    isAdvance: p.isAdvance,
    totalAmount: Number(p.totalAmount),
    status: p.status,
    schemeName: p.scheme.name,
    breakdown: p.breakdown,
  }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Number-based commission calc | Decimal-safe via money.ts | Phase 7 (v1.1) | All money ops must use Decimal |
| `calculateOrderItemCommission` (number) | `orderItemCommissionDec` (Decimal) | Phase 7 | But still has the per-item bug |
| Manager getPayrolls for employee view | Needs dedicated getMyPayrolls | Phase 14 (now) | Permission scoping fix |

## Open Questions

1. **SaleItem.costPrice for order-based sales**
   - What we know: SaleItem.costPrice is NOT NULL (Decimal, required by schema). `completeOrder` creates SaleItems when completing an order.
   - What's unclear: Does `completeOrder` set costPrice from StoreProduct.costPrice or from CustomOrderItem.costPrice or from something else?
   - Recommendation: Read `completeOrder` implementation to verify. If costPrice comes from StoreProduct, the fix is straightforward (use `itemCommissionDec` for all sales). If it's 0 or unset, need a different approach.

2. **Order-level purchasePrice vs per-item costPrice**
   - What we know: CustomOrder has `purchasePrice` (total supplier cost). CustomOrderItem has `costPrice` (nullable, per-item). SaleItem has `costPrice` (from StoreProduct).
   - What's unclear: The business intent -- should commission be on StoreProduct margin (sellPrice - storeProductCostPrice) or on order margin (totalAmount - purchasePrice)?
   - Recommendation: Use SaleItem.costPrice (per-item, from StoreProduct) for consistency with regular sales. The order-level purchasePrice/deliveryCost is supplier-facing and may not reflect per-item margins.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts, projects: unit + e2e) |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAYROLL-01 | Per-item commission for orders (not total netProfit) | e2e | `pnpm vitest run src/__tests__/e2e/order-commission-peritem.e2e.test.ts -x` | Wave 0 |
| PAYROLL-02 | Co-seller (DEFERRED) | -- | -- | N/A |
| PAYROLL-03 | Shift-grouped breakdown data | unit | `pnpm vitest run src/__tests__/shift-grouped-earnings.test.ts -x` | Wave 0 |
| PAYROLL-04 | Commission detail: product, price, profit, %, amount | unit | Already covered by existing `motivation-precision.e2e.test.ts` | Existing |
| PAYROLL-05 | getMyPayrolls returns own payrolls only | e2e | `pnpm vitest run src/__tests__/e2e/payroll-employee.e2e.test.ts -x` | Wave 0 |
| PAYROLL-06 | Employee sees ONLY own data | e2e | Same as PAYROLL-05 (scope test within same file) | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/__tests__/e2e/order-commission-peritem.e2e.test.ts src/__tests__/e2e/payroll-employee.e2e.test.ts -x`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/e2e/order-commission-peritem.e2e.test.ts` -- covers PAYROLL-01 (per-item vs total order profit)
- [ ] `src/__tests__/e2e/payroll-employee.e2e.test.ts` -- covers PAYROLL-05, PAYROLL-06 (own data scope, history)
- [ ] `src/__tests__/shift-grouped-earnings.test.ts` -- covers PAYROLL-03 (shift grouping logic)

## Sources

### Primary (HIGH confidence)
- `src/actions/motivation-calculation.ts` -- full read, bug identified at lines 332-359
- `src/actions/motivation-payroll.ts` -- full read, getPayrolls permission issue identified
- `src/components/motivation/earnings-breakdown.tsx` -- full read, reusable accordion pattern
- `src/app/(dashboard)/my/motivation/my-motivation-client.tsx` -- full read, current employee UI
- `prisma/schema.prisma` -- Sale (shiftId), SaleItem (costPrice NOT NULL), CustomOrder (purchasePrice), CustomOrderItem (costPrice nullable), Payroll, Shift models
- `src/lib/order-utils.ts` -- calculateNetProfit (source of the bug -- returns whole-order profit)
- `src/lib/money.ts` -- Decimal-safe arithmetic helpers

### Secondary (MEDIUM confidence)
- `src/__tests__/order-commission.test.ts` -- existing unit tests for order commission (tests the old number-based function)
- `src/__tests__/e2e/motivation-precision.e2e.test.ts` -- e2e test patterns for motivation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- bug location precisely identified, fix approach clear
- Pitfalls: HIGH -- analyzed actual code, identified real issues (permission mismatch, nullable fields, shiftId null)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain, internal codebase)
