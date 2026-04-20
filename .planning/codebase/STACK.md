# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- TypeScript 5+ - All source code, strict mode enabled
- JavaScript (ESM) - Configuration files, build scripts

**Secondary:**
- SQL - PostgreSQL database

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Docker base image specifies `node:20-alpine`
- npm 10+ (inferred from package-lock.json structure)

**Package Manager:**
- npm with lock file present (`package-lock.json`)
- Lockfile version: 3 (modern format)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router
  - Features: API routes, middleware, server components, SSG/SSR
  - Output: `standalone` mode for Docker deployment
- React 19.2.3 - UI library
- React DOM 19.2.3 - DOM rendering

**Forms & Validation:**
- React Hook Form 7.71.2 - Form state management
- @hookform/resolvers 5.2.2 - Schema validation adapters
- Zod 4.3.6 - TypeScript-first schema validation library

**State Management:**
- Zustand 5.0.11 - Global state management (lightweight alternative to Redux)
- Zustand middleware: `persist` - Local storage persistence

**UI & Components:**
- shadcn/ui - Accessible component library (using Base UI Apex components)
- @base-ui/react 1.2.0 - Headless component framework
- TailwindCSS 4+ - Utility-first CSS framework
- @tailwindcss/postcss 4+ - TailwindCSS PostCSS plugin
- Class Variance Authority 0.7.1 - Component variant management
- clsx 2.1.1 - className utility
- tailwind-merge 3.5.0 - Merge conflicting Tailwind classes
- tw-animate-css 1.4.0 - Animation utilities
- Lucide React 0.577.0 - Icon library (577+ icons)

**Tables & Data Display:**
- TanStack Table (React Table) 8.21.3 - Headless table library
- @hello-pangea/dnd 18.0.1 - Drag-and-drop for React (fork of React Beautiful DnD)

**Document Generation:**
- @react-pdf/renderer 4.3.2 - PDF generation from React components
  - Used for: Price labels, receipts, repair documents

**Barcodes & QR Codes:**
- jsbarcode 3.12.3 - 1D barcode generation (Code128, Code39, etc.)
- qrcode.react 4.2.0 - QR code generation

**Authentication:**
- next-auth 5.0.0-beta.30 - NextAuth.js authentication framework
- @auth/prisma-adapter 2.11.1 - Prisma session/token adapter for NextAuth
- bcryptjs 3.0.3 - Password hashing (bcrypt algorithm)

**Date/Time:**
- date-fns 4.1.0 - Modern date utility library
- react-day-picker 9.14.0 - Calendar component for date selection

**UI/UX:**
- sonner 2.0.7 - Toast notifications (styled toasts)
- next-themes 0.4.6 - Dark/light mode theme management
- cmdk 1.1.1 - Command menu component (cmd+k)

**Testing:**
- Not detected (No Jest, Vitest, or testing framework in dependencies)

**Build/Dev:**
- tsx 4.21.0 - TypeScript executor for Node.js scripts (seed, migrations)
- ESLint 9+ - Linting
- eslint-config-next 16.1.6 - Next.js ESLint rules
- dotenv 17.3.1 - Environment variable management (dev only)

## Key Dependencies

**Critical:**
- Prisma 7.4.2 - ORM for PostgreSQL database operations
  - Client: @prisma/client 7.4.2 - Query builder and ORM client
  - Adapter: @prisma/adapter-pg 7.4.2 - Native PostgreSQL adapter (edge-compatible)
  - Custom location: `src/generated/prisma` - Schema in `prisma/schema.prisma`

**Database:**
- pg 8.20.0 - Node.js PostgreSQL driver (used by Prisma adapter)
  - Connection pooling via native `Pool` class
  - Uses environment variable: `DATABASE_URL`

## Configuration

**Environment:**
- Load via environment variables from `.env` file
- Example template: `.env.example` provided
- Key variables required:
  - `DATABASE_URL` - PostgreSQL connection string (required)
  - `NEXTAUTH_SECRET` - Session encryption secret (required)
  - `NEXTAUTH_URL` - Auth callback URL, defaults to `http://localhost:3000` (required)

**Build Configuration:**
- `tsconfig.json` - TypeScript strict mode enabled
  - Target: ES2017
  - Module resolution: bundler (Next.js optimized)
  - Path aliases: `@/*` → `./src/*`
  - Generated types: `.next/types/**/*.ts`
- `next.config.ts` - Next.js configuration
  - Output: `standalone` (Docker-optimized, self-contained build)
- `eslint.config.mjs` - ESLint configuration (flat config format)
  - Uses Next.js core-web-vitals and TypeScript presets
  - Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- `postcss.config.mjs` - PostCSS configuration
  - Uses TailwindCSS 4 PostCSS plugin

## Platform Requirements

**Development:**
- Node.js 20 (Alpine-compatible environment recommended)
- PostgreSQL 16+ (or compatible)
- npm 10+

**Production:**
- Docker deployment target (VPS or self-hosted server planned per project memory)
- Container runtime: Docker or Kubernetes
- Database: PostgreSQL 16+ (external or containerized)
- Typical: Node.js 20 Alpine, 512MB+ RAM, 2+ CPU cores

---

*Stack analysis: 2026-03-17*
