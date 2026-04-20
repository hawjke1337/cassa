# Phase 5: Инфраструктура - Research

**Researched:** 2026-04-05
**Domain:** Testing, Error Handling, Docker, Security Headers, Code Quality, Caching
**Confidence:** HIGH

## Summary

Phase 5 охватывает 8 требований инфраструктурного характера: расширение тестового покрытия (INFRA-01), error/loading boundaries (INFRA-02, INFRA-03), SQL-оптимизация отчётов (INFRA-04), Docker hardening (INFRA-05), security headers (INFRA-06), Prettier + Husky + lint-staged (INFRA-07), revalidation после мутаций (INFRA-08).

Проект уже имеет работающую инфраструктуру: Vitest 4.1.2 с 112 тестами (441ms runtime), multi-stage Docker build, next.config с `output: "standalone"`. Основная работа -- дополнение: добавить error.tsx/loading.tsx в route segments, перевести отчёты на SQL-агрегацию, добавить healthcheck и security headers, настроить code formatting pipeline.

**Primary recommendation:** Все 8 требований хорошо определены в CONTEXT.md с конкретными решениями. Работа преимущественно механическая (copy-paste шаблонов error/loading, добавление revalidatePath вызовов) с одним сложным элементом -- переписывание reports.ts на SQL-агрегацию через Prisma aggregate/groupBy/$queryRaw.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Vitest: дополнить integration-тестами для createSale, createReturn, confirmReceive; mock Prisma client (не реальная БД); < 30 секунд runtime
- error.tsx в КАЖДОМ route segment с shadcn Alert + кнопка retry; global-error.tsx для uncaught; НЕ показывать stack trace в production
- loading.tsx: скелетоны (shadcn Skeleton), не спиннеры; для таблиц skeleton rows, для дашборда skeleton cards; не в мелких вложенных маршрутах
- SQL-агрегация: Prisma aggregate/groupBy или $queryRaw; приоритет getFinancialReport (getProfitReport); цель < 3 секунд за год
- Docker: healthcheck HTTP на /api/health, prisma migrate deploy при старте, env variables без хардкода, .env.example, multi-stage build
- Security headers: poweredByHeader: false, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy; НЕ добавлять CSP
- Prettier + Husky + lint-staged: НЕ форматировать весь проект, только staged files; конфиги первым коммитом
- revalidatePath после ВСЕХ мутаций в catalog, settings, suppliers, customers

### Claude's Discretion
- Точный набор route segments для error.tsx (не все 14 могут быть нужны)
- Skeleton дизайн (количество строк, ширина блоков)
- Prettier конфиг (semi, singleQuote, printWidth)
- Нужен ли ESLint в pre-commit или только Prettier

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Vitest unit/integration тесты для критичной бизнес-логики | Vitest 4.1.2 уже настроен, 112 тестов, vi.mock для Prisma client, pure function pattern в *-utils.ts |
| INFRA-02 | error.tsx в каждом route segment | Next.js 16 error.tsx API, 14 dashboard route segments + auth, shadcn Alert component |
| INFRA-03 | loading.tsx в ключевых route segments | Next.js 16 loading.tsx API, shadcn Skeleton component, 5 ключевых segments |
| INFRA-04 | SQL-агрегация отчётов | Prisma 7 aggregate/groupBy/$queryRaw, reports.ts текущий код загружает все данные |
| INFRA-05 | Docker hardening | Existing multi-stage Dockerfile, healthcheck directive, entrypoint script |
| INFRA-06 | Security headers | next.config.ts headers() API, текущий конфиг пустой |
| INFRA-07 | Prettier + Husky + lint-staged | Prettier 3.8.1, Husky 9.1.7, lint-staged 16.4.0 |
| INFRA-08 | revalidatePath после мутаций | Только orders.ts использует revalidation; catalog, settings, suppliers, customers -- нет |
</phase_requirements>

## Standard Stack

### Core (уже установлено)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.2 | Test framework | Уже в проекте, 112 тестов |
| @prisma/client | 7.4.2 | ORM (aggregate/groupBy/$queryRaw) | Уже в проекте |
| next | 16.1.6 | Framework (error.tsx, loading.tsx, headers) | Уже в проекте |

### Supporting (нужно установить)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prettier | 3.8.1 | Code formatting | INFRA-07 |
| husky | 9.1.7 | Git hooks | INFRA-07 pre-commit |
| lint-staged | 16.4.0 | Run linters on staged files | INFRA-07 |

### Alternatives Considered
Не применимо -- все решения зафиксированы в CONTEXT.md.

**Installation:**
```bash
npm install -D prettier husky lint-staged
```

**Version verification:** Версии проверены через `npm view` 2026-04-05:
- prettier: 3.8.1
- husky: 9.1.7
- lint-staged: 16.4.0
- vitest: 4.1.2 (уже установлен)

## Architecture Patterns

### Route Segments для error/loading boundaries
```
src/app/(dashboard)/
  catalog/         # error.tsx + loading.tsx (таблица)
  customers/       # error.tsx + loading.tsx (таблица)
  inventory/       # error.tsx + loading.tsx (таблица)
  motivation/      # error.tsx
  orders/          # error.tsx + loading.tsx (таблица)
  pos/             # error.tsx + loading.tsx (POS)
  repairs/         # error.tsx
  reports/         # error.tsx + loading.tsx (отчёты)
  settings/        # error.tsx
  shifts/          # error.tsx
  suppliers/       # error.tsx + loading.tsx (таблица)
  trade-in/        # error.tsx
  warranty/        # error.tsx
src/app/(dashboard)/  # error.tsx (dashboard root)
src/app/              # global-error.tsx (fallback)
```

**Рекомендация по discretion:** error.tsx в 13 route segments + global-error.tsx. loading.tsx в 8 segments с таблицами/тяжёлым контентом (catalog, customers, inventory, orders, pos, reports, shifts, suppliers). НЕ добавлять loading.tsx в motivation, repairs, settings, trade-in, warranty (лёгкие страницы или редко используемые).

### Pattern 1: error.tsx (Next.js 16 App Router)
**What:** Client component, ловит ошибки в route segment
**When to use:** Каждый route segment уровня (dashboard)/[section]/
**Example:**
```typescript
// src/app/(dashboard)/catalog/error.tsx
"use client"

import { useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Произошла ошибка</AlertTitle>
        <AlertDescription className="mt-2">
          {process.env.NODE_ENV === "development"
            ? error.message
            : "Не удалось загрузить данные. Попробуйте ещё раз."}
        </AlertDescription>
        <Button variant="outline" onClick={reset} className="mt-4">
          Попробовать снова
        </Button>
      </Alert>
    </div>
  )
}
```

### Pattern 2: global-error.tsx (fallback)
**What:** Client component, ловит uncaught ошибки root layout
**When to use:** Один раз в src/app/
**Example:**
```typescript
// src/app/global-error.tsx
"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Произошла ошибка</h2>
          <p className="text-muted-foreground">
            Что-то пошло не так. Пожалуйста, попробуйте обновить страницу.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  )
}
```
**Note:** global-error.tsx НЕ может использовать shadcn/ui -- нужна собственная html/body обёртка.

### Pattern 3: loading.tsx с скелетонами
**What:** Suspense boundary для route segment
**When to use:** Страницы с таблицами, дашборд
**Example (таблица):**
```typescript
// src/app/(dashboard)/catalog/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function CatalogLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" /> {/* Title */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-64" /> {/* Search */}
        <Skeleton className="h-10 w-32" /> {/* Button */}
      </div>
      <div className="rounded-md border">
        <div className="border-b p-4">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b p-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Pattern 4: Prisma SQL-агрегация
**What:** Замена JS-циклов на SQL через Prisma aggregate/groupBy/$queryRaw
**Example (getSalesReport переписка):**
```typescript
// Вместо загрузки всех Sale + items + payments:
const [summary, chartData, paymentData, topByQty] = await Promise.all([
  // Summary via aggregate
  db.sale.aggregate({
    where,
    _count: true,
    _sum: { totalAmount: true, discountAmount: true, finalAmount: true },
  }),
  
  // Group by day via $queryRaw
  db.$queryRaw`
    SELECT 
      DATE_TRUNC('day', "createdAt")::date as label,
      COUNT(*)::int as count,
      SUM("finalAmount")::float as revenue
    FROM "Sale"
    WHERE "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
    ${params.storeId ? Prisma.sql`AND "storeId" = ${params.storeId}` : Prisma.empty}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY label
  `,
  
  // Payment breakdown via groupBy on joined data
  db.payment.groupBy({
    by: ["method"],
    where: { sale: where },
    _sum: { amount: true },
  }),
  
  // Top products via $queryRaw
  db.$queryRaw`
    SELECT si."productId", p.name, p.sku,
      SUM(si.quantity)::int as qty,
      SUM(si.total)::float as revenue
    FROM "SaleItem" si
    JOIN "Sale" s ON si."saleId" = s.id
    JOIN "Product" p ON si."productId" = p.id
    WHERE s."createdAt" >= ${dateFrom} AND s."createdAt" <= ${dateTo}
    ${params.storeId ? Prisma.sql`AND s."storeId" = ${params.storeId}` : Prisma.empty}
    GROUP BY si."productId", p.name, p.sku
    ORDER BY qty DESC
    LIMIT 10
  `,
])
```

### Pattern 5: revalidatePath
**What:** Инвалидация кэша Next.js после server action мутации
**When to use:** После каждого create/update/delete
**Example:**
```typescript
import { revalidatePath } from "next/cache"

export async function createProduct(storeId: string, data: ProductFormData) {
  // ... business logic ...
  const product = await db.product.create({ data: { ... } })
  revalidatePath("/dashboard/catalog")
  return product
}
```

### Pattern 6: Docker healthcheck + entrypoint
**What:** Проверка здоровья контейнера + миграция при старте
**Example (entrypoint.sh):**
```bash
#!/bin/sh
set -e
npx prisma migrate deploy
exec node server.js
```
**Dockerfile addition:**
```dockerfile
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY entrypoint.sh ./
USER root
RUN chmod +x entrypoint.sh
USER nextjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["./entrypoint.sh"]
```

### Pattern 7: Integration тесты с мок Prisma
**What:** Тест server action бизнес-логики без реальной БД
**Example:**
```typescript
import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock prisma before importing action
vi.mock("@/lib/db", () => ({
  db: {
    sale: { create: vi.fn(), findMany: vi.fn() },
    storeProduct: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((fn) => fn({
      // pass mock tx
      sale: { create: vi.fn() },
      $queryRaw: vi.fn(),
    })),
  },
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => ({ user: { id: "u1", storeId: "s1" } })),
}))

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(),
}))

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
```

### Anti-Patterns to Avoid
- **JS-агрегация в reports:** Загрузка 10000+ записей в память для подсчёта сумм -- использовать SQL-агрегацию
- **Разные стили error.tsx:** Все error.tsx должны иметь единый шаблон, только заголовок раздела может отличаться
- **Spinner вместо Skeleton:** Скелетоны передают структуру страницы, спиннеры -- нет
- **`process.env.NODE_ENV` в error.message:** Проверять только в development, в production -- generic message
- **Форматирование всего проекта сразу:** Огромный diff, невозможно code review

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git hooks | Скрипт в .git/hooks | Husky 9.x | Versioned, shared, cross-platform |
| Staged file filtering | Bash скрипт | lint-staged | Handles edge cases (renames, deletes, partial staging) |
| Code formatting | Manual rules | Prettier | Consistent, zero-config for the team |
| SQL aggregation | JS loops over findMany | Prisma aggregate/groupBy/$queryRaw | 100x performance on large datasets |
| Docker health | Process check | HTTP healthcheck endpoint | Catches app-level failures, not just process alive |

## Common Pitfalls

### Pitfall 1: global-error.tsx без html/body
**What goes wrong:** global-error.tsx не рендерится или ломает layout
**Why it happens:** global-error.tsx заменяет root layout, должен содержать собственные html/body теги
**How to avoid:** Всегда включать `<html><body>` в global-error.tsx, НЕ использовать shadcn components (они зависят от providers в layout)
**Warning signs:** Белый экран при ошибке в root layout

### Pitfall 2: Prisma $queryRaw SQL injection
**What goes wrong:** SQL injection через конкатенацию строк в raw queries
**Why it happens:** Использование шаблонных строк вместо tagged template
**How to avoid:** ВСЕГДА использовать `Prisma.sql` tagged template literal: `db.$queryRaw\`SELECT ... WHERE id = ${id}\`` -- Prisma автоматически параметризует
**Warning signs:** Строковая конкатенация в SQL запросах

### Pitfall 3: Husky не устанавливается после clone
**What goes wrong:** Git hooks не работают у нового разработчика
**Why it happens:** `husky install` не запускается автоматически
**How to avoid:** Добавить `"prepare": "husky"` в package.json scripts (Husky 9.x -- просто `husky`, не `husky install`)
**Warning signs:** Коммиты без форматирования

### Pitfall 4: revalidatePath не работает на dynamic routes
**What goes wrong:** Данные не обновляются после мутации
**Why it happens:** revalidatePath с конкретным path не инвалидирует dynamic segments
**How to avoid:** Использовать parent path: `revalidatePath('/dashboard/catalog')` инвалидирует и catalog/[id], и catalog/new
**Warning signs:** Страница показывает старые данные после edit

### Pitfall 5: Docker multi-stage -- prisma engine binary
**What goes wrong:** `@prisma/client` не находит query engine в production image
**Why it happens:** node_modules/.prisma не копируется в runner stage
**How to avoid:** Копировать prisma engine: `COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma` и `COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma`
**Warning signs:** "PrismaClientInitializationError: Unable to require `libquery_engine`"

### Pitfall 6: Prisma aggregate возвращает Decimal, не number
**What goes wrong:** TypeError при арифметических операциях
**Why it happens:** Prisma aggregate _sum возвращает Prisma.Decimal (для Decimal полей), не JS number
**How to avoid:** Всегда `Number(result._sum.amount ?? 0)` для конвертации
**Warning signs:** NaN или "[object Object]" в отчётах

### Pitfall 7: lint-staged + ESLint ошибки блокируют commit
**What goes wrong:** Разработчик не может закоммитить работу
**Why it happens:** ESLint errors (не warnings) в staged файлах
**How to avoid:** На начальном этапе: только Prettier в pre-commit, ESLint через CI. Или `eslint --fix --max-warnings 0` только для new errors
**Warning signs:** Фрустрация разработчиков, --no-verify коммиты

## Code Examples

### Husky 9.x + lint-staged setup
```bash
# Initialize husky
npx husky init

# Create pre-commit hook
echo "npx lint-staged" > .husky/pre-commit
```

```json
// package.json additions
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all"
}
```

**Рекомендация по discretion:** semi: false (уже используется в коде проекта -- vitest.config.ts без точек с запятой... нужно проверить). Только Prettier в pre-commit, без ESLint -- для минимизации friction. ESLint уже есть в `npm run lint`, можно запускать вручную или в CI.

### Security headers в next.config.ts
```typescript
import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
```

### API health route
```typescript
// src/app/api/health/route.ts
import { db } from "@/lib/db"

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: "ok" }, { status: 200 })
  } catch {
    return Response.json({ status: "error" }, { status: 503 })
  }
}
```

### .env.example
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/astore_erp

# Auth
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# App
NODE_ENV=production
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Husky v4 `husky install` | Husky v9 just `husky` in prepare | v9.0 (2024) | Simpler setup, .husky/ dir |
| lint-staged v13 config in package.json | lint-staged v16 same API | v16 (2025) | No breaking changes for basic usage |
| Prettier v2 | Prettier v3.8 | v3.0 (2023) | ESM default, no config changes needed |
| Next.js pages router error handling | App Router error.tsx | Next.js 13+ | Per-segment error boundaries |

## Open Questions

1. **Semi style в проекте**
   - What we know: vitest.config.ts не использует точки с запятой, но нужно проверить основной код
   - What's unclear: Какой стиль преобладает в src/actions/*.ts
   - Recommendation: Проверить при имплементации, выбрать преобладающий стиль

2. **Prisma groupBy ограничения**
   - What we know: groupBy поддерживает _sum, _count, _avg но НЕ поддерживает relations
   - What's unclear: Достаточно ли groupBy для всех отчётов или нужен $queryRaw
   - Recommendation: getProfitReport нужен $queryRaw (join SaleItem + Product + Category), getSalesReport summary -- aggregate достаточно

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest --run` |
| Full suite command | `npx vitest --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Integration тесты для createSale, createReturn, confirmReceive | integration | `npx vitest --run src/__tests__/create-sale-integration.test.ts` | Wave 0 |
| INFRA-02 | error.tsx рендерится с correct props | manual-only | Visual check in browser | N/A |
| INFRA-03 | loading.tsx рендерится как skeleton | manual-only | Visual check in browser | N/A |
| INFRA-04 | SQL отчёт < 3s для годовых данных | integration | `npx vitest --run src/__tests__/reports-sql.test.ts` | Wave 0 |
| INFRA-05 | Health endpoint returns 200 | smoke | `curl http://localhost:3000/api/health` | Wave 0 |
| INFRA-06 | Security headers present | unit | `npx vitest --run src/__tests__/security-headers.test.ts` | Wave 0 |
| INFRA-07 | Prettier formats staged files | manual-only | `echo "test" > /tmp/t.ts && npx prettier --check /tmp/t.ts` | N/A |
| INFRA-08 | revalidatePath called after mutations | static-analysis | `npx vitest --run src/__tests__/revalidation-coverage.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest --run`
- **Per wave merge:** `npx vitest --run && npm run build`
- **Phase gate:** Full suite green + build success before verify

### Wave 0 Gaps
- [ ] `src/__tests__/create-sale-integration.test.ts` -- covers INFRA-01 (mock-based integration test)
- [ ] `src/__tests__/reports-sql.test.ts` -- covers INFRA-04 (verify aggregate queries return correct shape)
- [ ] `src/__tests__/revalidation-coverage.test.ts` -- covers INFRA-08 (static analysis: grep revalidatePath in action files)

## Sources

### Primary (HIGH confidence)
- Project files: vitest.config.ts, package.json, Dockerfile, docker-compose.yml, next.config.ts, reports.ts -- direct inspection
- `npm view` registry checks -- verified current versions 2026-04-05

### Secondary (MEDIUM confidence)
- Next.js App Router error/loading conventions -- well-established patterns since Next.js 13
- Prisma aggregate/groupBy API -- standard Prisma 5+ features, verified in Prisma 7
- Husky 9.x setup -- documented breaking change from v4-style `husky install`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm registry, existing project setup inspected
- Architecture: HIGH -- patterns are well-established Next.js App Router conventions
- Pitfalls: HIGH -- based on common issues documented in official repos and project inspection
- SQL optimization: MEDIUM -- exact query shape depends on Prisma 7 $queryRaw behavior with tagged templates

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable infrastructure patterns, 30-day validity)
