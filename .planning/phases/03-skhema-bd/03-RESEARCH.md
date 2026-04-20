# Phase 3: Схема БД - Research

**Researched:** 2026-04-05
**Domain:** PostgreSQL schema hardening via Prisma 7 migrations (indexes, FK rules, soft delete, CHECK constraints)
**Confidence:** HIGH

## Summary

Фаза 3 -- чисто миграционная: укрепление существующей PostgreSQL-схемы через Prisma 7.4.2 без изменения бизнес-логики. Три направления: (1) добавление ~30 индексов для производительности запросов, (2) определение onDelete правил на все FK + soft delete + updatedAt, (3) CHECK constraints через raw SQL миграции.

Критическое открытие: CONTEXT.md упоминает `db.$use()` для soft delete middleware, но **`$use` удален в Prisma 7** (deprecated с v4.16, removed в v7). Необходимо использовать `$extends` с query component -- это единственный поддерживаемый подход в Prisma 7.4.2.

Все изменения делаются через `prisma migrate dev` (schema changes) и `prisma migrate dev --create-only` (raw SQL для CHECK constraints). Существующие данные нужно проверить перед добавлением constraints.

**Primary recommendation:** Использовать `$extends` вместо `$use` для soft delete; CHECK constraints добавлять отдельной raw SQL миграцией с предварительной data cleanup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Индексы через Prisma `@@index()` -- стандартный подход, не raw SQL
- Не добавлять индексы на таблицы < 100 строк (Role, Permission, Counter, Brand)
- onDelete: Cascade для дочерних записей без смысла без родителя, Restrict для защиты от удаления с зависимыми, SetNull для опциональных связей
- PriceHistory: storeId и changedBy как FK на Store и User, onDelete: Restrict
- Soft delete (deletedAt) на: Product, Supplier, Customer, Store, User -- НЕ на транзакционные таблицы
- Prisma middleware для автоматической фильтрации soft delete (КОРРЕКТИРОВКА: `$extends`, не `$use`)
- updatedAt на все 35 моделей без updatedAt, включая lookup-таблицы
- CHECK constraints через `prisma migrate dev --create-only` + raw SQL ALTER TABLE
- Проверить существующие данные ПЕРЕД добавлением constraints

### Claude's Discretion
- Точный порядок индексов в составных @@index (какое поле первое)
- Нужно ли покрывающие индексы (INCLUDE) для отчетов
- Batch size при миграции updatedAt (все 35 за раз vs по частям)
- Формат именования constraints

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | Добавить 35+ отсутствующих индексов | Plan 03-01: @@index() в schema.prisma, порядок полей в составных индексах |
| DB-02 | Добавить onDelete правила на все FK | Plan 03-02: Cascade/Restrict/SetNull правила определены в CONTEXT.md |
| DB-03 | PriceHistory: storeId и changedBy как FK | Plan 03-02: Добавить relation fields + onDelete: Restrict |
| DB-04 | Soft delete (deletedAt) на справочники | Plan 03-02: deletedAt + $extends для автофильтрации |
| DB-05 | updatedAt на все таблицы с мутациями | Plan 03-02: @updatedAt на 35 моделей, одна миграция |
| DB-06 | CHECK constraints (price >= 0, quantity > 0) | Plan 03-03: raw SQL миграция через --create-only |
| DB-07 | @@unique на Supplier.inn, Category[name,parentId] | Plan 03-01: уникальные constraints в schema.prisma |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | 7.4.2 | Schema migrations, client extensions | Уже используется в проекте |
| PostgreSQL | 16+ | СУБД с CHECK constraints, indexes | Уже используется |
| @prisma/adapter-pg | 7.4.2 | PostgreSQL adapter | Уже в db.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma migrate dev | 7.4.2 CLI | Schema-driven migrations | Для @@index, @@unique, onDelete, updatedAt |
| prisma migrate dev --create-only | 7.4.2 CLI | Raw SQL migrations | Для CHECK constraints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| $extends soft delete | prisma-extension-soft-delete (npm) | Готовое решение, но лишняя зависимость для 5 моделей -- ручной $extends проще |
| Raw SQL CHECK | Application-level Zod validation | Zod уже есть (Phase 1/2), но CHECK дает защиту на уровне БД -- оба нужны |

## Architecture Patterns

### Pattern 1: Prisma $extends для Soft Delete (КРИТИЧНО -- замена $use)

**What:** `$use` удален в Prisma 7. Используем `$extends` с query component для автоматической фильтрации `deletedAt: null`.

**When to use:** При создании PrismaClient в `src/lib/db.ts`.

**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
const SOFT_DELETE_MODELS = ['Product', 'Supplier', 'Customer', 'Store', 'User'] as const;

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  
  const base = new PrismaClient({ adapter });
  
  return base.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // findUnique нельзя модифицировать where так же просто
          // оставляем без фильтра -- soft-deleted записи доступны по ID
          return query(args);
        },
      },
    },
  });
}
```

**Важно:** `findUnique` по ID не фильтруется автоматически -- это корректно, потому что если код знает ID, он может проверить `deletedAt` явно. Для admin-доступа к удаленным записям -- использовать `$queryRaw` или отдельный unfilteredDb.

### Pattern 2: Составные индексы -- порядок полей

**What:** В составном индексе первое поле -- то, по которому чаще фильтруют без второго.

**Рекомендации по порядку:**
```prisma
// Sale: сначала storeId (фильтр по магазину), потом createdAt (сортировка по дате)
@@index([storeId, createdAt])

// StockReceive: storeId первый (фильтр), createdAt второй (сортировка)
@@index([storeId, createdAt])

// Repair: storeId первый (фильтр по магазину), status второй (фильтр по статусу)
@@index([storeId, status])

// SerialUnit: storeId первый (фильтр), status второй (фильтр)
@@index([storeId, status])
```

**Правило:** Высокая селективность (equality) первым, низкая селективность (range/sort) вторым.

### Pattern 3: CHECK Constraints через --create-only

**What:** Prisma не поддерживает CHECK constraints нативно. Используем raw SQL в custom migration.

**Workflow:**
```bash
# 1. Создать пустую миграцию
npx prisma migrate dev --create-only --name add_check_constraints

# 2. Отредактировать migration.sql -- добавить ALTER TABLE
# 3. Применить
npx prisma migrate dev
```

**Example SQL:**
```sql
-- Data cleanup FIRST (fix invalid data before adding constraints)
UPDATE "StoreProduct" SET quantity = 0 WHERE quantity < 0;
UPDATE "StoreProduct" SET "sellPrice" = 0 WHERE "sellPrice" < 0;
UPDATE "StoreProduct" SET "costPrice" = 0 WHERE "costPrice" < 0;

-- CHECK constraints
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_quantity_gte0
  CHECK (quantity >= 0);
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_sell_price_gte0
  CHECK ("sellPrice" >= 0);
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_cost_price_gte0
  CHECK ("costPrice" >= 0);

ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_price_gte0
  CHECK (price >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_cost_price_gte0
  CHECK ("costPrice" >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_quantity_gt0
  CHECK (quantity > 0);

ALTER TABLE "Payment" ADD CONSTRAINT chk_payment_amount_gt0
  CHECK (amount > 0);

ALTER TABLE "StockReceiveItem" ADD CONSTRAINT chk_stock_receive_item_quantity_gt0
  CHECK (quantity > 0);
ALTER TABLE "StockReceiveItem" ADD CONSTRAINT chk_stock_receive_item_cost_price_gte0
  CHECK ("costPrice" >= 0);

ALTER TABLE "Return" ADD CONSTRAINT chk_return_amount_gte0
  CHECK (amount >= 0);
ALTER TABLE "ReturnItem" ADD CONSTRAINT chk_return_item_quantity_gt0
  CHECK (quantity > 0);
```

### Pattern 4: PriceHistory FK Migration

**What:** PriceHistory.storeId и changedBy -- сейчас просто String, нужно сделать FK.

```prisma
model PriceHistory {
  id        String   @id @default(cuid())
  product   Product  @relation(fields: [productId], references: [id])
  productId String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Restrict)
  storeId   String
  field     String
  oldPrice  Decimal  @db.Decimal(12, 2)
  newPrice  Decimal  @db.Decimal(12, 2)
  changedByUser User @relation(fields: [changedBy], references: [id], onDelete: Restrict)
  changedBy String
  changedAt DateTime @default(now())
}
```

**Требование:** Добавить `priceHistory PriceHistory[]` relation на модели Store и User.

### Anti-Patterns to Avoid
- **$use middleware в Prisma 7:** Удален, код не скомпилируется. Только $extends.
- **findUnique с soft delete фильтром:** findUnique требует уникальные поля в where -- нельзя просто добавить deletedAt. Оставить без фильтра.
- **CHECK constraints в schema.prisma:** Prisma не поддерживает -- только raw SQL.
- **Изменение onDelete на FK с данными без проверки:** Если есть записи нарушающие Restrict, миграция упадет.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft delete фильтрация | Manual `where: { deletedAt: null }` в каждом запросе | `$extends` query extension | Один раз настроить, работает везде, невозможно забыть |
| updatedAt автообновление | Manual `data: { updatedAt: new Date() }` | Prisma `@updatedAt` directive | Автоматически при каждом update |
| Index creation | Raw SQL CREATE INDEX | Prisma `@@index()` | Управляется через schema, миграции idempotent |
| Data validation | Only Zod (app level) | Zod + CHECK constraints (DB level) | Двойная защита: приложение + БД |

## Common Pitfalls

### Pitfall 1: $use Removed in Prisma 7
**What goes wrong:** Код с `db.$use()` не компилируется в Prisma 7.4.2.
**Why it happens:** $use deprecated с v4.16, removed в v7.
**How to avoid:** Использовать `$extends` с query component.
**Warning signs:** TypeScript error "Property '$use' does not exist".

### Pitfall 2: onDelete: Restrict с существующими нарушениями
**What goes wrong:** Миграция с `onDelete: Restrict` упадет если в БД есть orphaned FK записи.
**Why it happens:** PostgreSQL проверяет constraint при ALTER TABLE.
**How to avoid:** До миграции выполнить SQL-запрос для поиска orphaned записей. Очистить или пропустить.
**Warning signs:** Migration error "violates foreign key constraint".

### Pitfall 3: CHECK constraint на невалидные данные
**What goes wrong:** `ALTER TABLE ADD CONSTRAINT CHECK (quantity >= 0)` упадет если есть rows с quantity < 0.
**Why it happens:** PostgreSQL проверяет все существующие строки при добавлении CHECK.
**How to avoid:** Data cleanup UPDATE перед ALTER TABLE в той же миграции.
**Warning signs:** "check constraint violated by some row".

### Pitfall 4: Массовое добавление updatedAt
**What goes wrong:** Добавление `updatedAt DateTime @updatedAt` на 35 моделей создает ALTER TABLE для каждой -- на больших таблицах может быть медленно.
**Why it happens:** PostgreSQL делает table rewrite для ADD COLUMN с DEFAULT.
**How to avoid:** Для dev/staging это не проблема (данных мало). Для production -- миграция по частям. Учитывая что это ePRM с < 100K записей, одна миграция допустима.
**Warning signs:** Миграция занимает > 30 секунд.

### Pitfall 5: PriceHistory FK с несуществующими storeId/changedBy
**What goes wrong:** Если PriceHistory содержит storeId или changedBy которые не существуют в Store/User, добавление FK упадет.
**Why it happens:** storeId и changedBy были просто String без FK validation.
**How to avoid:** Перед миграцией проверить: `SELECT DISTINCT "storeId" FROM "PriceHistory" WHERE "storeId" NOT IN (SELECT id FROM "Store")`. Аналогично для changedBy.
**Warning signs:** "insert or update on table violates foreign key constraint".

### Pitfall 6: $extends возвращает новый тип клиента
**What goes wrong:** `$extends` возвращает расширенный тип PrismaClient, который не совпадает с базовым PrismaClient.
**Why it happens:** TypeScript strict typing.
**How to avoid:** Вывести тип через `typeof db` или использовать `as any` в globalForPrisma. Либо типизировать global как расширенный тип.
**Warning signs:** Type error при присваивании в globalForPrisma.

## Code Examples

### Полный db.ts с soft delete extension
```typescript
// Source: Prisma 7 docs + project db.ts
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const SOFT_DELETE_MODELS = ['Product', 'Supplier', 'Customer', 'Store', 'User'] as const

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  const adapter = new PrismaPg(pool)
  const base = new PrismaClient({ adapter })

  return base.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { deletedAt: null, ...args.where }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { deletedAt: null, ...args.where }
          }
          return query(args)
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { deletedAt: null, ...args.where }
          }
          return query(args)
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            args.where = { deletedAt: null, ...args.where }
          }
          return query(args)
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### Формат именования CHECK constraints
```
chk_{table_snake_case}_{column_snake_case}_{rule}

Примеры:
chk_store_product_quantity_gte0
chk_store_product_sell_price_gte0
chk_sale_item_price_gte0
chk_payment_amount_gt0
```

### Data cleanup query перед CHECK
```sql
-- Проверить невалидные данные
SELECT 'StoreProduct' as tbl, count(*) FROM "StoreProduct" WHERE quantity < 0
UNION ALL
SELECT 'StoreProduct.sellPrice', count(*) FROM "StoreProduct" WHERE "sellPrice" < 0
UNION ALL
SELECT 'StoreProduct.costPrice', count(*) FROM "StoreProduct" WHERE "costPrice" < 0
UNION ALL
SELECT 'SaleItem.price', count(*) FROM "SaleItem" WHERE price < 0
UNION ALL
SELECT 'SaleItem.quantity', count(*) FROM "SaleItem" WHERE quantity <= 0
UNION ALL
SELECT 'Payment.amount', count(*) FROM "Payment" WHERE amount <= 0;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `$use` middleware | `$extends` query component | Prisma 7 (2025) | $use removed, must migrate |
| Manual updatedAt | `@updatedAt` directive | Prisma 2+ (stable) | Автоматическое обновление |
| App-only validation | Zod + CHECK constraints | Best practice | Двойная защита |

**Deprecated/outdated:**
- `prisma.$use()` -- удален в Prisma 7, заменен на `$extends`
- `prisma.$on('query')` -- deprecated, использовать extension logging

## Discretion Recommendations

### Порядок полей в составных индексах
**Рекомендация:** Equality-фильтр первым, range/sort вторым.
- `@@index([storeId, createdAt])` -- storeId = X (equality), ORDER BY createdAt (range)
- `@@index([storeId, status])` -- оба equality, но storeId более селективный

### Покрывающие индексы (INCLUDE)
**Рекомендация:** НЕ добавлять. Prisma не поддерживает INCLUDE в @@index. Для < 100K записей обычные индексы достаточны. Если понадобятся -- raw SQL миграция позже.

### Batch size updatedAt
**Рекомендация:** Все 35 моделей в одной миграции. При < 100K записей это безопасно и выполняется за секунды. Проще отслеживать как одно изменение.

### Формат именования constraints
**Рекомендация:** `chk_{table_snake}_{column_snake}_{rule}` -- читаемо, стандартно для PostgreSQL.

## Open Questions

1. **Покрывает ли $extends все операции с транзакциями?**
   - What we know: $extends query hooks работают для обычных операций
   - What's unclear: Работают ли внутри `$transaction` -- по документации да, но нужно верифицировать
   - Recommendation: Протестировать в dev после имплементации

2. **Есть ли orphaned PriceHistory записи?**
   - What we know: storeId и changedBy были просто String без FK
   - What's unclear: Могут быть невалидные ID
   - Recommendation: Проверить SQL запросом перед миграцией DB-03

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (config exists) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | Индексы используются (no Seq Scan) | manual-only | EXPLAIN ANALYZE через psql | N/A -- визуальная проверка |
| DB-02 | FK onDelete правила определены | smoke | `npx prisma validate` | N/A -- schema validation |
| DB-03 | PriceHistory FK на Store/User | smoke | `npx prisma validate` | N/A |
| DB-04 | Soft delete фильтрация | unit | `npx vitest run src/__tests__/soft-delete.test.ts -x` | Wave 0 |
| DB-05 | updatedAt автообновление | manual-only | Визуальная проверка schema | N/A |
| DB-06 | CHECK constraints работают | integration | `npx vitest run src/__tests__/check-constraints.test.ts -x` | Wave 0 |
| DB-07 | Unique constraints | smoke | `npx prisma validate` | N/A |

### Sampling Rate
- **Per task commit:** `npx prisma validate && npx prisma migrate dev --dry-run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Schema validates + migrations apply cleanly + soft delete tests pass

### Wave 0 Gaps
- [ ] `src/__tests__/soft-delete.test.ts` -- covers DB-04 ($extends фильтрация)
- [ ] `src/__tests__/check-constraints.test.ts` -- covers DB-06 (integration тест с реальной БД или mock)

## Sources

### Primary (HIGH confidence)
- Prisma schema.prisma -- текущее состояние: 51 модель, 16 updatedAt, 17 onDelete, 15 @@index
- `src/lib/db.ts` -- текущий PrismaClient с pg adapter
- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) -- $use removed
- [Prisma Client Extensions Query](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) -- $extends API

### Secondary (MEDIUM confidence)
- [Prisma CHECK constraints docs](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/check-constraints) -- --create-only workflow
- [Prisma Customizing Migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations) -- raw SQL approach

### Tertiary (LOW confidence)
- [GitHub Discussion #20234](https://github.com/prisma/prisma/discussions/20234) -- community on $use deprecation timeline

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Prisma 7.4.2 verified locally, schema read in full
- Architecture: HIGH -- $extends pattern verified against official docs, $use removal confirmed
- Pitfalls: HIGH -- based on real schema analysis (51 models, FK structure, existing data)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (Prisma 7 stable, schema changes are local)
