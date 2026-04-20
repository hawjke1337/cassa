# Phase 16: Inventory Edge Cases & UX Polish - Research

**Researched:** 2026-04-14
**Domain:** Inventory management edge cases + POS/UI polish (Next.js 16 + Prisma 7 + React 19)
**Confidence:** HIGH

## Summary

Phase 16 covers 26 requirements split into two domains: inventory edge cases (INV-01..09) addressing audit MISSING serial units, category isSerialized guards, StoreProductHistory logging, transfer validation, receive sellPrice, trade-in edge cases, and soft-deleted audit filtering; and UX polish (UX2-01..17) covering double-click protection, confirmation dialogs, idempotency keys, print preview, receipt formatting, responsive POS, ARIA labels, inline validation, and navigation restructuring.

The codebase already has established patterns for all required changes: server actions with `requirePermission()`, Prisma transactions with `FOR UPDATE` locking, shadcn/ui AlertDialog/Dialog/Toast components, Zod validation, and a comprehensive test infrastructure (vitest with unit + e2e projects). No new libraries are needed. All changes are additive modifications to existing files.

**Primary recommendation:** Split work into 5 waves: (1) Schema migration (StoreProductHistory, SerialUnitStatus.MISSING, Sale.idempotencyKey), (2) Inventory edge cases (INV-01..09), (3) UX protection & confirmation dialogs (UX2-01..06), (4) Print & receipts (UX2-10, 12, 14, 15), (5) POS layout & navigation (UX2-07..09, 16, 17).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **INV-01**: Guard + admin override for Category.isSerialized change. Normal user blocked if SerialUnits exist; admin can force with AlertDialog warning + logging
- **INV-02**: Audit MISSING serial units -> MISSING status; next audit not found -> WRITTEN_OFF; manual write-off from UI
- **INV-03**: Expected qty recalculated at audit close time (not open time)
- **INV-04**: StoreProductHistory as separate Prisma model with storeProductId, quantityBefore/After, reason enum, userId, createdAt. Filled in code (not DB trigger)
- **INV-05**: Validation + block if product not found on source store
- **INV-06**: sellPrice mandatory manual input when creating new StoreProduct from Receive (no auto-calc)
- **INV-07**: agreedPrice=0 shows warning "Бесплатный приём - уверены?"; marked in reports; not blocking
- **INV-08**: Toggle filter "В т.ч. удалённые" for soft-deleted products in audit (hidden by default)
- **INV-09**: Trade-in product can be created with any status (IN_STOCK + PENDING)
- **UX2-01**: AlertDialog confirmation before createReturn
- **UX2-02**: ref-lock + disable on PaymentDialog "Оплатить" button with spinner
- **UX2-03**: AlertDialog for closeShift discrepancy > 0
- **UX2-04**: Cart blocked (greyed out) while PaymentDialog is open
- **UX2-05**: Toast "Повторить" only for critical ops: sale, payment, return, shift close
- **UX2-06**: Client UUID idempotency-key on PaymentDialog open; server checks Sale with that key
- **UX2-07**: Inline validation with red borders + helper text (Claude's Discretion on specific forms)
- **UX2-08**: iPad/Android 10" breakpoint ~768px; cart collapses to drawer, products in 2 columns
- **UX2-09**: ARIA labels on custom components (Claude's Discretion on which ones)
- **UX2-10**: Modal print preview before window.print()
- **UX2-11**: Single "Цена выкупа" field instead of two (Оценка/Согласовано)
- **UX2-12**: Full order form/blank with all fields + signature area
- **UX2-13**: Warning when order payment < remaining balance
- **UX2-14**: IMEI/SN as separate column in receipt table
- **UX2-15**: Payment aggregation by method in receipt
- **UX2-16**: Merge catalog + inventory into single "Товары" section with tabs
- **UX2-17**: Category grid in POS when search is empty

### Claude's Discretion
- Specific forms for inline validation (UX2-07)
- Specific components for ARIA labels (UX2-09)
- Format of warning for payment < remaining (UX2-13)
- Migration ordering and plan splitting
- StoreProductHistory: which additional operations to log

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-01 | Category.isSerialized guard/migration tool | Schema already has isSerialized; updateCategory has partial guard. Need admin override with role check + AuditLog entry |
| INV-02 | Audit MISSING serial units status | Need MISSING added to SerialUnitStatus enum + closeAudit logic update |
| INV-03 | Audit expected qty recalculated at close time | closeAudit currently uses items.expectedQty from open-time. Needs re-query at close |
| INV-04 | StoreProductHistory table | New Prisma model + logging calls in inventory/sales/audit actions |
| INV-05 | Stock Transfer null sourceSp validation | Already partially done (line 446 inventory.ts). Needs tighter validation for edge cases |
| INV-06 | Receive sellPrice mandatory input | Currently uses sellPriceFallback. Need UI field + action param for explicit sellPrice |
| INV-07 | Trade-In agreedPrice=0 warning | UI warning + report marking in trade-in.ts |
| INV-08 | Soft-deleted in audit filter | Toggle in audit UI + query filter on deletedAt |
| INV-09 | Trade-In from IN_STOCK status | VALID_TRANSITIONS already allows PENDING->IN_STOCK. Verify UI supports it |
| UX2-01 | createReturn AlertDialog | Wrap return submit in AlertDialog in return-form.tsx |
| UX2-02 | PaymentDialog double-click protection | useRef lock + button disable in payment-dialog.tsx |
| UX2-03 | closeShift discrepancy AlertDialog | Add AlertDialog in close-shift-dialog.tsx |
| UX2-04 | Cart lock during payment | State prop from PaymentDialog open state to cart in pos-interface.tsx |
| UX2-05 | Toast "Повторить" for critical ops | Custom toast action pattern with sonner |
| UX2-06 | Idempotency-key for sales | UUID on client + idempotencyKey field on Sale model + server check |
| UX2-07 | Inline form validation | react-hook-form error states with red borders/helper text |
| UX2-08 | POS responsive layout | Tailwind breakpoints + Sheet component for collapsible cart |
| UX2-09 | ARIA labels on custom components | aria-label/aria-describedby attributes |
| UX2-10 | Print preview modal | Dialog with iframe/rendered preview before window.print() |
| UX2-11 | Trade-In single price field | Simplify trade-in form, keep only agreedPrice |
| UX2-12 | Order form/blank print | Document template with full order info + signature |
| UX2-13 | Order payment < remaining warning | AlertDialog or inline warning in order payment flow |
| UX2-14 | IMEI in receipt | Add IMEI/SN column to receipt-view.tsx table |
| UX2-15 | Payment aggregation in receipt | Group payments by method in receipt-view.tsx |
| UX2-16 | Merge catalog + inventory navigation | Single "Товары" menu item with tabs in app-sidebar.tsx |
| UX2-17 | POS category grid | Category grid component when search is empty in pos-interface.tsx |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Framework | Already in use |
| Prisma | 7.4.2 | ORM + migrations | Already in use |
| React | 19.2.3 | UI | Already in use |
| shadcn/ui | latest | UI components | AlertDialog, Dialog, Sheet, Toast already available |
| Tailwind CSS | 4.x | Styling | Already in use, responsive utilities built-in |
| react-hook-form | 7.71.2 | Form validation | Already in use, supports inline error display |
| Zod | 4.3.6 | Schema validation | Already in use |
| Zustand | 5.0.11 | Client state | Already in use for cart |
| sonner | 2.0.7 | Toast notifications | Already in use |
| Vitest | installed | Testing | Unit + E2E infrastructure ready |

### No New Dependencies Required
This phase is entirely additive to existing codebase. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure (changes only)
```
prisma/
├── schema.prisma          # Add StoreProductHistory, MISSING enum, idempotencyKey
├── migrations/             # New migration for schema changes
src/
├── actions/
│   ├── inventory.ts        # INV-01..06, INV-08 changes
│   ├── trade-in.ts         # INV-07, INV-09, UX2-11 changes
│   ├── sales.ts            # UX2-06 idempotency, UX2-01 confirmation
│   └── catalog.ts          # INV-01 admin override
├── components/
│   ├── pos/
│   │   ├── payment-dialog.tsx    # UX2-02, UX2-04, UX2-06
│   │   ├── pos-interface.tsx     # UX2-04, UX2-08, UX2-17
│   │   ├── receipt-view.tsx      # UX2-14, UX2-15, UX2-10
│   │   ├── return-form.tsx       # UX2-01
│   │   ├── close-shift-dialog.tsx # UX2-03
│   │   └── category-grid.tsx     # NEW: UX2-17
│   ├── layout/
│   │   └── app-sidebar.tsx       # UX2-16
│   └── inventory/
│       └── audit-*.tsx           # INV-02, INV-03, INV-08
├── lib/
│   └── store-product-history.ts  # NEW: INV-04 helper
└── app/(dashboard)/
    └── products/                 # NEW: UX2-16 merged route
```

### Pattern 1: Ref-Lock for Double-Click Prevention (UX2-02)
**What:** useRef boolean lock that prevents re-submission before server response
**When to use:** Any button that triggers a mutation (payment, return, shift close)
**Example:**
```typescript
// Established pattern in existing codebase
const lockRef = useRef(false)

async function handleSubmit() {
  if (lockRef.current) return
  lockRef.current = true
  setLoading(true)
  try {
    await serverAction(data)
  } catch (error) {
    // handle error
  } finally {
    lockRef.current = false
    setLoading(false)
  }
}
```

### Pattern 2: Idempotency Key (UX2-06)
**What:** Client generates UUID when dialog opens; server checks for existing Sale with that key
**When to use:** createSale specifically (the only payment-creating endpoint)
**Example:**
```typescript
// Client: generate on dialog open
const [idempotencyKey] = useState(() => crypto.randomUUID())

// Server: check before creating
const existing = await tx.sale.findUnique({
  where: { idempotencyKey }
})
if (existing) return formatSaleResult(existing)
// ... proceed with creation
```

### Pattern 3: StoreProductHistory Logging (INV-04)
**What:** Log every quantity change to StoreProductHistory with before/after/reason/userId
**When to use:** Every operation that changes StoreProduct.quantity
**Example:**
```typescript
// Helper function — called in every transaction that changes quantity
async function logQuantityChange(
  tx: PrismaTransaction,
  storeProductId: string,
  quantityBefore: number,
  quantityAfter: number,
  reason: StockChangeReason,
  userId: string,
) {
  await tx.storeProductHistory.create({
    data: { storeProductId, quantityBefore, quantityAfter, reason, userId }
  })
}
```

### Pattern 4: AlertDialog Confirmation
**What:** Two-step confirmation with destructive/warning styling
**When to use:** Return confirmation (UX2-01), shift discrepancy (UX2-03)
**Example:**
```tsx
<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Подтвердите возврат</AlertDialogTitle>
      <AlertDialogDescription>
        Будет оформлен возврат на сумму {formatMoney(amount)}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Отмена</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground"
        onClick={handleConfirm}
      >
        Подтвердить возврат
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Pattern 5: Toast with Retry Action (UX2-05)
**What:** sonner toast with action button for retry
**When to use:** Critical operations (sale, payment, return, shift close)
**Example:**
```typescript
toast.error("Ошибка оплаты", {
  description: error.message,
  action: {
    label: "Повторить",
    onClick: () => handleSubmit(),
  },
})
```

### Anti-Patterns to Avoid
- **Direct Number() on Decimal fields in new code** — use money.ts helpers (sum/mul/sub)
- **Client-side state for idempotency** — idempotencyKey must be checked server-side in the transaction
- **DB trigger for history** — INV-04 explicitly requires code-based logging to capture userId from session
- **Separate routes for merged catalog/inventory** — UX2-16 means one route with tabs, not a redirect

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Double-click protection | Custom debounce/throttle | useRef lock + button disable | React 19 concurrent mode can re-render between debounce ticks |
| Print preview | Custom HTML-to-canvas | Dialog with print-media CSS + window.print() | Browser print dialog handles pagination, margins |
| UUID generation | Custom ID generation | crypto.randomUUID() | Already used in project, native browser API |
| Responsive drawer | Custom slide panel | shadcn/ui Sheet component | Already in UI toolkit, handles animations/backdrop |
| Form validation display | Custom error rendering | react-hook-form errors + FormMessage | Already in project, handles field-level errors |
| Payment aggregation | Manual reduce in JSX | Object.groupBy() or Map | Cleaner, handles edge cases |

## Common Pitfalls

### Pitfall 1: Audit Expected Qty Race Condition (INV-03)
**What goes wrong:** Sales happen between audit open and close, expectedQty becomes stale
**Why it happens:** Current code stores expectedQty at open time
**How to avoid:** Re-query StoreProduct.quantity (and SerialUnit count for serialized) inside the closeAudit transaction, AFTER FOR UPDATE lock
**Warning signs:** Audit showing discrepancies that don't match physical count

### Pitfall 2: MISSING -> WRITTEN_OFF Without Checking Previous Audit (INV-02)
**What goes wrong:** Serial unit marked WRITTEN_OFF on first audit miss
**Why it happens:** No check for previous audit status
**How to avoid:** On closeAudit, query InventoryAuditSerial from the PREVIOUS completed audit for this store. If serial was MISSING there AND still not found -> WRITTEN_OFF. If first time missing -> MISSING only
**Warning signs:** Premature write-offs of temporarily misplaced items

### Pitfall 3: Idempotency Key Stale After Navigation (UX2-06)
**What goes wrong:** User opens PaymentDialog, pays, navigates away, comes back — old key used
**Why it happens:** Key generated on mount, not on dialog open
**How to avoid:** Generate new key each time dialog opens (useState initializer runs once; use useEffect on `open` prop)
**Warning signs:** Server returns old sale instead of creating new one

### Pitfall 4: Cart Lock Doesn't Prevent Zustand Persist Restore (UX2-04)
**What goes wrong:** User refreshes during payment, cart restores from localStorage, proceeds with stale data
**Why it happens:** Zustand persist middleware restores state independently
**How to avoid:** Lock state should be part of the persisted store, or clear on PaymentDialog close. Idempotency key (UX2-06) is the true safety net
**Warning signs:** Duplicate sales after browser refresh during payment

### Pitfall 5: Category isSerialized Change With Existing Products (INV-01)
**What goes wrong:** Admin force-changes isSerialized, but existing StoreProducts have inconsistent state
**Why it happens:** No migration of existing stock data when switching serialization mode
**How to avoid:** Admin override should only flip the flag — existing products continue to work with old logic until manually reconciled. Log the change to AuditLog
**Warning signs:** Quantity mismatches for products in changed categories

### Pitfall 6: StoreProductHistory Missing Operations
**What goes wrong:** Some quantity changes not logged, audit trail incomplete
**Why it happens:** Forgotten to add logging call in a code path
**How to avoid:** Add history logging in ALL paths: createSale, createReturn, confirmReceive, confirmTransferSent, confirmTransferReceived, closeAudit (surplus/shortage), createWriteOff, completeOrder
**Warning signs:** StoreProductHistory gaps visible when comparing quantity timeline

## Code Examples

### Schema Migration: StoreProductHistory + MISSING + idempotencyKey
```prisma
// Add to schema.prisma:

enum StockChangeReason {
  SALE
  RETURN
  RECEIVE
  TRANSFER_OUT
  TRANSFER_IN
  AUDIT_SURPLUS
  AUDIT_SHORTAGE
  WRITE_OFF
  ORDER_COMPLETE
}

model StoreProductHistory {
  id              String            @id @default(cuid())
  storeProduct    StoreProduct      @relation(fields: [storeProductId], references: [id], onDelete: Cascade)
  storeProductId  String
  quantityBefore  Int
  quantityAfter   Int
  reason          StockChangeReason
  user            User              @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId          String
  createdAt       DateTime          @default(now())

  @@index([storeProductId, createdAt])
  @@index([userId])
}

// Add MISSING to SerialUnitStatus enum:
enum SerialUnitStatus {
  IN_STOCK
  SOLD
  IN_TRANSFER
  RETURNED
  WRITTEN_OFF
  IN_REPAIR
  MISSING     // NEW
}

// Add to Sale model:
model Sale {
  // ... existing fields ...
  idempotencyKey  String?   @unique @db.VarChar(36)
}

// Add MISSING_FOUND event to SerialUnitEvent:
enum SerialUnitEvent {
  // ... existing ...
  MISSING         // NEW
  MISSING_RESOLVED // NEW — was MISSING, found in next audit
}
```

### Responsive POS Layout (UX2-08)
```tsx
// Use Sheet for collapsible cart on tablet
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// In pos-interface.tsx:
<div className="flex h-full">
  {/* Product grid: full width on mobile, 2/3 on desktop */}
  <div className="flex-1 md:w-2/3">
    {/* Search + category grid/product list */}
  </div>
  
  {/* Cart: hidden on mobile (Sheet), visible on desktop */}
  <div className="hidden md:block md:w-1/3 border-l">
    <CartSection />
  </div>
  
  {/* Mobile cart trigger */}
  <div className="md:hidden fixed bottom-4 right-4">
    <Sheet>
      <SheetTrigger asChild>
        <Button size="lg" className="rounded-full">
          <ShoppingCart /> ({items.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw]">
        <CartSection />
      </SheetContent>
    </Sheet>
  </div>
</div>
```

### Category Grid for POS (UX2-17)
```tsx
// When search is empty, show category grid
function CategoryGrid({ categories, onSelect }: { categories: Category[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors"
          aria-label={`Категория: ${cat.name}`}
        >
          <Package className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium text-center">{cat.name}</span>
          <span className="text-xs text-muted-foreground">{cat.productCount} товаров</span>
        </button>
      ))}
    </div>
  )
}
```

### IMEI Column in Receipt (UX2-14)
```tsx
// receipt-view.tsx table structure:
<table className="w-full text-sm">
  <thead>
    <tr className="border-b">
      <th className="text-left py-1">Наименование</th>
      <th className="text-left py-1">IMEI/SN</th>
      <th className="text-center py-1">Кол</th>
      <th className="text-right py-1">Цена</th>
    </tr>
  </thead>
  <tbody>
    {data.items.map((item, i) => (
      <tr key={i} className="border-b border-dashed">
        <td className="py-1">{item.productName}</td>
        <td className="py-1 font-mono text-xs">
          {item.imei
            ? item.imei2
              ? `${item.imei}, ${item.imei2}`
              : item.imei
            : item.serialNumber ?? "—"}
        </td>
        <td className="py-1 text-center">{item.quantity}</td>
        <td className="py-1 text-right">{formatMoney(item.total)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sellPriceFallback auto-calc | Manual sellPrice input (INV-06) | Phase 16 | Operator controls pricing |
| Two fields (estimatedPrice/agreedPrice) | Single "Цена выкупа" (UX2-11) | Phase 16 | Simplified trade-in UX |
| Separate Catalog + Inventory nav | Merged "Товары" with tabs (UX2-16) | Phase 16 | Cleaner navigation |
| No quantity audit trail | StoreProductHistory (INV-04) | Phase 16 | Full traceability |

## Open Questions

1. **StoreProductHistory for serialized products**
   - What we know: Serialized products don't use StoreProduct.quantity (derived from SerialUnit count)
   - What's unclear: Should we log history for the "mirror" quantity field on serialized products?
   - Recommendation: Skip logging for serialized products — SerialUnitHistory already provides full audit trail. Only log for non-serialized.

2. **UX2-16 URL structure for merged Товары**
   - What we know: Currently /catalog and /inventory are separate routes
   - What's unclear: Should merged view be at /products, /catalog, or /inventory?
   - Recommendation: Use /products as new route, keep old routes as redirects for bookmarks

3. **INV-02 MISSING threshold**
   - What we know: First miss = MISSING, second consecutive miss = WRITTEN_OFF
   - What's unclear: What if there were 3+ audits between? Only check the immediately previous one?
   - Recommendation: Check only the latest previous completed audit for this store + product. Two consecutive misses = write-off, regardless of total audit count.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Category isSerialized guard + admin override | e2e | `pnpm test:e2e -- --grep "category-serialized"` | Wave 0 |
| INV-02 | Audit MISSING -> WRITTEN_OFF serial flow | e2e | `pnpm test:e2e -- --grep "audit-missing"` | Wave 0 |
| INV-03 | Audit expected qty at close time | e2e | `pnpm test:e2e -- --grep "audit-expected-qty"` | Wave 0 |
| INV-04 | StoreProductHistory logging | e2e | `pnpm test:e2e -- --grep "store-product-history"` | Wave 0 |
| INV-05 | Transfer null sourceSp validation | unit | `pnpm test:unit -- --grep "transfer-validation"` | Wave 0 |
| INV-06 | Receive sellPrice mandatory | e2e | `pnpm test:e2e -- --grep "receive-sellprice"` | Wave 0 |
| INV-07 | Trade-in agreedPrice=0 warning | unit | `pnpm test:unit -- --grep "trade-in-zero"` | Wave 0 |
| INV-08 | Soft-deleted in audit filter | unit | `pnpm test:unit -- --grep "audit-soft-deleted"` | Wave 0 |
| INV-09 | Trade-in from IN_STOCK | unit | `pnpm test:unit -- --grep "trade-in-status"` | Wave 0 |
| UX2-01 | Return confirmation AlertDialog | manual-only | Visual UI test | N/A |
| UX2-02 | PaymentDialog double-click | manual-only | Visual UI test — ref-lock is JS-only | N/A |
| UX2-03 | CloseShift discrepancy AlertDialog | manual-only | Visual UI test | N/A |
| UX2-04 | Cart lock during payment | manual-only | Visual UI test | N/A |
| UX2-05 | Toast retry action | manual-only | Visual UI test | N/A |
| UX2-06 | Idempotency key | e2e | `pnpm test:e2e -- --grep "idempotency"` | Wave 0 |
| UX2-07 | Inline form validation | manual-only | Visual UI test | N/A |
| UX2-08 | POS responsive | manual-only | Visual + viewport resize | N/A |
| UX2-09 | ARIA labels | manual-only | Accessibility audit | N/A |
| UX2-10 | Print preview | manual-only | Visual UI test | N/A |
| UX2-11 | Trade-in single field | unit | `pnpm test:unit -- --grep "trade-in-form"` | Wave 0 |
| UX2-12 | Order blank print | manual-only | Visual print test | N/A |
| UX2-13 | Order payment < remaining | unit | `pnpm test:unit -- --grep "order-underpay"` | Wave 0 |
| UX2-14 | IMEI in receipt | manual-only | Visual receipt check | N/A |
| UX2-15 | Payment aggregation | unit | `pnpm test:unit -- --grep "payment-aggregate"` | Wave 0 |
| UX2-16 | Merged catalog+inventory | manual-only | Navigation UI test | N/A |
| UX2-17 | POS category grid | manual-only | Visual UI test | N/A |

### Sampling Rate
- **Per task commit:** `pnpm test:unit`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `src/__tests__/e2e/inventory-edge-cases.e2e.test.ts` — covers INV-01..06, INV-08
- [ ] `src/__tests__/e2e/idempotency-key.e2e.test.ts` — covers UX2-06
- [ ] `src/__tests__/trade-in-edge-cases.test.ts` — covers INV-07, INV-09, UX2-11
- [ ] `src/__tests__/payment-aggregation.test.ts` — covers UX2-15
- [ ] Prisma migration for StoreProductHistory + MISSING enum + idempotencyKey — required before E2E tests

## Sources

### Primary (HIGH confidence)
- Project source code — schema.prisma, inventory.ts, sales.ts, trade-in.ts, catalog.ts, payment-dialog.tsx, pos-interface.tsx, receipt-view.tsx, close-shift-dialog.tsx, return-form.tsx, app-sidebar.tsx
- CONTEXT.md — all 26 user decisions locked
- REQUIREMENTS.md — INV-01..09, UX2-01..17 definitions

### Secondary (MEDIUM confidence)
- shadcn/ui documentation — AlertDialog, Sheet, Dialog, Toast patterns
- sonner documentation — action buttons in toast

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns directly from existing codebase
- Pitfalls: HIGH — based on reading actual code paths and understanding race conditions
- Schema changes: HIGH — directly from Prisma schema analysis

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable codebase, no external dependency changes)
