import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const SOFT_DELETE_MODELS = ["Product", "Supplier", "Customer", "Store", "User"] as const

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
    name: "softDelete",
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
        async findUnique({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            // Always include deletedAt so the soft-delete check works
            // even when caller uses `select` without deletedAt
            const select = args.select as Record<string, unknown> | undefined
            if (select && !select.deletedAt) {
              args.select = { ...select, deletedAt: true } as typeof args.select
            }
            const result = await query(args)
            if (
              result &&
              (result as any).deletedAt !== null &&
              (result as any).deletedAt !== undefined
            ) {
              return null
            }
            return result
          }
          return query(args)
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as any)) {
            const select = args.select as Record<string, unknown> | undefined
            if (select && !select.deletedAt) {
              args.select = { ...select, deletedAt: true } as typeof args.select
            }
            const result = await query(args)
            if (
              result &&
              (result as any).deletedAt !== null &&
              (result as any).deletedAt !== undefined
            ) {
              throw new Error(`${model} not found`)
            }
            return result
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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
