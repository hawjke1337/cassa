import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

/**
 * LOCK-01: Pessimistic lock на SerialUnit строки через SELECT ... FOR UPDATE.
 * Сортировка по id ASC предотвращает deadlock (единый порядок блокировки).
 * После lock — re-check что все units имеют status = 'IN_STOCK'.
 *
 * @returns Массив locked SerialUnit rows с полями: id, productId, storeId, status, costPrice, imei
 * @throws Error("Серийная единица недоступна для продажи") если хотя бы один unit не IN_STOCK
 */
export async function lockSerialUnits(
  tx: Prisma.TransactionClient,
  serialUnitIds: string[],
  storeId: string,
): Promise<
  {
    id: string
    productId: string
    storeId: string
    status: string
    costPrice: any
    imei: string | null
  }[]
> {
  if (serialUnitIds.length === 0) return []

  const locked = await tx.$queryRaw<
    {
      id: string
      productId: string
      storeId: string
      status: string
      costPrice: any
      imei: string | null
    }[]
  >`
    SELECT id, "productId", "storeId", status, "costPrice", imei
    FROM "SerialUnit"
    WHERE id = ANY(${serialUnitIds}::text[])
    ORDER BY id ASC
    FOR UPDATE
  `

  // Re-check: все units должны быть IN_STOCK и принадлежать storeId
  for (const unit of locked) {
    if (unit.status !== "IN_STOCK") {
      throw new Error("Серийная единица недоступна для продажи")
    }
    if (unit.storeId !== storeId) {
      throw new Error("Серийная единица не принадлежит этому магазину")
    }
  }

  // Проверка что все запрошенные ID найдены
  if (locked.length !== serialUnitIds.length) {
    throw new Error("Серийная единица недоступна для продажи")
  }

  return locked
}

/**
 * Item shape accepted by `decrementStockForItems`.
 *
 * - `productId` обязателен для несерийных позиций (по которым идёт decrement).
 * - `serialUnitId` если задан → позиция считается серийной и пропускается этим
 *   helper-ом (серийник списывается отдельно через SerialUnit.status update).
 */
export interface StockDecrementItem {
  productId?: string | null
  quantity: number
  serialUnitId?: string | null
}

/**
 * FIN-02 / FIN-03: Pessimistic decrement остатков для несерийных позиций.
 *
 * Делает три вещи внутри уже открытой Prisma-транзакции:
 *   1. Аггрегирует количества по productId (одна позиция × N штук = -N).
 *   2. SELECT ... FOR UPDATE OF sp на все нужные StoreProduct строки одним
 *      запросом — pessimistic lock устраняет race conditions с createSale,
 *      confirmTransferSent, другими параллельными completeOrder.
 *   3. Re-check sufficient quantity → throw "Недостаточно остатка: {name}"
 *      если не хватает (после lock — значение свежее).
 *   4. tx.storeProduct.update({ quantity: { decrement } }) для каждого productId.
 *
 * Серийные позиции (`serialUnitId != null`) пропускаются — их обрабатывает
 * caller через `serialUnit.update({ status: 'SOLD' })` + history.
 *
 * Pure: не создаёт Sale, не пишет историю, не трогает SerialUnit. Используется
 * в `completeOrder` (Phase 8) и (планируется) рефактор `createSale` (Phase 9).
 *
 * @throws Error("Недостаточно остатка: {productName}") если quantity < decrement
 *         после lock — гарантированно атомарно.
 * @throws Error если StoreProduct не найден для одной из позиций.
 */
export async function decrementStockForItems(
  tx: Prisma.TransactionClient,
  storeId: string,
  items: StockDecrementItem[],
): Promise<void> {
  // Только несерийные позиции с productId.
  const nonSerialized = items.filter((it) => !it.serialUnitId && it.productId != null)
  if (nonSerialized.length === 0) return

  // Аггрегируем по productId — одна позиция может встречаться несколько раз.
  const decrements = new Map<string, number>()
  for (const it of nonSerialized) {
    const pid = it.productId as string
    decrements.set(pid, (decrements.get(pid) ?? 0) + it.quantity)
  }
  const productIds = Array.from(decrements.keys())

  // FOR UPDATE OF sp — pessimistic lock на все StoreProduct одним запросом.
  // Joining Product даёт человеческое имя для error message.
  const locked = await tx.$queryRaw<
    { productId: string; quantity: number; reservedQuantity: number; productName: string }[]
  >`
    SELECT sp."productId", sp.quantity, sp."reservedQuantity", p.name as "productName"
    FROM "StoreProduct" sp
    JOIN "Product" p ON p.id = sp."productId"
    WHERE sp."storeId" = ${storeId} AND sp."productId" = ANY(${productIds}::text[])
    FOR UPDATE OF sp
  `
  const stockMap = new Map(locked.map((r) => [r.productId, r]))

  // Re-check sufficiency на свежезалоченных строках.
  // LOCK-06: Available = quantity - reservedQuantity (reserved for pending transfers)
  for (const [productId, decrementQty] of decrements) {
    const row = stockMap.get(productId)
    if (!row) {
      throw new Error(`Товар не найден в магазине: ${productId}`)
    }
    const available = row.quantity - (row.reservedQuantity ?? 0)
    if (available < decrementQty) {
      throw new Error(`Недостаточно остатка: ${row.productName}`)
    }
  }

  // Decrement через Prisma — каждая update идёт по уникальному ключу.
  for (const [productId, decrementQty] of decrements) {
    await tx.storeProduct.update({
      where: { storeId_productId: { storeId, productId } },
      data: { quantity: { decrement: decrementQty } },
    })
  }
}

/**
 * Get effective stock quantities for a batch of products.
 * For serialized products, counts IN_STOCK SerialUnits instead of StoreProduct.quantity.
 */
export async function getSerializedCounts(
  storeId: string,
  productIds: string[],
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  const counts = await db.serialUnit.groupBy({
    by: ["productId"],
    where: {
      storeId,
      productId: { in: productIds },
      status: "IN_STOCK",
    },
    _count: true,
  })

  return Object.fromEntries(counts.map((c) => [c.productId, c._count]))
}
