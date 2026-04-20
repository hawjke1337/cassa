"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"

const DEFAULT_RATES: Record<string, string> = {
  CASH: "0",
  CARD: "0.02",
  SBP: "0.007",
  TRANSFER: "0.01",
  CREDIT: "0.03",
}

const METHODS = ["CASH", "CARD", "SBP", "TRANSFER", "CREDIT"] as const

export async function getFeeSettings(storeId: string) {
  await requirePermission("settings.stores", storeId)

  const configs = await db.paymentFeeConfig.findMany({
    where: { storeId },
  })

  return METHODS.map((method) => {
    const config = configs.find((c: { method: string }) => c.method === method)
    return {
      method,
      feeRate: config ? Number(config.feeRate).toString() : DEFAULT_RATES[method],
    }
  })
}

export async function saveFeeSettings(
  storeId: string,
  rates: Array<{ method: string; feeRate: string }>,
) {
  await requirePermission("settings.stores", storeId)

  await db.$transaction(
    rates.map((r) =>
      db.paymentFeeConfig.upsert({
        where: { storeId_method: { storeId, method: r.method as any } },
        create: { storeId, method: r.method as any, feeRate: r.feeRate },
        update: { feeRate: r.feeRate },
      }),
    ),
  )

  return { success: true }
}

export async function getStoreFeeRates(storeId: string) {
  const configs = await db.paymentFeeConfig.findMany({
    where: { storeId },
  })
  const rates: Record<string, number> = {}
  for (const method of METHODS) {
    const config = configs.find((c: { method: string }) => c.method === method)
    rates[method] = config ? Number(config.feeRate) : Number(DEFAULT_RATES[method])
  }
  return rates
}
