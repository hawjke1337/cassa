# Testing

## Current State

**No automated testing framework is configured.** The project has no test runner (Jest, Vitest, Playwright, Cypress), no test files, and no test scripts in `package.json`.

## Validation Strategy (In Lieu of Tests)

The project relies on these validation layers instead of automated tests:

### 1. TypeScript Strict Mode
- `tsconfig.json` with strict settings
- Prisma generates typed client — model/field errors caught at compile time
- `npx tsc --noEmit` used as verification step

### 2. Zod Runtime Validation
- Input validation schemas in `src/lib/validations/`
- Covers: catalog, serial, shifts, trade-in, warranty, motivation, price-labels, document-templates
- Server actions parse inputs with Zod before processing

### 3. Prisma Schema Constraints
- Database-level constraints: `@unique`, `@default`, required fields
- Decimal type for monetary values prevents floating-point issues
- Relation constraints enforce referential integrity

### 4. Permission Guards
- Every server action starts with `auth()` + `requirePermission()`
- Invalid access throws immediately — acts as integration guard

### 5. Manual Testing
- Dev server (`npm run dev`) with Turbopack
- Seed data (`prisma/seed.ts`) provides realistic test data
- Owner tests features manually through the UI

## Recommendations for Future Testing

### Priority 1: Server Action Integration Tests
The server actions contain the most critical business logic (order lifecycle, stock operations, payment processing). These would benefit most from automated testing.

Suggested approach:
- Vitest + Prisma test utilities
- Test against a real test database (not mocks)
- Focus on state machine transitions (order status, repair status, serial unit lifecycle)

### Priority 2: E2E Tests for Critical Paths
- POS sale completion flow
- Custom order lifecycle (NEW → COMPLETED)
- Stock receive with serial unit registration

### Priority 3: Component Tests
- Motivation scheme builder (complex JSON formula logic)
- POS cart calculations
- Price label template editor

## Test Data

`prisma/seed.ts` creates:
- Stores (5 retail locations)
- Users with roles and permissions
- Categories (with serialization flags: smartphones, tablets marked as serialized)
- Sample products with store assignments
- Serial units with IMEI data
