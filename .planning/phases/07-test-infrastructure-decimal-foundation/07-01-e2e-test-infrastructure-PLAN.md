---
phase: 07-test-infrastructure-decimal-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - vitest.config.ts
  - src/__tests__/setup-db.ts
  - src/__tests__/helpers/db.ts
  - src/__tests__/helpers/fixtures.ts
  - src/__tests__/e2e/example.e2e.test.ts
  - package.json
  - prisma/seed.ts
  - .env.test
autonomous: true
requirements: [TEST2-01, TEST2-02]
must_haves:
  truths:
    - "Разработчик запускает `pnpm test:e2e` — поднимается реальный PostgreSQL astore_erp_test, прогоняются e2e-real-db тесты, БД очищается после каждого теста"
    - "Каждый Vitest worker получает изолированный schema (test_w0, test_w1, ...) через search_path"
    - "TRUNCATE ... RESTART IDENTITY CASCADE выполняется beforeEach, фикстуры засеиваются"
  artifacts:
    - path: vitest.config.ts
      provides: "Конфигурация vitest projects unit/e2e + pool forks + setupFiles"
    - path: src/__tests__/setup-db.ts
      provides: "Schema-per-worker setup, migrate deploy, TRUNCATE beforeEach"
    - path: src/__tests__/helpers/db.ts
      provides: "PrismaClient instance с PrismaPg adapter, scoped на test schema"
    - path: src/__tests__/helpers/fixtures.ts
      provides: "Идемпотентные seed-функции (createTestStore, createTestUser, createTestProduct)"
    - path: src/__tests__/e2e/example.e2e.test.ts
      provides: "Эталонный E2E тест для документации/копирования"
  key_links:
    - from: vitest.config.ts
      to: src/__tests__/setup-db.ts
      via: "test.setupFiles config"
      pattern: "setupFiles.*setup-db"
    - from: src/__tests__/setup-db.ts
      to: process.env.VITEST_POOL_ID
      via: "schema name generation"
      pattern: "VITEST_POOL_ID"
    - from: package.json
      to: vitest.e2e config
      via: "test:e2e script"
      pattern: "test:e2e.*vitest"
---

<objective>
Создать паттерн E2E тестирования на реальном PostgreSQL с schema-per-worker изоляцией и TRUNCATE CASCADE между тестами. Это фундамент для всех последующих фаз v1.1 — каждая фаза будет писать E2E тесты по этому шаблону.

Purpose: V1.0 моки пропустили 100 багов потому что обходили raw SQL и DB constraints. E2E на реальной БД ловит эти баги.
Output: Готовая инфраструктура `pnpm test:e2e` + helpers + эталонный тест.
</objective>

<execution_context>
@/Users/pushkarev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pushkarev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md
@vitest.config.ts
@package.json
@prisma/schema.prisma
@src/__tests__/e2e-real-db.test.ts
@prisma/seed.ts
</context>

<interfaces>
<!-- Vitest 4.x projects + pool API -->
<!-- https://vitest.dev/config/#projects -->
```ts
// vitest.config.ts target shape
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['src/__tests__/e2e/**'] } },
      { test: {
          name: 'e2e',
          include: ['src/__tests__/e2e/**/*.e2e.test.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: false } },
          setupFiles: ['./src/__tests__/setup-db.ts'],
          testTimeout: 30_000,
        }
      }
    ]
  }
})
```

```ts
// src/__tests__/setup-db.ts target shape
import { beforeAll, beforeEach, afterAll } from "vitest"
import { Pool } from "pg"
import { execSync } from "child_process"

const workerId = process.env.VITEST_POOL_ID ?? "0"
const schema = `test_w${workerId}`
const baseUrl = process.env.DATABASE_URL_TEST!
export const databaseUrl = `${baseUrl}?schema=${schema}`

beforeAll(async () => {
  // CREATE SCHEMA + prisma migrate deploy --schema-url
})
beforeEach(async () => {
  // TRUNCATE all tables in schema RESTART IDENTITY CASCADE
})
afterAll(async () => {
  // DROP SCHEMA CASCADE
})
```

```ts
// src/__tests__/helpers/db.ts target shape
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { databaseUrl } from "../setup-db"

const adapter = new PrismaPg({ connectionString: databaseUrl })
export const db = new PrismaClient({ adapter })
```

</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Создать test database скрипты и .env.test</name>
  <files>.env.test, package.json, prisma/seed.ts</files>
  <read_first>
    - package.json (current scripts)
    - prisma/seed.ts (must become idempotent via upsert)
    - .planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md (lines 100-145, CI section)
  </read_first>
  <action>
    1. Создать `.env.test` в корне `astore-erp/` с содержимым:
       ```
       DATABASE_URL_TEST=postgresql://astore:astore_dev_2026@localhost:5432/astore_erp_test
       NODE_ENV=test
       ```
    2. В `package.json` `scripts` ДОБАВИТЬ (НЕ удалять существующие):
       - `"typecheck": "tsc --noEmit"`
       - `"test": "vitest run"`
       - `"test:unit": "vitest run --project unit"`
       - `"test:e2e": "dotenv -e .env.test -- vitest run --project e2e"`
       - `"test:e2e:watch": "dotenv -e .env.test -- vitest --project e2e"`
       - `"db:test:create": "psql postgresql://astore:astore_dev_2026@localhost:5432/postgres -c 'CREATE DATABASE astore_erp_test' || true"`
       - `"db:test:migrate": "dotenv -e .env.test -- prisma migrate deploy"`
    3. Сделать `prisma/seed.ts` идемпотентным: каждый `create` → `upsert` с `where: { id: ... }` или уникальным ключом. Если seed уже использует upsert — пропустить.
    4. Запустить локально: `pnpm db:test:create && pnpm db:test:migrate` (БД должна создаться, миграции применяются).
  </action>
  <verify>
    <automated>cd astore-erp && grep -q '"test:e2e"' package.json && grep -q '"typecheck"' package.json && test -f .env.test && grep -q 'DATABASE_URL_TEST' .env.test</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` scripts contains exactly the literal strings: `"test:e2e": "dotenv -e .env.test -- vitest run --project e2e"`, `"typecheck": "tsc --noEmit"`, `"test:unit": "vitest run --project unit"`
    - `.env.test` contains literal `DATABASE_URL_TEST=postgresql://astore:astore_dev_2026@localhost:5432/astore_erp_test`
    - `pnpm db:test:create` exits 0 (БД создана или уже существует)
    - `pnpm db:test:migrate` exits 0 (миграции применены к astore_erp_test)
  </acceptance_criteria>
  <done>
    БД astore_erp_test существует, миграции применены, scripts добавлены, .env.test создан. Идемпотентный seed готов к использованию.
  </done>
</task>

<task type="auto">
  <name>Task 2: Создать setup-db.ts + helpers/db.ts + helpers/fixtures.ts</name>
  <files>src/__tests__/setup-db.ts, src/__tests__/helpers/db.ts, src/__tests__/helpers/fixtures.ts</files>
  <read_first>
    - src/__tests__/e2e-real-db.test.ts (текущий PrismaPg adapter pattern, copy connection setup)
    - prisma/schema.prisma (определить порядок таблиц для TRUNCATE CASCADE — все модели)
    - .planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md (lines 65-100, "Test database lifecycle")
  </read_first>
  <action>
    1. **`src/__tests__/setup-db.ts`** (~80 строк):
       - Импортировать `beforeAll, beforeEach, afterAll` из vitest, `Pool` из 'pg', `execSync` из 'child_process'
       - `const workerId = process.env.VITEST_POOL_ID ?? '0'`
       - `const schema = \`test_w\${workerId}\``
       - `const baseUrl = process.env.DATABASE_URL_TEST` — throw если undefined
       - `export const databaseUrl = \`\${baseUrl}?schema=\${schema}\``
       - `beforeAll`: создать pool на baseUrl (без schema), выполнить `CREATE SCHEMA IF NOT EXISTS "${schema}"`, затем `execSync('prisma migrate deploy', { env: { ...process.env, DATABASE_URL: databaseUrl } })`
       - `beforeEach`: получить список таблиц через `SELECT tablename FROM pg_tables WHERE schemaname = $1`, выполнить `TRUNCATE TABLE "${schema}"."${t1}", "${schema}"."${t2}", ... RESTART IDENTITY CASCADE`
       - `afterAll`: `DROP SCHEMA "${schema}" CASCADE`, закрыть pool
       - Экспортировать `databaseUrl` для использования в `helpers/db.ts`

    2. **`src/__tests__/helpers/db.ts`** (~15 строк):
       - Импортировать `PrismaClient` из `@prisma/client`, `PrismaPg` из `@prisma/adapter-pg`, `databaseUrl` из `../setup-db`
       - Создать `const adapter = new PrismaPg({ connectionString: databaseUrl })`
       - Экспортировать `export const db = new PrismaClient({ adapter })`
       - JSDoc: "Test-scoped Prisma client. Use ONLY in *.e2e.test.ts files."

    3. **`src/__tests__/helpers/fixtures.ts`** (~100 строк):
       - Экспортировать функции (все async, возвращают созданную сущность):
         - `createTestStore(overrides?: Partial<Store>): Promise<Store>` — id-based, default name "Test Store"
         - `createTestUser(overrides?: { storeId: string }): Promise<User>` — bcrypt hashed password, default email
         - `createTestCategory(overrides?: { isSerialized?: boolean }): Promise<Category>`
         - `createTestProduct(overrides?: { categoryId: string }): Promise<Product>`
         - `createTestStoreProduct(opts: { productId: string; storeId: string; quantity?: number; sellPrice?: string; costPrice?: string }): Promise<StoreProduct>`
       - Все денежные поля принимаются как string (например `sellPrice: '1499.99'`), чтобы избежать float
       - Каждая фикстура импортирует `db` из `./db`

    4. ESLint disable не нужен — это test-only код.

  </action>
  <verify>
    <automated>cd astore-erp && test -f src/__tests__/setup-db.ts && test -f src/__tests__/helpers/db.ts && test -f src/__tests__/helpers/fixtures.ts && grep -q "VITEST_POOL_ID" src/__tests__/setup-db.ts && grep -q "TRUNCATE" src/__tests__/setup-db.ts && grep -q "PrismaPg" src/__tests__/helpers/db.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/__tests__/setup-db.ts` exists and contains literal string `VITEST_POOL_ID` and `TRUNCATE` and `RESTART IDENTITY CASCADE`
    - `src/__tests__/setup-db.ts` exports `databaseUrl`
    - `src/__tests__/helpers/db.ts` exists and contains `PrismaPg` and `export const db`
    - `src/__tests__/helpers/fixtures.ts` exports `createTestStore`, `createTestUser`, `createTestProduct`, `createTestStoreProduct` (verify with `grep -E "export (async )?function (createTestStore|createTestUser|createTestProduct|createTestStoreProduct)" src/__tests__/helpers/fixtures.ts | wc -l` returns 4)
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    Хелперы созданы, типы корректны, импорты резолвятся, паттерн готов к использованию в example тесте.
  </done>
</task>

<task type="auto">
  <name>Task 3: Обновить vitest.config.ts (projects unit/e2e) + создать example.e2e.test.ts</name>
  <files>vitest.config.ts, src/__tests__/e2e/example.e2e.test.ts</files>
  <read_first>
    - vitest.config.ts (current minimal config)
    - src/__tests__/setup-db.ts (созданный в Task 2)
    - src/__tests__/helpers/fixtures.ts (созданный в Task 2)
  </read_first>
  <action>
    1. **Обновить `vitest.config.ts`** — заменить на projects-конфиг:
       ```ts
       import { defineConfig } from 'vitest/config'
       import path from 'path'

       export default defineConfig({
         resolve: {
           alias: { '@': path.resolve(__dirname, './src') },
         },
         test: {
           globals: true,
           environment: 'node',
           projects: [
             {
               extends: true,
               test: {
                 name: 'unit',
                 include: ['src/**/*.test.ts'],
                 exclude: ['src/__tests__/e2e/**', 'node_modules/**'],
               },
             },
             {
               extends: true,
               test: {
                 name: 'e2e',
                 include: ['src/__tests__/e2e/**/*.e2e.test.ts'],
                 pool: 'forks',
                 poolOptions: { forks: { singleFork: false } },
                 setupFiles: ['./src/__tests__/setup-db.ts'],
                 testTimeout: 30_000,
                 hookTimeout: 30_000,
               },
             },
           ],
         },
       })
       ```

    2. **Создать `src/__tests__/e2e/example.e2e.test.ts`** (~60 строк) — эталон, который доказывает что инфраструктура работает:
       ```ts
       import { describe, it, expect } from 'vitest'
       import { db } from '../helpers/db'
       import { createTestStore, createTestUser, createTestProduct, createTestStoreProduct } from '../helpers/fixtures'

       describe('E2E example: реальная БД', () => {
         it('создаёт магазин и пользователя — данные персистятся', async () => {
           const store = await createTestStore()
           const user = await createTestUser({ storeId: store.id })

           const found = await db.user.findUnique({ where: { id: user.id } })
           expect(found?.email).toBe(user.email)
         })

         it('TRUNCATE между тестами — предыдущий test не виден', async () => {
           const count = await db.user.count()
           expect(count).toBe(0)
         })

         it('создаёт StoreProduct с Decimal-полями — точность сохраняется', async () => {
           const store = await createTestStore()
           const category = await db.category.create({ data: { name: 'Test', isSerialized: false } })
           const product = await createTestProduct({ categoryId: category.id })
           const sp = await createTestStoreProduct({
             productId: product.id,
             storeId: store.id,
             sellPrice: '1499.99',
             costPrice: '999.50',
             quantity: 10,
           })
           expect(sp.sellPrice.toString()).toBe('1499.99')
           expect(sp.costPrice.toString()).toBe('999.5')
         })
       })
       ```

    3. Запустить `pnpm test:e2e` — должны пройти все 3 теста.

  </action>
  <verify>
    <automated>cd astore-erp && grep -q "projects" vitest.config.ts && grep -q "name: 'e2e'" vitest.config.ts && test -f src/__tests__/e2e/example.e2e.test.ts && pnpm test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `vitest.config.ts` contains literal strings `projects`, `name: 'unit'`, `name: 'e2e'`, `setupFiles`
    - `src/__tests__/e2e/example.e2e.test.ts` contains 3 `it(` blocks
    - `pnpm test:e2e` exits 0 — все 3 тестов проходят на реальной БД
    - `pnpm test:unit` exits 0 (или с известными существующими failures, но НЕ запускает e2e файлы — `grep -c "example.e2e" <output>` returns 0)
  </acceptance_criteria>
  <done>
    Vitest projects настроены, example.e2e.test.ts проходит на реальной БД, schema-per-worker изоляция работает, TRUNCATE между тестами очищает данные.
  </done>
</task>

</tasks>

<verification>
1. `pnpm db:test:create && pnpm db:test:migrate` — БД создана и мигрирована
2. `pnpm test:e2e` — все 3 example теста зелёные
3. `pnpm test:unit` — не подхватывает e2e файлы
4. `pnpm typecheck` — 0 ошибок
5. Запустить `pnpm test:e2e` дважды подряд — оба раза зелёные (доказательство что cleanup работает)
</verification>

<success_criteria>

- E2E framework работает: `pnpm test:e2e` запускается, использует реальный astore_erp_test, очищает данные после
- Schema-per-worker изоляция работает (env VITEST_POOL_ID учитывается)
- Helpers готовы для использования в Phase 8-16
  </success_criteria>

<output>
Создать `.planning/phases/07-test-infrastructure-decimal-foundation/07-01-SUMMARY.md` после завершения.
</output>
</content>
</invoke>
