# Architecture

## Pattern

**Server-Driven Next.js 14+ Monolith (App Router)**

Single Next.js application serving both UI and backend logic. No separate API server — all mutations happen through Server Actions (`"use server"`). Minimal client-side state; the server is the source of truth.

## Layers

```
┌─────────────────────────────────────────────┐
│  Presentation Layer                          │
│  src/app/         — Pages (Server Components)│
│  src/components/  — UI Components (Client)   │
├─────────────────────────────────────────────┤
│  Action Layer                                │
│  src/actions/     — Server Actions           │
│  (auth checks, permission guards, business   │
│   logic, Prisma queries, mutations)          │
├─────────────────────────────────────────────┤
│  Library Layer                               │
│  src/lib/         — Shared services          │
│  (auth, permissions, db, format, validations)│
├─────────────────────────────────────────────┤
│  Data Layer                                  │
│  prisma/schema.prisma — 51 models            │
│  src/generated/prisma — Generated client     │
│  PostgreSQL database                         │
└─────────────────────────────────────────────┘
```

### Layer Rules

1. **Pages** (`src/app/`) are Server Components. They call actions to fetch data, check permissions via `src/lib/permissions.ts`, and render component trees.
2. **Components** (`src/components/`) are `"use client"`. They receive data as props or call server actions directly for mutations. No direct Prisma access.
3. **Actions** (`src/actions/`) are `"use server"`. Every action starts with auth check (`auth()`) and permission guard (`requirePermission()`). Actions own all business logic and data access.
4. **Library** (`src/lib/`) provides cross-cutting utilities: auth config, DB singleton, permission system, formatting, validation schemas.
5. **No API routes** for internal use — only `src/app/api/auth/` for NextAuth.js callback handling.

## Data Flow

### Read Path
```
Server Component (page.tsx)
  → await auth() — get session
  → await requirePermission("module.action", storeId)
  → await getXxx() — server action fetches + transforms data
  → <ClientComponent data={data} />
```

### Write Path
```
Client Component (button click / form submit)
  → Server Action (src/actions/xxx.ts)
    → auth() + requirePermission()
    → Zod validation (src/lib/validations/)
    → db.$transaction() for multi-step mutations
    → return result
  → toast.success/error + reload data
```

## Permission Model

**Role-based with optional store scoping.** Each user has roles via `UserRole`, and roles have permissions via `RolePermission`. Permissions follow the pattern `"module.action"` (e.g., `"catalog.edit"`, `"orders.manage"`).

Key files:
- `src/lib/permissions-list.ts` — All permission constants
- `src/lib/permissions.ts` — `requirePermission()` and `checkPermission()` functions
- `src/lib/auth.ts` — NextAuth.js config with Prisma adapter

Permission flow:
```
requirePermission("orders.manage", storeId)
  → Loads user roles for the store
  → Checks if any role has the permission
  → Throws "Нет доступа" if denied
```

## State Management

- **Server-first**: Most state lives on the server. Pages re-fetch after mutations.
- **Zustand**: Only for POS cart state (`src/hooks/use-cart.ts`) — needs client-side reactivity for real-time cart updates.
- **URL state**: Filters, search queries, pagination in URL params.
- **React `useTransition`**: Used extensively for optimistic UI during server action calls.

## Key Abstractions

### Counter System (`src/lib/counters.ts`)
Generates sequential document numbers (e.g., `S-000001` for sales, `CO-000001` for custom orders). Uses `Counter` model with atomic increment.

### Serial Unit Tracking
`SerialUnit` model tracks IMEI/serial numbers through lifecycle: `IN_STOCK → RESERVED → SOLD / RETURNED`. `SerialUnitHistory` provides audit trail.

### Custom Order State Machine
`CustomOrder.status` follows: `NEW → PREPAID → ORDERED → IN_TRANSIT → ARRIVED → READY_FOR_PICKUP → COMPLETED` with `CANCELLED` as escape from any non-terminal state. Transitions enforced in `src/actions/orders.ts`.

### Repair State Machine
`Repair.status` follows: `RECEIVED → DIAGNOSING → WAITING_PARTS → IN_PROGRESS → DONE → RETURNED` with `CANCELLED` escape. Managed in `src/actions/repairs.ts`.

### Motivation System
JSON-based formula builder for sales motivation. `MotivationScheme` stores calculation rules, `MotivationAssignment` links schemes to users, `Payroll` stores calculated results.

## Entry Points

| Entry Point | Path | Purpose |
|---|---|---|
| Root layout | `src/app/layout.tsx` | HTML wrapper, providers |
| Auth layout | `src/app/(auth)/layout.tsx` | Login page layout |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` | Sidebar, header, store selector |
| Auth API | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth.js handlers |
| Seed script | `prisma/seed.ts` | Database seeding |

## Database

- **PostgreSQL** via Prisma ORM (v7.4+)
- **51 models** in `prisma/schema.prisma` (1101 lines)
- Generated client at `src/generated/prisma`
- Transactions used for multi-step operations (sales, order completion, stock transfers)
- Decimal type for all monetary values
