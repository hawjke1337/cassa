# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- Kebab-case for most files: `product-form.tsx`, `use-current-store.ts`, `stock-helpers.ts`
- Index files for barrel exports: `src/components/ui/index.ts` (implied pattern)
- Page files in Next.js app router: `page.tsx`, `layout.tsx`, `error.tsx`
- Server action files: `inventory.ts`, `catalog.ts`, `sales.ts` (all in `src/actions/`)
- Validation files: `catalog.ts`, `serial.ts`, `price-labels.ts` (all in `src/lib/validations/`)

**Functions:**
- camelCase for all function and method names
- Descriptive names with action verbs: `getProducts()`, `createProduct()`, `updateQuantity()`, `requirePermission()`
- Async functions prefixed with get/fetch/create/update/delete pattern: `getStock()`, `searchPosProducts()`, `createProduct()`
- Hook functions use `use` prefix: `useCurrentStore`, `useCart`, `useRouter`, `useForm`
- Handler functions: `addItem`, `removeItem`, `applyDiscount`

**Variables:**
- camelCase for all variables and constants
- Boolean variables prefixed with `is`, `has`, `can`: `isEdit`, `isPending`, `canSeePrices`, `hasPermission`
- Collections use plural names: `items`, `categories`, `products`, `permissions`
- Private/internal variables use prefix pattern: `_count` for groupBy aggregates
- State/store variables: `currentStoreId`, `currentStoreName` (from Zustand store)

**Types:**
- PascalCase for all type names: `CartItem`, `CartState`, `ProductFormData`, `VariableDefinition`
- Suffixes for clarity: `...Data` for form/payload types, `...Props` for component props
- Type imports use `type` keyword: `import type { ProductFormData } from "@/lib/validations/catalog"`
- Enum values in UPPER_SNAKE_CASE when derived from databases: `IN_STOCK`, `DRAFT`, `PENDING`, `IN_TRANSIT`
- Type unions with `|` for simple cases, intersection types for composition

## Code Style

**Formatting:**
- No explicit formatter configured in repo
- Next.js defaults apply (managed by eslint-config-next)
- 2-space indentation (standard Node.js/TypeScript convention)
- Line length: no explicit limit observed, but practical 80-100 character range followed
- Semicolons: required (TypeScript strict mode enforces this)

**Linting:**
- ESLint 9 with `eslint-config-next` core-web-vitals and TypeScript rules
- Config file: `eslint.config.mjs` (flat config format)
- Rules: Includes Next.js specific rules, TypeScript strict checks, web vitals
- Run: `npm run lint` (runs eslint without specific parameters)
- No Prettier configuration; relies on ESLint for formatting guidance

**TypeScript:**
- Strict mode enabled: `strict: true` in `tsconfig.json`
- Target: ES2017
- Module resolution: bundler (Next.js)
- Path alias: `@/*` maps to `./src/*`
- Allow JS: true (JavaScript files permitted)
- Emit: false (type checking only, no emit)

## Import Organization

**Order:**
1. External library imports (`react`, `next`, `zustand`, etc.)
2. Prisma/ORM imports (`@/generated/prisma`, database types)
3. Internal utility imports (`@/lib/...`)
4. Component imports (`@/components/...`)
5. Hook imports (`@/hooks/...`)
6. Type-only imports (`import type { ... }`)

**Path Aliases:**
- `@/*` consistently used to reference `src/` directory
- Absolute imports throughout codebase
- No relative imports observed in main source files
- Pattern: `import { db } from "@/lib/db"`, `import { Button } from "@/components/ui/button"`

**Export Patterns:**
- Named exports preferred: `export async function getStock()`, `export const useCart = create<CartState>()`
- Default exports for components: `export default function RootLayout()`
- Type exports use `type` keyword: `export type PermissionCode = ...`
- Barrel files used for UI components: individual exports from `card.tsx`, `button.tsx`, etc.

## Error Handling

**Patterns:**
- Throw Error for permission/validation failures: `throw new Error("Не авторизован")`
- Throw Error for state violations: `throw new Error("Приход уже обработан")`
- Error messages in Russian (project language): descriptive and user-facing
- Permission check pattern: `await requirePermission("catalog.view", storeId)` throws if denied
- Validation via Zod schemas: `zodResolver(productSchema)` in React Hook Form
- No try-catch blocks in visible actions (errors bubble to caller)

**Validation:**
- Zod for all form validation: `productSchema`, `categorySchema`, `brandSchema`
- Schema definitions in `src/lib/validations/` directory
- Custom refinement for cross-field validation: `refine()` for serialized category type requirement
- Type inference from schemas: `type ProductFormData = z.infer<typeof productSchema>`

## Logging

**Framework:** No explicit logging framework detected
- Console logging not observed in production code
- Error handling via thrown Error objects with messages
- Toast notifications via Sonner: `import { toast } from "sonner"`
- Server action errors surface through Next.js error boundary system

**Patterns:**
- User-facing error messages in Russian
- Technical context in error message when relevant
- Permission denied message: `Нет доступа: требуется разрешение "{permissionCode}"`
- Validation error messages: `"Название обязательно"`, `"Цена должна быть положительной"`

## Comments

**When to Comment:**
- Guard conditions with intent: `// Serialized items always add as separate line`
- Complex logic explanations: `// For serialized products, get actual serial unit counts`
- Section markers: `// ---- Stock Overview ----`, `// ---- Products ----`
- Business rule clarifications: `// Merge by productId` when handling cart logic

**JSDoc/TSDoc:**
- Not observed in codebase
- Function parameter types are explicit in TypeScript
- Return types are explicit in function signatures

## Function Design

**Size:** Functions are focused and modular
- Average action function: 50-150 lines with clear responsibility
- Common pattern: accept params object, validate, query database, transform, return
- Hooks are concise: typically 30-60 lines with clear state management

**Parameters:**
- Use object parameter pattern for multiple params: `getStock(storeId, { search, categoryId, page, perPage })`
- Required params as positional: `requirePermission(permissionCode, storeId?)`
- Optional params with `?` suffix and defaults in destructuring
- Type annotations always present for async functions in server actions

**Return Values:**
- Return objects with clear structure: `{ items: [...], total, page, perPage }`
- Transform database results to API shape before returning
- No null returns observed; empty arrays/objects preferred: `return []`
- Serialization applied: `Number(sp.sellPrice)` for Decimal to number conversion

## Module Design

**Exports:**
- Modular organization: `src/actions/` for server actions, `src/lib/` for utilities
- Single responsibility: `inventory.ts` handles stock operations, `catalog.ts` handles products
- Utilities grouped by domain: `src/lib/validations/`, `src/lib/auth*`, `src/lib/permissions*`

**Server Actions:**
- File: `src/actions/{domain}.ts`
- Marked with `"use server"` directive at top
- Export individual async functions, no class-based pattern
- All functions async and checked for permissions
- Related operations grouped in same file (e.g., create/update/delete operations)

**Composability:**
- Utility functions extracted to `src/lib/`: `formatMoney()`, `formatDate()`, `cn()`
- Helper functions: `getSerializedCounts()`, `calcTotal()`, `matchItem()`
- Cross-cutting concerns: permissions, database, counters accessed from central utilities
- Zustand stores in `src/hooks/` for client state

## Component Patterns

**Client Components:**
- Marked with `"use client"` directive when using hooks or interactivity
- Use `useTransition()` for form submissions
- Props interface explicitly defined: `interface ProductFormProps { ... }`
- React Hook Form with Zod resolver: `zodResolver(productSchema)`

**Server Components:**
- Default in Next.js 14 App Router
- Async functions for data fetching
- Redirect on permission check: `redirect("/login")`, `redirect("/")`
- Pass computed permissions as props to client components

**UI Components:**
- Base-UI for primitives, shadcn patterns for composed components
- Data attributes for styling: `data-slot="card"`, `data-size="default"`
- Utility function for class merging: `cn(...inputs)` using clsx + tailwind-merge
- Component composition with function components and named exports
