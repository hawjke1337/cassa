# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**None Detected**
- No external API integrations present in current codebase
- Future planned integrations per design:
  - Online store API (Wave 3)
  - Telegram parser (Wave 3) - gram.js for algorithmic parsing (no LLM)
  - Fiscal integration (Wave 3)

## Data Storage

**Databases:**
- PostgreSQL 16+
  - Connection: `DATABASE_URL` environment variable
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://user:password@localhost:5432/astore_erp`
  - Client: Prisma ORM with PostgreSQL adapter (`@prisma/adapter-pg`)
  - Schema location: `prisma/schema.prisma` (1102 lines)

**File Storage:**
- Local filesystem only
  - Public assets: `public/` directory
  - User uploads: Not implemented in current phase

**Caching:**
- None - Not applicable for MVP

## Authentication & Identity

**Auth Provider:**
- Custom authentication (NextAuth.js Credentials provider)
  - Implementation: `src/lib/auth.ts` and `src/lib/auth.config.ts`
  - Strategy: JWT-based sessions
  - Password hashing: bcryptjs (bcrypt algorithm)

**Login Flow:**
- Credentials provider (username/password)
  - Fields: `login`, `password`
  - User lookup: `User` table (unique `login` field)
  - Password verification: bcrypt compare
  - Active status check: `isActive` field required

**Session Management:**
- JWT strategy (server-side tokens, no database sessions)
- Callback location: `src/app/api/auth/[...nextauth]/route.ts`
- Session enrichment:
  - User ID, login
  - Roles (from `UserRole` table)
  - Permissions (calculated from `RolePermission` associations)
- Session data loaded in: `src/lib/auth.ts` callbacks
- Middleware protection: `src/middleware.ts`

**Authorization:**
- Role-based access control (RBAC)
  - Tables: `Role`, `Permission`, `RolePermission`, `UserRole`
  - Per-role permission assignment
  - Store-specific roles via `storeId` in `UserRole`
  - Permission codes loaded on JWT refresh
  - Checker: `src/lib/permissions.ts`

**Secrets:**
- `NEXTAUTH_SECRET` - JWT encryption secret (required, env var)
- `NEXTAUTH_URL` - Auth callback URL (required, env var, defaults to `http://localhost:3000`)

## Monitoring & Observability

**Error Tracking:**
- Not detected (No Sentry, LogRocket, or similar service)

**Logs:**
- Console logging only (no external service)
- Structured logging: Not implemented in current phase

## CI/CD & Deployment

**Hosting:**
- Docker-based deployment (self-hosted VPS or own server per project memory)
- Production output: Next.js standalone mode (self-contained)
- Container: `node:20-alpine` (37 MB base image)

**CI Pipeline:**
- Not detected (No GitHub Actions, GitLab CI, or Jenkins configuration)

**Containerization:**
- Docker Compose for local development
  - Services: PostgreSQL 16 (Alpine), Next.js app
  - Network: Service-to-service via Docker DNS
  - Database init: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB via env
  - Data persistence: Named volume `postgres_data`
- Dockerfile for production
  - Multi-stage build: deps → builder → runner
  - Build steps: npm ci, prisma generate, next build
  - Final image user: Non-root `nextjs` (UID 1001)
  - Port: 3000 (configurable via PORT env)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (critical)
- `NEXTAUTH_SECRET` - JWT encryption key (critical)
- `NEXTAUTH_URL` - Auth callback URL, defaults `http://localhost:3000` in dev

**Optional env vars:**
- `NODE_ENV` - Set to `production` in container, defaults to dev
- `PORT` - Server port, defaults 3000
- `HOSTNAME` - Bind address, defaults `0.0.0.0` in container

**Secrets location:**
- `.env` file (git-ignored)
- Docker environment variables (via `-e` flags or `.env` file)
- Docker Compose: `docker-compose.yml` (embedded dev credentials, unsafe for production)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/auth/callback/credentials` - NextAuth credentials callback
- `GET /api/auth/signin` - Sign-in page redirect
- `GET /api/auth/signout` - Sign-out endpoint
- No custom webhook endpoints in current implementation

**Outgoing:**
- None detected (Telegram integration planned for Wave 3)

## Database Schema Integration Points

**Key integration tables:**

- `User` - Authentication identity (login, password hash)
- `UserRole` - Role assignment (per-user, per-store)
- `Role` - Permission containers
- `Permission` - Fine-grained access control codes
- `Store` - Multi-tenant context (5 retail locations)
- `Session` (via NextAuth adapter) - JWT token management (not visible in schema)

**Related data models:**
- `SupplierDebt` - Wholesale accounts receivable (debt tracking)
- `SerialUnit` - IMEI/SN tracking (per product, per store)
- `MotivationScheme` - JSON-based commission formula storage
- `DocumentTemplate` - JSON-based document layout storage
- `PriceLabelTemplate` - JSON-based price label layout storage

## Third-Party SDKs & Packages

**UI Components (No Backend Integration):**
- shadcn/ui - Pure frontend (no API)
- Lucide React - Icons only
- TanStack Table - Data display (no API)

**Utilities (No External Integration):**
- date-fns - Date formatting
- clsx, tailwind-merge - CSS utilities
- bcryptjs - Password hashing (pure crypto)
- jsbarcode, qrcode.react - Visual generation (local)

---

*Integration audit: 2026-03-17*
