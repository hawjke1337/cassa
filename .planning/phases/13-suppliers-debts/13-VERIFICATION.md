---
phase: 13-suppliers-debts
verified: 2026-04-12T22:50:00Z
status: gaps_found
score: 8/9 must-haves verified
gaps:
  - truth: "Supplier city displayed in order card from Supplier.city (auto-populated at ORDERED)"
    status: partial
    reason: "supplierCityFromRelation is returned by getOrder action but not passed to SupplierDialog as initial value. City field starts empty — no auto-fill from Supplier.city. SUP-04 requires 'автозаполняется из Supplier.city при ORDERED'."
    artifacts:
      - path: "src/components/orders/order-detail.tsx"
        issue: "SupplierDialog receives no initialCity prop; city state initialised as empty string; supplierCityFromRelation returned by action is never consumed by the component"
      - path: "src/actions/orders.ts"
        issue: "supplierCityFromRelation returned at line 228 but not auto-applied to supplierCity during updateOrderStatus ORDERED transition"
    missing:
      - "Pass supplierCityFromRelation from order data to SupplierDialog as initialCity prop"
      - "SupplierDialog should initialise city state with initialCity ?? ''"
      - "Alternatively: in updateOrderStatus, if newStatus === 'ORDERED' and extraData.supplierCity is not provided but order.supplierId exists, auto-populate supplierCity from Supplier.city"
human_verification:
  - test: "Open a supplier-linked order in PREPAID status. Click 'Заказать у поставщика'. Observe whether the city field is pre-filled with the supplier's city."
    expected: "City field should show the supplier's city (Supplier.city) automatically."
    why_human: "Auto-fill is a UI/UX behavior that cannot be verified by grep; requires visual check of dialog initial state."
  - test: "Complete full debt payment flow via DebtPaymentDialog: open unpaid debt row, click 'Оплатить', enter partial amount, submit. Then do a second payment for the remainder."
    expected: "After first payment debt stays unpaid; after second payment debt is marked fully paid. Toast notifications appear."
    why_human: "Visual flow and state transitions require browser interaction."
  - test: "Check dashboard as a user with orders.costs permission vs one without."
    expected: "User with orders.costs sees 'Долги поставщикам' card; user without does not see it."
    why_human: "Permission-conditional rendering requires login as different user roles."
---

# Phase 13: Supplier Debts — Verification Report

**Phase Goal:** Supplier debt management with partial payments via cash operations
**Verified:** 2026-04-12T22:50:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Debt payment creates SupplierPayment + CashOperation(WITHDRAW, shiftId=null) in one transaction | VERIFIED | `src/actions/orders.ts:542-598` — transaction creates cashOp (shiftId:null, type:WITHDRAW) then payment, E2E SUP-04 test passes |
| 2 | Partial payment: sum(payments) < amount keeps isPaid=false; sum >= amount sets isPaid=true | VERIFIED | `orders.ts:568` — `totalPaidAfter.gte(debt.amount)` auto-closes, E2E SUP-05 test passes |
| 3 | updateOrderCosts recalculates remaining = newAmount - sum(payments), auto-closes if remaining <= 0 | VERIFIED | `orders.ts:640-671` — fetches existing payments, computes fullyPaid with gte(), E2E SUP-06 test passes |
| 4 | Cancel order with partial payments deletes SupplierDebt (cascade deletes SupplierPayments), CashOperations remain | VERIFIED | `orders.ts:1509-1518` — deletes debt, cascade comment present, schema onDelete:Cascade on SupplierPayment.debtId, E2E SUP-05 cancel test passes |
| 5 | ORDERED transition allowed without purchasePrice | VERIFIED | `orders.ts:481-504` — no purchasePrice guard before ORDERED transition, E2E test passes |
| 6 | Debt amount created from costPrice*qty at ORDERED | VERIFIED | `orders.ts:483-493` — `sum(...items.map(item => mul(item.costPrice ?? item.price, item.quantity)))`, E2E SUP-01 passes |
| 7 | Audit log entries on debt payment, debt amount change, debt creation | VERIFIED | `orders.ts:495,578,661` — 4 createAuditEntry calls total (creation, payment, amount update) |
| 8 | Supplier city displayed in order card | PARTIAL | `order-detail.tsx:296-299` renders `order.supplierCity` — stored value shows correctly; BUT auto-fill from Supplier.city on ORDERED transition not implemented. `supplierCityFromRelation` returned at action:228 but not wired to SupplierDialog |
| 9 | All UI areas work: debt dialog, debts page, dashboard card, payment history, sidebar | VERIFIED | All files exist and are substantive; key links verified below |

**Score:** 8/9 truths verified (1 partial)

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | SupplierPayment model + CashOperation.shiftId nullable | VERIFIED | model SupplierPayment at line 674, onDelete:Cascade on debtId FK, CashOperation.shiftId String? at line 1172, SupplierDebt.payments relation at line 669 |
| `src/lib/permissions-list.ts` | suppliers.pay permission | VERIFIED | `SUPPLIERS_PAY` with code "suppliers.pay" confirmed by grep (count: 2 matches) |
| `src/actions/orders.ts` | paySupplierDebt, updated updateOrderCosts, updated cancelOrderWithDecision | VERIFIED | paySupplierDebt at line 510, markSupplierDebtPaid alias at 606, updateOrderCosts with payment-awareness at 640-671, cascade-aware cancel at 1509-1518 |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/suppliers/debt-payment-dialog.tsx` | AlertDialog for partial debt payment | VERIFIED | 148 lines, contains AlertDialog (23 matches), paySupplierDebt call (2 matches), "Оплатить" (1 match) |
| `src/app/(dashboard)/suppliers/debts/page.tsx` | Debts management page with permission guard | VERIFIED | Exists, redirects if !canView (orders.costs), renders SupplierDebtsClient |
| `src/components/orders/order-detail.tsx` | Three amounts with permission guard + "Не рассчитана" | VERIFIED | Lines 366-424 — `{canSeeCosts && ...}` wraps 3-amount card; "Не рассчитана" at line 409; canSeeCosts prop from page via checkPermission("orders.costs") |
| `src/components/suppliers/supplier-detail.tsx` | Payment history table | VERIFIED | "История платежей" at line 417, payments rendered from debt.payments[] |

#### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/__tests__/e2e/supplier-debts.e2e.test.ts` | 8 E2E tests, min 200 lines | VERIFIED | 345 lines, 8 test cases, all pass |
| `src/__tests__/helpers/fixtures.ts` | createTestSupplier and createTestOrderWithSupplier | VERIFIED | createTestSupplier at line 287, createTestOrderWithSupplier at line 309 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/orders.ts` | `prisma/schema.prisma` | `tx.supplierPayment.create` | WIRED | Line 556: `tx.supplierPayment.create({data: {debtId...}})` |
| `src/actions/orders.ts` | `src/lib/audit.ts` | `createAuditEntry` | WIRED | Imported at line 14; called at lines 495, 578, 661 |
| `src/components/suppliers/debt-payment-dialog.tsx` | `src/actions/orders.ts` | `paySupplierDebt` | WIRED | Imports and calls paySupplierDebt |
| `src/components/dashboard/dashboard-content.tsx` | `src/actions/dashboard.ts` | `supplierDebtsTotal/Count` | WIRED | Lines 146-156 render StatCard when count > 0; data sourced from getDashboardData which guards with orders.costs permission |
| `src/components/layout/app-sidebar.tsx` | `src/app/(dashboard)/suppliers/debts/page.tsx` | `href="/suppliers/debts"` | WIRED | Line 118: `href: "/suppliers/debts"` |
| `src/__tests__/e2e/supplier-debts.e2e.test.ts` | `src/actions/orders.ts` | `paySupplierDebt` calls | WIRED | Line 42: imports paySupplierDebt, updateOrderCosts, cancelOrderWithDecision |
| `order-detail.tsx SupplierDialog` | `Supplier.city (supplierCityFromRelation)` | initial city value | NOT WIRED | supplierCityFromRelation returned by getOrder (line 228) but never passed to SupplierDialog; city state initialises as "" |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SUP-01 | Plans 01, 03 | SupplierDebt создаётся от purchasePrice (costPrice*qty) | SATISFIED | orders.ts:483-504; E2E test passes |
| SUP-02 | — (voided) | purchasePrice обязательное для ORDERED | VOIDED | Explicitly voided in 13-CONTEXT.md lines 26-27: "Без блокировки ORDERED — purchasePrice не требуется". Plan 01 notes: "SUP-02 is voided by CONTEXT.md user decision". REQUIREMENTS.md line 197 shows [ ] (unchecked). |
| SUP-03 | Plan 02 | Карточка заказа: Цена клиенту / Закуп / Прибыль | SATISFIED | order-detail.tsx:366-424, guarded by canSeeCosts |
| SUP-04 | Plans 01, 02 | Город поставщика автозаполняется из Supplier.city при ORDERED | PARTIAL | City is displayed (order.supplierCity) but NOT auto-filled from Supplier.city. supplierCityFromRelation returned but not wired to SupplierDialog. |
| SUP-05 | Plans 01, 03 | SupplierDebt.amount можно обновить | SATISFIED | updateOrderCosts recalculates with payment-awareness; E2E SUP-05 passes |
| SUP-06 | Plans 01, 02, 03 | markSupplierDebtPaid создаёт CashOperation изъятие | SATISFIED | paySupplierDebt creates CashOperation(WITHDRAW, shiftId=null) + SupplierPayment; E2E SUP-04 test passes |
| SUP-07 | Plan 02 | Страница /suppliers/debts с фильтрами и итогами | SATISFIED | Page exists, uses SupplierDebtsClient with totals |
| SUP-08 | Plan 02 | Дашборд: карточка "Долги поставщикам" | SATISFIED | dashboard-content.tsx:146-156, permission-guarded via data layer |
| SUP-09 | Plan 02 | История платежей поставщику в карточке | SATISFIED | supplier-detail.tsx line 417, payments table renders |

**SUP-02 disposition:** Voided by explicit user decision captured in 13-CONTEXT.md. REQUIREMENTS.md marks it unchecked [ ] and the plan documents this as intentional scope change. This is not a gap — it is a tracked decision.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found in Phase 13 modified files | — | — | — | — |

No TODO/FIXME/placeholder/stub patterns found in any of the 10 Phase 13 files. All key functions are substantive.

### Human Verification Required

#### 1. Supplier city auto-fill behavior

**Test:** Open an order with a supplier. Navigate to PREPAID status. Click "Заказать у поставщика". Observe the "Город поставщика" field.
**Expected:** Field should be pre-populated with the supplier's city value from the Supplier record.
**Why human:** `supplierCityFromRelation` is in the component data but the prop-to-state wiring is not present; requires visual confirmation of the actual dialog state.

#### 2. DebtPaymentDialog — partial payment flow

**Test:** Navigate to /suppliers/debts or open a supplier card with an unpaid debt. Click "Оплатить". Enter a partial amount (less than the debt). Submit. Verify the remaining amount. Pay the rest.
**Expected:** First payment: debt status stays unpaid, remaining decreases. Second payment: debt marked as fully paid. Toast notifications appear for both operations.
**Why human:** Real-time UI state transitions and toast messages require browser interaction.

#### 3. Dashboard permission guard

**Test:** Log in as a user without `orders.costs` permission. Check the dashboard.
**Expected:** "Долги поставщикам" card is NOT visible.
**Why human:** Requires login as a different user role to confirm conditional rendering.

### Gaps Summary

One gap blocks full goal achievement: **SUP-04 auto-fill of supplier city from Supplier.city** is not wired. The data is available — `supplierCityFromRelation` is returned from `getOrder` action (line 228) — but it is never passed to `SupplierDialog` as an initial value. The dialog's city state initialises as `""` regardless of whether a supplier with a known city is attached to the order.

The fix is small in scope:
1. Pass `supplierCityFromRelation` as `initialCity` prop to `SupplierDialog` (order-detail.tsx ~line 660)
2. Update `SupplierDialog` signature to accept `initialCity?: string` and initialise `useState(initialCity ?? "")`

All other requirements (SUP-01, 03, 05, 06, 07, 08, 09) are fully satisfied. SUP-02 is intentionally voided. The E2E test suite (8 tests, all passing) confirms backend correctness. TypeScript compiles cleanly for all Phase 13 files. Prisma schema validates.

---

_Verified: 2026-04-12T22:50:00Z_
_Verifier: Claude (gsd-verifier)_
