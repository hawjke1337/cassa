# Concerns

## Critical

### No Automated Tests
- **Impact**: High — business logic in server actions is untested
- **Risk**: Regressions during feature additions, especially in interconnected modules (orders → sales → serial units → inventory)
- **Location**: Entire codebase — no test files exist
- **Mitigation**: TypeScript strict mode + Zod validation catch type/schema errors, but logic errors go undetected

### Large Component Files
- **Impact**: Medium — difficult to maintain and review
- **Files**:
  - `src/components/orders/order-detail.tsx` (~1300 lines) — order detail + 8 inline dialog components
  - `src/components/pos/pos-terminal.tsx` (~800 lines) — POS terminal + cart + payment
  - `src/components/motivation/scheme-builder.tsx` (~700 lines) — motivation formula builder
- **Risk**: Growing complexity, hard to isolate changes
- **Suggestion**: Extract dialog components into separate files

### Server Action Files Growing Large
- **Impact**: Medium — `src/actions/orders.ts` at ~700 lines with 10+ exported functions
- **Risk**: Mixed concerns, difficult to test individual functions
- **Pattern**: Each action file handles CRUD + lifecycle + search for its module

## Security

### Session-Based Auth Without CSRF
- NextAuth.js handles sessions, but server actions don't explicitly validate CSRF tokens
- Next.js provides built-in CSRF protection for server actions, but worth verifying configuration

### Permission Check Consistency
- All server actions manually call `requirePermission()` — no middleware enforcement
- **Risk**: A new action missing the permission check would be open to any authenticated user
- **Location**: Every file in `src/actions/`

### No Rate Limiting
- Server actions have no rate limiting
- **Risk**: Brute-force attacks on login, abuse of search endpoints
- **Impact**: Low for internal tool, higher if exposed externally

## Technical Debt

### Inconsistent Error Handling in Components
- Some components use `catch { /* ignore */ }` pattern (found in search/autocomplete handlers)
- Most use `toast.error()` — but a few swallow errors silently
- **Files**: Various `AddItemsDialog`, search handlers in order/inventory components

### `any` Type Usage in Server Actions
- `const updateData: any = { status: newStatus }` pattern in `src/actions/orders.ts`
- Used to build dynamic update objects — should be typed with Prisma's generated types
- **Impact**: Low — contained within action functions, not exposed

### Duplicate Payment Dialog Components
- `PaymentDialog` and `FinalPaymentDialog` in `src/components/orders/order-detail.tsx` share ~80% of code
- Similar pattern in POS payment dialogs
- Could be consolidated into a single configurable component

### Hard-Coded Russian Strings
- All UI strings are hard-coded in Russian throughout components
- **Risk**: Makes future internationalization (i18n) expensive
- **Impact**: Low — owner confirmed single-language for now

## Performance

### No Query Optimization
- Server actions use Prisma's `include` for eager loading — no query batching or DataLoader pattern
- **Risk**: N+1 queries possible in list views with nested relations
- **Impact**: Low at current scale (5 stores, <50 concurrent users)

### No Caching Strategy
- Every page load re-fetches all data from database
- No `unstable_cache`, no Redis, no ISR
- **Impact**: Low at current scale, but will matter with reporting/analytics modules

### Large Prisma Schema
- 51 models in single schema file (1101 lines)
- Prisma client generation is fast, but schema is hard to navigate
- Could benefit from comments/sections (partially done)

## Data Consistency

### No Soft Deletes
- Products, categories, and other entities use hard deletes
- **Risk**: Orphaned references if delete cascades aren't properly configured
- **Mitigation**: Prisma schema defines cascade rules on relations

### Decimal Precision for Money
- Using Prisma `Decimal` type — correct approach
- However, JavaScript `Number()` conversion happens in server actions when returning data
- **Risk**: Precision loss on very large amounts (unlikely at retail scale)

### Serial Unit State Machine Not Enforced at DB Level
- `SerialUnit.status` transitions are enforced only in application code
- **Risk**: Direct DB access or bugs could create invalid state transitions
- **Location**: `src/actions/serial-units.ts`, `src/actions/orders.ts`, `src/actions/sales.ts`

## Fragile Areas

### Order Completion Flow
- `updateOrderStatus("COMPLETED")` in `src/actions/orders.ts` does 5+ operations in one transaction:
  1. Creates Sale + SaleItems + Payments
  2. Updates order status + completedAt
  3. Marks SerialUnits as SOLD + creates history
  4. Links sale to order
- **Risk**: Any failure mid-transaction rolls back everything — but error messages may be confusing to users

### Motivation Calculation
- JSON-based formula evaluation in `src/actions/motivation-calculation.ts`
- Complex nested conditions and calculations
- **Risk**: Edge cases in formula evaluation could produce wrong payroll numbers
- No automated tests to verify calculation correctness

### Stock Quantity Calculations
- `src/lib/stock-helpers.ts` computes available stock from multiple sources (receives, transfers, sales, write-offs, audits)
- **Risk**: Missing a new stock movement type would silently produce wrong quantities
