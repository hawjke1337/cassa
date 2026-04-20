import { db } from "@/lib/db"

export type PrismaTx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export async function getNextNumber(prefix: string, tx?: PrismaTx): Promise<string> {
  const year = new Date().getFullYear()
  const counterId = `${prefix}-${year}`
  const client = tx ?? db

  // Atomic: ensure counter row exists, then increment and return in one step
  await client.$queryRaw`INSERT INTO "Counter" (id, current, "updatedAt") VALUES (${counterId}, 0, NOW()) ON CONFLICT (id) DO NOTHING`
  const result = await client.$queryRaw<
    { current: number }[]
  >`UPDATE "Counter" SET current = current + 1, "updatedAt" = NOW() WHERE id = ${counterId} RETURNING current`

  return `${prefix}-${year}-${String(result[0].current).padStart(6, "0")}`
}
