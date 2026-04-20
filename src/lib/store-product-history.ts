/**
 * StoreProductHistory helper — audit trail for StoreProduct.quantity changes.
 *
 * Used by inventory/sales/orders/audit actions to log every quantity delta
 * for non-serialized products. Serialized products are tracked via SerialUnitHistory.
 *
 * Called within a transaction; skips no-op changes (before === after).
 *
 * Usage:
 *   await logQuantityChange(tx, {
 *     storeProductId: sp.id,
 *     quantityBefore: 10,
 *     quantityAfter: 7,
 *     reason: "SALE",
 *     userId: session.user.id,
 *   })
 */
import type { Prisma, StockChangeReason } from "@/generated/prisma/client"

export interface LogQuantityChangeParams {
  storeProductId: string
  quantityBefore: number
  quantityAfter: number
  reason: StockChangeReason
  userId: string
}

export async function logQuantityChange(
  tx: Prisma.TransactionClient,
  params: LogQuantityChangeParams,
): Promise<void> {
  // Skip no-op changes (defensive — avoid noise in audit trail)
  if (params.quantityBefore === params.quantityAfter) return

  await tx.storeProductHistory.create({
    data: {
      storeProductId: params.storeProductId,
      quantityBefore: params.quantityBefore,
      quantityAfter: params.quantityAfter,
      reason: params.reason,
      userId: params.userId,
    },
  })
}
