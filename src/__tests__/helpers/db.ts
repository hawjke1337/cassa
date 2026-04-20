/**
 * Test-scoped Prisma client with PrismaPg adapter.
 *
 * Use ONLY in *.e2e.test.ts files — connects to the worker-isolated test schema
 * (see ../setup-db.ts for schema-per-worker lifecycle).
 *
 * Each Vitest worker gets its own client pointing at its own Postgres schema,
 * so there is no cross-contamination between parallel E2E tests.
 */
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { baseConnectionString, testSchema } from "../setup-db"

// PrismaPg: pass bare connection string + explicit `schema` option.
// The adapter exposes `schemaName` to Prisma query engine — model queries
// get auto-prefixed with the schema. However, raw SQL (`$queryRaw`,
// `$executeRaw`) is NOT auto-prefixed and relies on Postgres `search_path`.
//
// Prisma doesn't automatically set `search_path` at transaction begin, so
// unqualified raw queries (e.g. `"Counter"` in counters.ts) fail inside
// `$transaction` blocks with "relation does not exist".
//
// Workaround: wrap the client so every `$transaction(callback)` call first
// runs `SET LOCAL search_path` within the tx before invoking the user
// callback. `SET LOCAL` scopes only to the current tx — clean and safe.
const rawClient = new PrismaClient({
  adapter: new PrismaPg({ connectionString: baseConnectionString }, { schema: testSchema }),
})

type TxCallback<T> = (tx: Parameters<Parameters<typeof rawClient.$transaction>[0]>[0]) => Promise<T>

// Set search_path before each raw query so unqualified table names resolve
// to the worker-isolated test schema. Without this, $queryRaw("SELECT ... FROM \"Sale\"")
// would fail with "relation does not exist" because PrismaPg only sets search_path
// for ORM queries, not raw SQL.
async function setSearchPath() {
  await rawClient.$executeRawUnsafe(`SET search_path TO "${testSchema}", public`)
}

export const db = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === "$transaction") {
      return async function patchedTransaction<T>(
        arg: TxCallback<T> | Parameters<typeof rawClient.$transaction>[0],
        options?: Parameters<typeof rawClient.$transaction>[1],
      ): Promise<T> {
        // Only patch the callback form; array form is pass-through.
        if (typeof arg === "function") {
          return target.$transaction(async (tx) => {
            // SET LOCAL scopes to current transaction only — no leakage.
            await (tx as unknown as typeof rawClient).$executeRawUnsafe(
              `SET LOCAL search_path TO "${testSchema}", public`,
            )
            return (arg as TxCallback<T>)(tx)
          }, options) as Promise<T>
        }
        return (target.$transaction as any)(arg, options)
      }
    }
    // Intercept $queryRaw and $queryRawUnsafe to set search_path first
    if (prop === "$queryRaw" || prop === "$queryRawUnsafe") {
      const original = Reflect.get(target, prop, receiver) as Function
      return async function patchedRawQuery(...args: unknown[]) {
        await setSearchPath()
        return original.apply(target, args)
      }
    }
    // Intercept $executeRaw (but not $executeRawUnsafe which we use for SET search_path itself)
    if (prop === "$executeRaw") {
      const original = Reflect.get(target, prop, receiver) as Function
      return async function patchedExecuteRaw(...args: unknown[]) {
        await setSearchPath()
        return original.apply(target, args)
      }
    }
    return Reflect.get(target, prop, receiver)
  },
}) as typeof rawClient
