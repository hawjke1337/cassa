# Structure

## Directory Layout

```
astore-erp/
├── prisma/
│   ├── schema.prisma          # 51 models, 1101 lines
│   ├── seed.ts                # Database seeding
│   └── migrations/            # Prisma migrations
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout (providers, fonts)
│   │   ├── (auth)/            # Auth group (login page)
│   │   │   └── login/
│   │   ├── (dashboard)/       # Main app group (sidebar layout)
│   │   │   ├── layout.tsx     # Dashboard shell (sidebar + header)
│   │   │   ├── page.tsx       # Dashboard home
│   │   │   ├── catalog/       # Product catalog management
│   │   │   ├── customers/     # Customer database
│   │   │   ├── inventory/     # Stock receives, transfers, audits, write-offs
│   │   │   ├── motivation/    # Sales motivation schemes + payroll
│   │   │   ├── my/            # User's own profile/settings
│   │   │   ├── orders/        # Custom orders (товары на заказ)
│   │   │   ├── pos/           # Point of Sale terminal
│   │   │   ├── print/         # Print views (receipts, labels, documents)
│   │   │   ├── repairs/       # Device repair tracking
│   │   │   ├── reports/       # Sales and inventory reports
│   │   │   ├── settings/      # Admin settings (roles, users, stores)
│   │   │   ├── shifts/        # Shift management + cash operations
│   │   │   ├── suppliers/     # Supplier management
│   │   │   ├── trade-in/      # Device trade-in / buyback
│   │   │   └── warranty/      # Warranty claims
│   │   └── api/
│   │       └── auth/          # NextAuth.js route handler
│   ├── actions/               # Server Actions (26 files)
│   │   ├── catalog.ts         # Product CRUD, categories, brands
│   │   ├── orders.ts          # Custom orders lifecycle
│   │   ├── sales.ts           # POS sales creation
│   │   ├── inventory.ts       # Stock operations
│   │   ├── repairs.ts         # Repair lifecycle
│   │   ├── serial-units.ts    # IMEI/SN tracking
│   │   ├── shifts.ts          # Shift open/close
│   │   ├── motivation-*.ts    # 5 files for motivation subsystem
│   │   ├── trade-in.ts        # Trade-in operations
│   │   ├── warranty-claims.ts # Warranty management
│   │   └── ...                # settings, stores, suppliers, etc.
│   ├── components/            # UI components by module
│   │   ├── ui/                # shadcn/ui primitives (button, input, dialog, etc.)
│   │   ├── catalog/           # Product list, forms, import dialogs
│   │   ├── pos/               # POS terminal, cart, payment dialogs
│   │   ├── orders/            # Order form, detail, timeline
│   │   ├── repairs/           # Repair form, list, detail
│   │   ├── serial/            # Serial unit picker, IMEI search dialog
│   │   ├── motivation/        # Scheme builder, assignment, payroll
│   │   ├── settings/          # Role editor, user management, store config
│   │   ├── layout/            # Header, sidebar, store selector
│   │   ├── print/             # Print-optimized receipt/document views
│   │   └── ...                # suppliers, warranty, reports, etc.
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-cart.ts        # Zustand POS cart store
│   │   ├── use-current-store.ts # Active store context
│   │   └── use-mobile.ts     # Mobile viewport detection
│   ├── lib/                   # Shared library code
│   │   ├── auth.ts            # NextAuth.js configuration
│   │   ├── auth.config.ts     # Auth providers config
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── permissions.ts     # Permission check functions
│   │   ├── permissions-list.ts # All permission constants
│   │   ├── counters.ts        # Sequential number generator
│   │   ├── format.ts          # Money, date formatting
│   │   ├── imei-utils.ts      # IMEI validation, Luhn check
│   │   ├── stock-helpers.ts   # Stock calculation utilities
│   │   ├── utils.ts           # cn() helper, misc
│   │   ├── document-variables.ts # Template variable definitions
│   │   ├── default-document-templates.ts # Default print templates
│   │   └── validations/       # Zod schemas per module
│   │       ├── catalog.ts
│   │       ├── serial.ts
│   │       ├── shifts.ts
│   │       ├── trade-in.ts
│   │       ├── warranty.ts
│   │       ├── motivation.ts
│   │       ├── price-labels.ts
│   │       └── document-templates.ts
│   ├── types/
│   │   └── next-auth.d.ts     # NextAuth type augmentation
│   └── generated/
│       └── prisma/            # Prisma generated client
├── docs/
│   └── plans/                 # Design documents
├── public/                    # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── components.json            # shadcn/ui config
```

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files (pages, components) | kebab-case | `order-detail.tsx`, `use-cart.ts` |
| Directories | kebab-case | `trade-in/`, `serial/` |
| React components | PascalCase | `OrderDetail`, `SerialUnitPicker` |
| Server actions | camelCase | `createOrder`, `updateOrderStatus` |
| Prisma models | PascalCase | `CustomOrder`, `SerialUnit` |
| DB fields | camelCase | `serialUnitId`, `requiresImei` |
| Permissions | dot notation | `"catalog.edit"`, `"orders.manage"` |
| Document numbers | PREFIX-NUMBER | `S-000001`, `CO-000001` |
| Zod schemas | camelCase + Schema | `tradeInSchema`, `warrantyClaimSchema` |

## Where to Add Code

| Adding... | Location | Convention |
|---|---|---|
| New page/route | `src/app/(dashboard)/{feature}/page.tsx` | Server Component, calls actions |
| New component | `src/components/{feature}/{name}.tsx` | `"use client"`, receives data as props |
| New server action | `src/actions/{feature}.ts` | `"use server"`, auth + permission first |
| New Zod schema | `src/lib/validations/{feature}.ts` | Export named schema |
| New permission | `src/lib/permissions-list.ts` | Add to `PERMISSIONS` object |
| New Prisma model | `prisma/schema.prisma` | Run `npx prisma migrate dev` |
| New hook | `src/hooks/use-{name}.ts` | Custom hook pattern |
| New print view | `src/app/(dashboard)/print/{type}/[id]/page.tsx` | Print-optimized layout |

## Module Structure Pattern

Each feature module follows this pattern:

```
Feature Page:       src/app/(dashboard)/{feature}/page.tsx
Detail Page:        src/app/(dashboard)/{feature}/[id]/page.tsx
Components:         src/components/{feature}/{feature}-list.tsx
                    src/components/{feature}/{feature}-form.tsx
                    src/components/{feature}/{feature}-detail.tsx
Server Actions:     src/actions/{feature}.ts
Validation Schema:  src/lib/validations/{feature}.ts  (if complex)
```

Not all modules have all files — simpler modules (like customers) may just have actions + a single list component.

## Key File Sizes (approximate)

| File | Lines | Purpose |
|---|---|---|
| `prisma/schema.prisma` | 1101 | All 51 data models |
| `src/actions/orders.ts` | ~700 | Custom order lifecycle |
| `src/actions/catalog.ts` | ~600 | Product management |
| `src/components/orders/order-detail.tsx` | ~1300 | Order detail view + dialogs |
| `src/components/pos/pos-terminal.tsx` | ~800 | POS interface |
| `src/components/motivation/scheme-builder.tsx` | ~700 | Motivation formula builder |
| `src/lib/permissions-list.ts` | ~200 | All permission definitions |
