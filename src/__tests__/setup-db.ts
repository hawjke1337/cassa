/**
 * E2E Test DB Setup — schema-per-worker isolation + TRUNCATE CASCADE between tests.
 *
 * Каждый Vitest worker получает свой Postgres schema (test_w0, test_w1, ...).
 * helpers/db.ts создаёт PrismaPg adapter с опцией `{ schema: testSchema }`,
 * которая применяет `search_path` на каждую pg connection — параллельные тесты
 * не видят данные друг друга.
 *
 * Lifecycle:
 *   beforeAll → CREATE SCHEMA + prisma db push (ставит таблицы через libpq options)
 *   beforeEach → TRUNCATE all tables RESTART IDENTITY CASCADE
 *   afterAll → DROP SCHEMA CASCADE
 *
 * Почему `db push`, а не `migrate deploy`:
 *   Старые миграции содержат hardcoded `public.TableName` ссылки, которые ломаются
 *   при применении в non-default schema. `db push` генерирует DDL из schema.prisma
 *   напрямую без привязки к schema в SQL. Для тестовых схем важна только структура,
 *   не история миграций.
 *
 * Используется через `test.setupFiles` в vitest.config.ts (только project 'e2e').
 */
import { beforeAll, beforeEach, afterAll } from "vitest"
import { Pool } from "pg"
import { execSync } from "child_process"

// VITEST_POOL_ID — встроенная переменная Vitest (pool: 'forks'), "1", "2", ...
const workerId = process.env.VITEST_POOL_ID ?? "0"
export const testSchema = `test_w${workerId}`

const baseUrl = process.env.DATABASE_URL_TEST
if (!baseUrl) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Run e2e tests via `pnpm test:e2e` (uses .env.test).",
  )
}

/**
 * Bare connection string (без schema qualifier). Используется в helpers/db.ts
 * вместе с `{ schema: testSchema }` опцией PrismaPg.
 */
export const baseConnectionString = baseUrl

/**
 * URL с передачей `search_path` через libpq `options` параметр.
 * Используется `prisma db push`, который не понимает `?schema=` Prisma-специфичный
 * URL параметр, но уважает стандартный libpq `options=-c search_path=...`.
 */
const pushUrl = `${baseUrl}?options=${encodeURIComponent(`-c search_path=${testSchema}`)}`

// Admin pool для DDL (CREATE/DROP SCHEMA, TRUNCATE). Все команды используют
// fully-qualified table names `"schema"."table"`, поэтому search_path не нужен.
const adminPool = new Pool({ connectionString: baseUrl })

beforeAll(async () => {
  // 1. Создать изолированную schema для этого worker
  await adminPool.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`)
  await adminPool.query(`CREATE SCHEMA "${testSchema}"`)

  // 2. Прикладываем DDL из schema.prisma в worker-schema через `db push`
  execSync(`npx prisma db push --accept-data-loss --url="${pushUrl}"`, {
    env: {
      ...process.env,
      DATABASE_URL: pushUrl,
    },
    stdio: "pipe",
  })
}, 120_000)

beforeEach(async () => {
  // Получить список всех таблиц в worker-schema
  const result = await adminPool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename != '_prisma_migrations'`,
    [testSchema],
  )
  const tables = result.rows.map((r) => `"${testSchema}"."${r.tablename}"`)
  if (tables.length === 0) return

  // TRUNCATE CASCADE одним statement — Postgres сам разберётся с FK порядком
  await adminPool.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  try {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`)
  } finally {
    await adminPool.end()
  }
})
