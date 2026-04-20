# Phase 11: Repair as Sale - Research

**Researched:** 2026-04-11
**Domain:** Repair-to-Sale conversion, spare parts COGS, warranty lookup, cost audit trail
**Confidence:** HIGH

## Summary

Phase 11 converts the repair workflow into a revenue-generating process. Currently, repairs in the system track costs (estimatedCost, agreedCost, finalCost) and accept payments, but the revenue never appears in Sale-based reports or the dashboard. There is no spare parts tracking (no RepairPart model), no cost change audit trail (no RepairCostHistory model), and warranty lookup is limited to `status: "SOLD"` only for SerialUnit.

The core pattern is: when a repair transitions to DELIVERED, automatically create a Sale record (type=REPAIR) with finalCost as revenue + re-parent existing repair payments to the new Sale. Spare parts need a new RepairPart junction table that links Repair to StoreProduct with quantity and costPrice, enabling both stock decrement and COGS calculation. RepairCostHistory is a new audit table tracking all cost field changes.

**Primary recommendation:** Add SaleType.REPAIR enum value, create RepairPart and RepairCostHistory models, modify `updateRepairStatus` to create Sale on DELIVERED transition, update reports/dashboard to include repair-sourced sales naturally (they already query Sale with status=COMPLETED).

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                    | Research Support                                                                                                                  |
| --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| REPAIR-01 | При DELIVERED ремонте создается Sale с finalCost как revenue                   | Sale creation in updateRepairStatus DELIVERED transition; new SaleType.REPAIR; re-parent payments                                 |
| REPAIR-02 | getDashboardData revenue включает Repair выручку (Sale из ремонтов)            | Dashboard already queries Sale with status=COMPLETED - auto-included once Sale exists                                             |
| REPAIR-03 | При использовании запчастей - StoreProduct.quantity декрементится              | New RepairPart model + decrement logic with SELECT FOR UPDATE                                                                     |
| REPAIR-04 | Запчасти ремонта учитываются как COGS в отчёте по прибыли                      | RepairPart.costPrice tracked; profit report already sums SaleItem COGS - repair parts need separate COGS line or SaleItem mapping |
| REPAIR-05 | RepairCostHistory таблица - аудит изменений estimatedCost/agreedCost/finalCost | New RepairCostHistory model with oldValue/newValue/field/changedBy                                                                |
| REPAIR-06 | Изменение стоимости ремонта запрещено после COMPLETED/DELIVERED                | Guard in updateRepair + updateRepairStatus: reject cost changes when status in terminal states                                    |
| REPAIR-07 | Гарантия не находит проданный IMEI - фильтр расширен на SOLD+IN_STOCK          | Fix lookupForWarrantyClaim: change `status: "SOLD"` to `status: { in: ["SOLD", "IN_STOCK"] }`                                     |
| REPAIR-08 | Гарантия проверяет warrantyUntil не истек перед созданием WarrantyClaim        | Already implemented in createWarrantyClaim for both SALE_WARRANTY and REPAIR_WARRANTY types                                       |
| REPAIR-09 | Поиск гарантии работает по IMEI, номеру чека, номеру продажи                   | Extend lookupForWarrantyClaim to also search by Sale.number                                                                       |

</phase_requirements>

## Standard Stack

### Core (already in project)

| Library    | Version    | Purpose                 | Notes                                                 |
| ---------- | ---------- | ----------------------- | ----------------------------------------------------- |
| Prisma     | 7.x        | ORM, migrations, schema | Custom output path `@/generated/prisma/client`        |
| Next.js    | 16         | Server actions          | All repair logic in `src/actions/repairs.ts`          |
| Decimal.js | via Prisma | Money arithmetic        | Use `@/lib/money.ts` helpers (sum, toMoney, sub, mul) |
| Vitest     | current    | E2E testing             | Projects config: unit + e2e                           |

### No New Libraries Needed

This phase is purely business logic + schema changes. No new dependencies required.

## Architecture Patterns

### Schema Changes Required

```
prisma/schema.prisma additions:

1. SaleType enum += REPAIR
2. RepairPart model (junction: Repair <-> StoreProduct)
3. RepairCostHistory model (audit trail)
4. Repair model += saleId? (FK to Sale)
```

### Pattern 1: Repair-to-Sale Conversion (REPAIR-01)

**What:** When repair status transitions to DELIVERED, create a Sale record inside the same transaction.
**When to use:** Inside `updateRepairStatus` when `newStatus === "DELIVERED"`.

```typescript
// Inside updateRepairStatus transaction, after existing DELIVERED logic:
if (newStatus === "DELIVERED") {
  // 1. Require open shift (like completeOrder does)
  const openShift = await tx.shift.findFirst({
    where: { storeId: repair.storeId, status: "OPEN" },
    select: { id: true },
  })
  if (!openShift) throw new Error("Откройте кассовую смену")

  // 2. Create Sale with type REPAIR
  const saleNumber = await getNextNumber("S", tx)
  const finalCost = repair.finalCost ?? repair.agreedCost ?? repair.estimatedCost
  if (!finalCost || finalCost.lte(0)) {
    throw new Error("Укажите итоговую стоимость ремонта")
  }

  const sale = await tx.sale.create({
    data: {
      number: saleNumber,
      storeId: repair.storeId,
      sellerId: userId,
      type: "REPAIR",
      status: "COMPLETED",
      totalAmount: finalCost,
      discountAmount: 0,
      finalAmount: finalCost,
      shiftId: openShift.id,
    },
  })

  // 3. Link repair to sale
  await tx.repair.update({
    where: { id: repairId },
    data: { saleId: sale.id },
  })

  // 4. Re-parent payments from repair to sale (like completeOrder pattern)
  await tx.payment.updateMany({
    where: { repairId: repairId },
    data: { saleId: sale.id, repairId: null },
  })
}
```

**Key decisions:**

- Re-parent payments (move from repairId to saleId) so they appear in Sale-based financial reports
- Sale.type = "REPAIR" distinguishes repair revenue from retail
- finalCost becomes Sale.finalAmount (revenue)

### Pattern 2: Spare Parts Tracking (REPAIR-03, REPAIR-04)

**What:** New RepairPart model linking Repair to StoreProduct. When a part is added to repair, stock is decremented. When repair is cancelled, stock is restored.

```prisma
model RepairPart {
  id          String   @id @default(cuid())
  repair      Repair   @relation(fields: [repairId], references: [id], onDelete: Cascade)
  repairId    String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId   String
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Restrict)
  storeId     String
  quantity    Int
  costPrice   Decimal  @db.Decimal(12, 2)  // snapshot at time of use
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([repairId])
}
```

**Stock decrement:** Use existing SELECT FOR UPDATE pattern from sales:

```typescript
// Lock StoreProduct row
await tx.$queryRaw`
  SELECT id FROM "StoreProduct"
  WHERE "storeId" = ${storeId} AND "productId" = ${productId}
  FOR UPDATE
`
// Check + decrement
const sp = await tx.storeProduct.findUnique(...)
if (sp.quantity < qty) throw new Error("Недостаточно запчастей")
await tx.storeProduct.update({ data: { quantity: { decrement: qty } } })
```

**COGS in reports:** Two approaches:

- **Option A (recommended):** Create SaleItems for each RepairPart when Sale is created on DELIVERED. This way existing COGS queries (`SUM(si."costPrice" * si."quantity")`) automatically include repair parts.
- **Option B:** Separate COGS query joining RepairPart. Requires modifying every report query.

**Recommendation: Option A** - create SaleItems from RepairParts during DELIVERED transition. This leverages existing report infrastructure with zero changes to dashboard/reports.

### Pattern 3: Cost Change Audit (REPAIR-05, REPAIR-06)

```prisma
model RepairCostHistory {
  id        String   @id @default(cuid())
  repair    Repair   @relation(fields: [repairId], references: [id], onDelete: Cascade)
  repairId  String
  field     String   // 'estimatedCost' | 'agreedCost' | 'finalCost'
  oldValue  Decimal? @db.Decimal(12, 2)
  newValue  Decimal? @db.Decimal(12, 2)
  changedBy User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([repairId])
}
```

**Guard logic:** In both `updateRepair` and `updateRepairStatus`:

```typescript
if (["COMPLETED", "DELIVERED"].includes(repair.status)) {
  if (
    data.estimatedCost !== undefined ||
    data.agreedCost !== undefined ||
    data.finalCost !== undefined
  ) {
    throw new Error("Нельзя изменить стоимость после завершения ремонта")
  }
}
```

### Pattern 4: Warranty Lookup Fix (REPAIR-07, REPAIR-09)

**Current bug (REPAIR-07):** `lookupForWarrantyClaim` only searches `status: "SOLD"`. Devices returned to stock (IN_STOCK after return) won't be found. Fix: `status: { in: ["SOLD", "IN_STOCK"] }`.

**Current bug (REPAIR-09):** `lookupForWarrantyClaim` only searches by IMEI/serial. Add search by Sale.number:

```typescript
// After IMEI search, also try searching by sale number
const sale = await db.sale.findFirst({
  where: {
    number: trimmedImei, // sale number like S-00042
    status: "COMPLETED",
  },
  include: {
    items: {
      include: {
        serialUnit: { select: { id: true, warrantyDays: true } },
      },
    },
  },
})
```

**REPAIR-08 status:** Already implemented in `createWarrantyClaim` (lines 112-118 check warrantyUntil for REPAIR_WARRANTY, lines 113-115 check warranty expiry for SALE_WARRANTY). Needs verification that the check is correct and has test coverage.

### Anti-Patterns to Avoid

- **Don't create a separate "RepairRevenue" table** — Use the existing Sale model with type=REPAIR. This ensures all financial reports work without modification.
- **Don't keep payments on repairId after DELIVERED** — Re-parent to saleId so Sale-based financial queries include repair payments automatically.
- **Don't compute repair COGS separately in reports** — Create SaleItems from RepairParts at DELIVERED time. Existing COGS queries auto-include them.
- **Don't allow cost edits outside transaction** — updateRepair currently doesn't use transaction for cost changes. Must add tx + RepairCostHistory creation atomically.

## Don't Hand-Roll

| Problem                   | Don't Build                | Use Instead                                           | Why                                         |
| ------------------------- | -------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Stock decrement for parts | Custom counter logic       | SELECT FOR UPDATE pattern from `src/actions/sales.ts` | Race condition protection already proven    |
| Sale number generation    | Manual counter             | `getNextNumber("S", tx)`                              | Atomic counter inside transaction (DATA-02) |
| Payment re-parenting      | Manual payment copy+delete | `updateMany` to move repairId -> saleId               | Preserves audit trail, atomic               |
| COGS aggregation          | Separate repair COGS query | SaleItem creation from RepairPart                     | Leverages existing report SQL               |

## Common Pitfalls

### Pitfall 1: Payment Orphaning

**What goes wrong:** If Sale creation fails after payments are re-parented, payments lose both repairId and saleId.
**Why it happens:** Two separate updateMany calls not in same transaction.
**How to avoid:** Everything (Sale create + Payment re-parent + Repair update) MUST be in a single `$transaction`.
**Warning signs:** Payments with null saleId AND null repairId.

### Pitfall 2: Double Revenue

**What goes wrong:** Repair payments already counted somewhere + new Sale.finalAmount counted again.
**Why it happens:** Dashboard/reports might have special repair payment logic elsewhere.
**How to avoid:** Verify dashboard only counts Sale-based revenue. Current code confirms: `getDashboardData` only queries `Sale` with `status: "COMPLETED"`.
**Warning signs:** Revenue spike after deploying repair-as-sale.

### Pitfall 3: Cost Freeze Bypass

**What goes wrong:** Cost changes slip through via `updateRepairStatus` extraData after COMPLETED.
**Why it happens:** `updateRepairStatus` accepts `extraData.finalCost` and applies it for any status, not just COMPLETED.
**How to avoid:** Add explicit guard in `updateRepairStatus` checking current status before applying cost changes.
**Warning signs:** RepairCostHistory entries after COMPLETED status.

### Pitfall 4: Shift Requirement for DELIVERED

**What goes wrong:** Repair marked DELIVERED without open shift, but Sale requires shift.
**Why it happens:** Current DELIVERED transition doesn't check for open shift (no Sale created yet).
**How to avoid:** Add shift check at the beginning of DELIVERED transition, before Sale creation.
**Warning signs:** Sales without shiftId.

### Pitfall 5: Decimal Precision in Cost Fields

**What goes wrong:** Cost comparison and arithmetic using `Number()` instead of Decimal helpers.
**Why it happens:** Existing code uses `.toNumber()` for API returns but should use `toMoney()` for calculations.
**How to avoid:** Use `@/lib/money.ts` helpers for all cost arithmetic. Compare Decimals with `.eq()`, `.gt()`, `.lt()`.
**Warning signs:** Rounding errors in RepairCostHistory oldValue/newValue.

### Pitfall 6: Warranty Lookup Performance

**What goes wrong:** Searching by sale number across all sales is slow.
**Why it happens:** Sale.number is already unique-indexed, but adding OR conditions to warranty lookup can miss the index.
**How to avoid:** Do separate queries (IMEI search, then sale number search) rather than OR-combining.

## Code Examples

### Verified: updateRepairStatus DELIVERED hook location (src/actions/repairs.ts:399-404)

```typescript
// Current code at line 399:
if (newStatus === "DELIVERED") {
  const warrantyDays = repair.warrantyDays ?? 30
  const warrantyUntil = new Date()
  warrantyUntil.setDate(warrantyUntil.getDate() + warrantyDays)
  updateData.warrantyUntil = warrantyUntil
}
// ^^^ ADD Sale creation logic AFTER this block, inside same transaction
```

### Verified: Dashboard revenue query (src/actions/dashboard.ts:22-29)

```typescript
// Dashboard queries Sale with status=COMPLETED — repair Sales auto-included
const todaySales = await db.sale.findMany({
  where: {
    storeId,
    createdAt: { gte: today, lte: endOfDay },
    status: "COMPLETED",
  },
  select: { finalAmount: true },
})
```

### Verified: Profit report COGS query (src/actions/reports.ts:208-216)

```typescript
// COGS from SaleItem — RepairPart-derived SaleItems auto-included
SELECT COALESCE(SUM(si."costPrice" * si."quantity"), 0) AS cogs
FROM "SaleItem" si
JOIN "Sale" s ON s."id" = si."saleId"
WHERE s."createdAt" >= ${dateFrom}
  AND s."createdAt" <= ${dateTo}
  AND s."status" = 'COMPLETED'
```

### Verified: Warranty lookup bug (src/actions/warranty-claims.ts:329)

```typescript
// BUG: only searches SOLD status
status: "SOLD",
// FIX: should be
status: { in: ["SOLD", "IN_STOCK"] },
```

## State of the Art

| Old Approach             | Current Approach                   | When Changed | Impact                                 |
| ------------------------ | ---------------------------------- | ------------ | -------------------------------------- |
| Repair revenue invisible | Repair creates Sale on DELIVERED   | Phase 11     | Revenue appears in all reports         |
| No spare parts tracking  | RepairPart model + stock decrement | Phase 11     | Inventory accuracy for parts           |
| No cost audit trail      | RepairCostHistory model            | Phase 11     | Accountability for price changes       |
| Warranty IMEI only SOLD  | SOLD + IN_STOCK filter             | Phase 11     | Returned devices findable for warranty |

## Open Questions

1. **Should repair-sourced Sales have SaleItems?**
   - What we know: Option A (create SaleItems from RepairParts) makes COGS auto-work in reports
   - What's unclear: If repair has no parts (labor-only), should there be a "labor" SaleItem with costPrice=0?
   - Recommendation: Yes, create a single SaleItem with name="Ремонт: {deviceType} {deviceModel}", quantity=1, price=finalCost, costPrice=sum(parts costPrice). If no parts, costPrice=0.

2. **Should cancelled repair restore spare parts stock?**
   - What we know: Cancel transitions from RECEIVED..IN_PROGRESS to CANCELLED
   - What's unclear: Parts may be already used physically
   - Recommendation: Yes, auto-restore on CANCELLED (business can manually adjust if parts consumed). Log in RepairStatusHistory comment.

3. **REPAIR-08 already implemented?**
   - What we know: `createWarrantyClaim` already checks warrantyUntil for REPAIR_WARRANTY and warranty expiry for SALE_WARRANTY
   - What's unclear: Edge cases — what if warrantyUntil is null? Current code allows creation if null.
   - Recommendation: Add test coverage confirming behavior. If warrantyUntil is null, likely means warranty not started yet — should block or warn.

## Validation Architecture

### Test Framework

| Property           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Framework          | Vitest (projects: unit + e2e)                                 |
| Config file        | vitest.config.ts                                              |
| Quick run command  | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts` |
| Full suite command | `npx vitest run --project e2e`                                |

### Phase Requirements -> Test Map

| Req ID    | Behavior                                         | Test Type | Automated Command                                                                  | File Exists? |
| --------- | ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------- | ------------ |
| REPAIR-01 | DELIVERED creates Sale with finalCost as revenue | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "creates Sale"`    | No - Wave 0  |
| REPAIR-02 | Dashboard includes repair revenue                | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "dashboard"`       | No - Wave 0  |
| REPAIR-03 | Spare parts decrement StoreProduct.quantity      | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "parts decrement"` | No - Wave 0  |
| REPAIR-04 | Parts as COGS in profit report                   | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "COGS"`            | No - Wave 0  |
| REPAIR-05 | RepairCostHistory audit trail                    | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "cost history"`    | No - Wave 0  |
| REPAIR-06 | Cost change blocked after COMPLETED/DELIVERED    | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "cost freeze"`     | No - Wave 0  |
| REPAIR-07 | Warranty lookup finds SOLD+IN_STOCK              | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "warranty lookup"` | No - Wave 0  |
| REPAIR-08 | Warranty checks warrantyUntil expiry             | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "warranty expiry"` | No - Wave 0  |
| REPAIR-09 | Warranty search by IMEI/sale number/receipt      | e2e       | `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts -t "warranty search"` | No - Wave 0  |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/e2e/repair-as-sale.e2e.test.ts`
- **Per wave merge:** `npx vitest run --project e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/e2e/repair-as-sale.e2e.test.ts` -- covers REPAIR-01..09
- [ ] Test fixture: `createTestRepair()` helper in `src/__tests__/helpers/fixtures.ts`
- [ ] Test fixture: `createTestRepairPart()` helper
- [ ] Prisma migration for RepairPart, RepairCostHistory, SaleType.REPAIR, Repair.saleId

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` -- current Repair, Sale, Payment, StoreProduct models
- `src/actions/repairs.ts` -- current repair CRUD and status transitions
- `src/actions/warranty-claims.ts` -- current warranty lookup and creation
- `src/actions/dashboard.ts` -- current revenue/COGS calculation
- `src/actions/reports.ts` -- profit report COGS query
- `src/actions/orders.ts:completeOrder` -- reference pattern for Sale creation from another entity

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` -- REPAIR-01..09 requirement definitions
- `.planning/STATE.md` -- accumulated decisions and patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new libraries, all existing
- Architecture: HIGH - follows established completeOrder pattern, verified against actual code
- Pitfalls: HIGH - identified from actual code inspection, real bugs in warranty lookup confirmed

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable domain, internal project)
