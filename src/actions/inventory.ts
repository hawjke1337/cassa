"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { getSerializedCounts, lockSerialUnits } from "@/lib/stock-helpers"
import { weightedAvgCostPrice, sellPriceFallback } from "@/lib/inventory-utils"
import { logQuantityChange } from "@/lib/store-product-history"
import type { Prisma } from "@/generated/prisma/client"

// ---- Stock Overview ----

export async function getStock(
  storeId: string,
  params: {
    search?: string
    categoryId?: string
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("inventory.view", storeId)
  const canSeePrices = await checkPermission("catalog.prices", storeId)

  const { search, categoryId, page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = { storeId }

  const productWhere: Record<string, unknown> = { isActive: true }
  if (search) {
    productWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ]
  }
  if (categoryId) {
    productWhere.categoryId = categoryId
  }
  where.product = productWhere

  const [items, total] = await Promise.all([
    db.storeProduct.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            unit: true,
            category: { select: { id: true, name: true, isSerialized: true } },
          },
        },
      },
      orderBy: { product: { name: "asc" } },
      skip,
      take: perPage,
    }),
    db.storeProduct.count({ where }),
  ])

  // For serialized products, get actual serial unit counts
  const serializedProductIds = items
    .filter((sp) => sp.product.category.isSerialized)
    .map((sp) => sp.product.id)

  let serialCounts: Record<string, number> = {}
  if (serializedProductIds.length > 0) {
    const counts = await db.serialUnit.groupBy({
      by: ["productId"],
      where: {
        storeId,
        productId: { in: serializedProductIds },
        status: "IN_STOCK",
      },
      _count: true,
    })
    serialCounts = Object.fromEntries(counts.map((c) => [c.productId, c._count]))
  }

  return {
    items: items.map((sp) => {
      const isSerialized = sp.product.category.isSerialized
      return {
        id: sp.id,
        productId: sp.product.id,
        name: sp.product.name,
        sku: sp.product.sku,
        barcode: sp.product.barcode,
        unit: sp.product.unit,
        categoryName: sp.product.category.name,
        categoryId: sp.product.category.id,
        isSerialized,
        quantity: isSerialized ? (serialCounts[sp.product.id] ?? 0) : sp.quantity,
        minQty: sp.minQty,
        sellPrice: Number(sp.sellPrice),
        costPrice: canSeePrices ? Number(sp.costPrice) : null,
      }
    }),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

// ---- Receive Goods ----

export async function getReceives(
  storeId: string,
  params: { page?: number; perPage?: number } = {},
) {
  await requirePermission("inventory.receive", storeId)

  const { page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const [receives, total] = await Promise.all([
    db.stockReceive.findMany({
      where: { storeId },
      include: {
        receivedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.stockReceive.count({ where: { storeId } }),
  ])

  return {
    receives: receives.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      comment: r.comment,
      itemCount: r._count.items,
      receivedByName: `${r.receivedBy.firstName} ${r.receivedBy.lastName}`,
      createdAt: r.createdAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function createReceive(
  storeId: string,
  data: {
    supplierId?: string
    items: Array<{ productId: string; quantity: number; costPrice: number }>
    comment?: string
  },
) {
  await requirePermission("inventory.receive", storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (data.items.length === 0) throw new Error("Добавьте товары")

  const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)

  // DATA-02: Wrap in transaction so getNextNumber uses atomic counter
  const receive = await db.$transaction(async (tx) => {
    const number = await getNextNumber("PR", tx)

    return tx.stockReceive.create({
      data: {
        number,
        storeId,
        supplierId: data.supplierId || null,
        totalAmount,
        comment: data.comment || null,
        userId: session.user.id,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
          })),
        },
      },
    })
  })

  return { id: receive.id, number: receive.number }
}

export async function confirmReceive(
  receiveId: string,
  serialData?: Record<
    string,
    Array<{
      imei?: string | null
      imei2?: string | null
      serialNumber?: string | null
      costPrice: number
    }>
  >,
  // INV-06: operator-provided sellPrice per productId for NEW StoreProduct creation.
  // Required when the product doesn't yet exist at receive.storeId.
  sellPrices?: Record<string, number>,
) {
  const receive = await db.stockReceive.findUnique({
    where: { id: receiveId },
    include: { items: true },
  })
  if (!receive) throw new Error("Приход не найден")
  if (receive.status !== "DRAFT") throw new Error("Приход уже обработан")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await requirePermission("inventory.receive", receive.storeId)

  const userId = session.user!.id

  // LOCK-04: Entire confirmReceive is within a single interactive transaction.
  // If SerialUnit.create fails (duplicate IMEI, constraint violation), Prisma
  // automatically rolls back ALL changes including StoreProduct.quantity increments.
  // No manual compensation needed.
  await db.$transaction(async (tx) => {
    await tx.stockReceive.update({
      where: { id: receiveId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    })

    for (const item of receive.items) {
      // Check if this product's category is serialized
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { category: { select: { isSerialized: true, identifierType: true } } },
      })

      if (product?.category.isSerialized && serialData?.[item.productId]) {
        const entries = serialData[item.productId]
        const idType = product.category.identifierType

        // Server-side validation of serial entries
        if (entries.length !== item.quantity) {
          throw new Error("Количество серийных номеров не совпадает с количеством товара")
        }
        for (const entry of entries) {
          const needsImei = idType === "IMEI" || idType === "BOTH"
          const needsSn = idType === "SN" || idType === "BOTH"
          if (needsImei && !entry.imei) {
            throw new Error("IMEI обязателен для сериализованного товара")
          }
          if (needsImei && entry.imei && !/^\d{15}$/.test(entry.imei)) {
            throw new Error(`Некорректный IMEI: ${entry.imei}`)
          }
          if (needsSn && !entry.serialNumber) {
            throw new Error("Серийный номер обязателен для сериализованного товара")
          }
        }

        // Ensure StoreProduct record exists (quantity stays 0 — derived from SerialUnit count).
        // INV-06: if creating a new StoreProduct, sellPrice is mandatory — no fallback.
        const existingSerializedSp = await tx.storeProduct.findUnique({
          where: {
            storeId_productId: {
              storeId: receive.storeId,
              productId: item.productId,
            },
          },
        })
        if (!existingSerializedSp) {
          const providedSellPrice = sellPrices?.[item.productId]
          if (!providedSellPrice || providedSellPrice <= 0) {
            throw new Error(`SELLPRICE_REQUIRED: Укажите цену продажи для товара ${item.productId}`)
          }
          await tx.storeProduct.create({
            data: {
              storeId: receive.storeId,
              productId: item.productId,
              quantity: 0,
              sellPrice: providedSellPrice,
              costPrice: item.costPrice,
            },
          })
        } else {
          await tx.storeProduct.update({
            where: {
              storeId_productId: {
                storeId: receive.storeId,
                productId: item.productId,
              },
            },
            data: { costPrice: item.costPrice },
          })
        }

        // Create SerialUnit for each entry
        for (const entry of entries) {
          const unit = await tx.serialUnit.create({
            data: {
              productId: item.productId,
              storeId: receive.storeId,
              imei: entry.imei || null,
              imei2: entry.imei2 || null,
              serialNumber: entry.serialNumber || null,
              status: "IN_STOCK",
              costPrice: entry.costPrice,
              receiveItemId: item.id,
            },
          })
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              event: "RECEIVED",
              storeId: receive.storeId,
              performedById: session.user!.id,
              relatedDocument: receive.number,
              relatedDocType: "STOCK_RECEIVE",
            },
          })
        }
      } else {
        // Non-serialized: DATA-01 — lock row with FOR UPDATE before increment
        const existing = await tx.$queryRaw<
          { id: string; quantity: number; costPrice: string | number }[]
        >`
          SELECT id, quantity, "costPrice" FROM "StoreProduct"
          WHERE "storeId" = ${receive.storeId} AND "productId" = ${item.productId}
          FOR UPDATE
        `
        if (existing.length > 0) {
          const prevQty = Number(existing[0].quantity)
          const newCostPrice = weightedAvgCostPrice(
            prevQty,
            Number(existing[0].costPrice),
            item.quantity,
            Number(item.costPrice),
          )
          await tx.storeProduct.update({
            where: {
              storeId_productId: {
                storeId: receive.storeId,
                productId: item.productId,
              },
            },
            data: { quantity: { increment: item.quantity }, costPrice: newCostPrice },
          })
          // INV-04: log quantity change for non-serialized receive
          await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
            storeProductId: existing[0].id,
            quantityBefore: prevQty,
            quantityAfter: prevQty + item.quantity,
            reason: "RECEIVE",
            userId,
          })
        } else {
          // INV-06: sellPrice required for new non-serialized StoreProduct.
          const providedSellPrice = sellPrices?.[item.productId]
          if (!providedSellPrice || providedSellPrice <= 0) {
            throw new Error(
              `SELLPRICE_REQUIRED: Укажите цену продажи для нового товара ${item.productId}`,
            )
          }
          const newSp = await tx.storeProduct.create({
            data: {
              storeId: receive.storeId,
              productId: item.productId,
              quantity: item.quantity,
              sellPrice: providedSellPrice,
              costPrice: item.costPrice,
            },
          })
          // INV-04: log initial quantity from 0 -> item.quantity
          await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
            storeProductId: newSp.id,
            quantityBefore: 0,
            quantityAfter: item.quantity,
            reason: "RECEIVE",
            userId,
          })
        }
      }
    }
  })

  return { success: true }
}

// ---- Transfers ----

export async function getTransfers(
  storeId: string,
  params: { page?: number; perPage?: number } = {},
) {
  await requirePermission("inventory.transfer", storeId)

  const { page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const where = {
    OR: [{ fromStoreId: storeId }, { toStoreId: storeId }],
  }

  const [transfers, total] = await Promise.all([
    db.stockTransfer.findMany({
      where,
      include: {
        fromStore: { select: { name: true } },
        toStore: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.stockTransfer.count({ where }),
  ])

  return {
    transfers: transfers.map((t) => ({
      id: t.id,
      number: t.number,
      status: t.status,
      fromStoreName: t.fromStore.name,
      toStoreName: t.toStore.name,
      fromStoreId: t.fromStoreId,
      toStoreId: t.toStoreId,
      itemCount: t._count.items,
      createdByName: `${t.createdBy.firstName} ${t.createdBy.lastName}`,
      createdAt: t.createdAt.toISOString(),
      confirmedAt: t.confirmedAt?.toISOString() ?? null,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function createTransfer(
  fromStoreId: string,
  toStoreId: string,
  items: Array<{ productId: string; quantity: number; serialUnitIds?: string[] }>,
) {
  await requirePermission("inventory.transfer", fromStoreId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (fromStoreId === toStoreId) throw new Error("Нельзя переместить в тот же магазин")
  if (items.length === 0) throw new Error("Добавьте товары")

  const productIds = items.map((i) => i.productId)
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("Дублирующиеся товары в перемещении")
  }

  const transfer = await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction
    const number = await getNextNumber("T", tx)

    const t = await tx.stockTransfer.create({
      data: {
        number,
        fromStoreId,
        toStoreId,
        userId: session.user!.id,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // LOCK-06: Reserve stock in source store for non-serialized items
    // INV-05: if StoreProduct doesn't exist at source, block with PRODUCT_NOT_IN_SOURCE_STORE
    for (const item of items) {
      const isSerialized = item.serialUnitIds && item.serialUnitIds.length > 0
      if (!isSerialized) {
        // FOR UPDATE lock + check available stock
        const spRows = await tx.$queryRaw<
          { id: string; quantity: number; reservedQuantity: number }[]
        >`
          SELECT id, quantity, "reservedQuantity" FROM "StoreProduct"
          WHERE "storeId" = ${fromStoreId} AND "productId" = ${item.productId}
          FOR UPDATE
        `
        const sp = spRows[0]
        if (!sp) {
          throw new Error(
            `PRODUCT_NOT_IN_SOURCE_STORE: Товар ${item.productId} не найден на складе-источнике`,
          )
        }
        const available = sp.quantity - sp.reservedQuantity
        if (available < item.quantity) {
          throw new Error("INSUFFICIENT_STOCK: Недостаточно доступного товара для перемещения")
        }
        await tx.storeProduct.update({
          where: { storeId_productId: { storeId: fromStoreId, productId: item.productId } },
          data: { reservedQuantity: { increment: item.quantity } },
        })
      }
    }

    // Handle serialized products
    for (const item of items) {
      if (item.serialUnitIds && item.serialUnitIds.length > 0) {
        if (item.quantity !== item.serialUnitIds.length) {
          throw new Error("Количество не совпадает с выбранными серийными единицами")
        }

        // Validate all units
        const units = await tx.serialUnit.findMany({
          where: {
            id: { in: item.serialUnitIds },
            productId: item.productId,
            storeId: fromStoreId,
            status: "IN_STOCK",
          },
        })

        if (units.length !== item.serialUnitIds.length) {
          throw new Error("Некоторые серийные единицы недоступны для перемещения")
        }

        // Find the corresponding transfer item
        const transferItem = t.items.find((ti) => ti.productId === item.productId)
        if (!transferItem) throw new Error("Ошибка создания перемещения")

        // Create StockTransferItemSerial entries
        for (const unitId of item.serialUnitIds) {
          await tx.stockTransferItemSerial.create({
            data: {
              transferItemId: transferItem.id,
              serialUnitId: unitId,
            },
          })
        }

        // Set units to IN_TRANSFER
        await tx.serialUnit.updateMany({
          where: { id: { in: item.serialUnitIds } },
          data: { status: "IN_TRANSFER" },
        })

        // Write history for each unit
        for (const unitId of item.serialUnitIds) {
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unitId,
              event: "TRANSFERRED_OUT",
              storeId: fromStoreId,
              performedById: session.user!.id,
              relatedDocument: number,
              relatedDocType: "STOCK_TRANSFER",
            },
          })
        }
      }
    }

    return t
  })

  return { id: transfer.id, number: transfer.number }
}

export async function confirmTransferSent(transferId: string) {
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: {
        include: { serialUnits: true },
      },
    },
  })
  if (!transfer) throw new Error("Перемещение не найдено")
  if (transfer.status !== "PENDING") throw new Error("Перемещение уже обработано")

  await requirePermission("inventory.transfer", transfer.fromStoreId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  const userId = session.user!.id

  await db.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const isSerialized = item.serialUnits.length > 0

      if (!isSerialized) {
        // LOCK-02: FOR UPDATE на StoreProduct источника перед decrement
        const spRows = await tx.$queryRaw<
          { id: string; quantity: number; reservedQuantity: number }[]
        >`
          SELECT id, quantity, "reservedQuantity" FROM "StoreProduct"
          WHERE "storeId" = ${transfer.fromStoreId} AND "productId" = ${item.productId}
          FOR UPDATE
        `
        const sp = spRows[0]
        if (!sp || sp.quantity < item.quantity) {
          throw new Error("Недостаточно товара на складе для перемещения")
        }

        // Decrement both quantity and reservedQuantity
        await tx.storeProduct.update({
          where: {
            storeId_productId: {
              storeId: transfer.fromStoreId,
              productId: item.productId,
            },
          },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
          },
        })

        // INV-04: log non-serialized transfer-out
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: sp.id,
          quantityBefore: Number(sp.quantity),
          quantityAfter: Number(sp.quantity) - item.quantity,
          reason: "TRANSFER_OUT",
          userId,
        })
      }
      // Serialized: units already set to IN_TRANSFER in createTransfer, skip quantity decrement
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "IN_TRANSIT" },
    })
  })

  return { success: true }
}

export async function confirmTransferReceived(transferId: string) {
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: {
        include: { serialUnits: true },
      },
    },
  })
  if (!transfer) throw new Error("Перемещение не найдено")
  if (transfer.status !== "IN_TRANSIT") throw new Error("Перемещение не в статусе 'В пути'")

  await requirePermission("inventory.transfer", transfer.toStoreId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await db.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const isSerialized = item.serialUnits.length > 0

      // Get cost price from source store
      const sourceSp = await tx.storeProduct.findUnique({
        where: {
          storeId_productId: {
            storeId: transfer.fromStoreId,
            productId: item.productId,
          },
        },
      })

      if (isSerialized) {
        // Ensure StoreProduct record exists in destination (quantity stays 0 — derived from SerialUnit count)
        await tx.storeProduct.upsert({
          where: {
            storeId_productId: {
              storeId: transfer.toStoreId,
              productId: item.productId,
            },
          },
          create: {
            storeId: transfer.toStoreId,
            productId: item.productId,
            quantity: 0,
            sellPrice: sourceSp?.sellPrice ?? 0,
            costPrice: sourceSp?.costPrice ?? 0,
          },
          update: {},
        })

        // Update each serial unit
        for (const transferSerial of item.serialUnits) {
          await tx.serialUnit.update({
            where: { id: transferSerial.serialUnitId },
            data: {
              storeId: transfer.toStoreId,
              status: "IN_STOCK",
            },
          })

          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: transferSerial.serialUnitId,
              event: "TRANSFERRED_IN",
              storeId: transfer.toStoreId,
              performedById: session.user!.id,
              relatedDocument: transfer.number,
              relatedDocType: "STOCK_TRANSFER",
            },
          })
        }
      } else {
        // Non-serialized: existing quantity-based logic
        // INV-04: log destination StoreProduct quantity change (TRANSFER_IN)
        const existingDestSp = await tx.storeProduct.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.toStoreId,
              productId: item.productId,
            },
          },
        })
        const destSp = await tx.storeProduct.upsert({
          where: {
            storeId_productId: {
              storeId: transfer.toStoreId,
              productId: item.productId,
            },
          },
          create: {
            storeId: transfer.toStoreId,
            productId: item.productId,
            quantity: item.quantity,
            sellPrice: sourceSp?.sellPrice ?? 0,
            costPrice: sourceSp?.costPrice ?? 0,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        })
        const prevQty = existingDestSp ? Number(existingDestSp.quantity) : 0
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: destSp.id,
          quantityBefore: prevQty,
          quantityAfter: prevQty + item.quantity,
          reason: "TRANSFER_IN",
          userId: session.user!.id,
        })
      }
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "RECEIVED", confirmedAt: new Date() },
    })
  })

  return { success: true }
}

export async function cancelTransfer(transferId: string) {
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: {
        include: { serialUnits: true },
      },
    },
  })
  if (!transfer) throw new Error("Перемещение не найдено")
  if (transfer.status !== "PENDING") throw new Error("Можно отменить только ожидающее перемещение")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await requirePermission("inventory.transfer", transfer.fromStoreId)

  await db.$transaction(async (tx) => {
    // LOCK-06: Release reservation for non-serialized items
    for (const item of transfer.items) {
      const isSerialized = item.serialUnits.length > 0
      if (!isSerialized) {
        await tx.storeProduct.update({
          where: {
            storeId_productId: {
              storeId: transfer.fromStoreId,
              productId: item.productId,
            },
          },
          data: { reservedQuantity: { decrement: item.quantity } },
        })
      }
    }

    // Revert serial units from IN_TRANSFER back to IN_STOCK
    for (const item of transfer.items) {
      for (const link of item.serialUnits) {
        await tx.serialUnit.update({
          where: { id: link.serialUnitId },
          data: { status: "IN_STOCK" },
        })
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: link.serialUnitId,
            event: "TRANSFERRED_IN",
            storeId: transfer.fromStoreId,
            performedById: session.user!.id,
            relatedDocument: transfer.number,
            relatedDocType: "STOCK_TRANSFER",
            comment: "Перемещение отменено",
          },
        })
      }
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "CANCELLED" },
    })
  })

  return { success: true }
}

// ---- Inventory Audit ----

export async function getAudits(
  storeId: string,
  params: { page?: number; perPage?: number; showDeleted?: boolean } = {},
) {
  await requirePermission("inventory.audit", storeId)

  const { page = 1, perPage = 20, showDeleted = false } = params
  const skip = (page - 1) * perPage

  // When showDeleted=false, only count/return audits that have at least one item
  // referencing a non-deleted product (or audits with no items yet).
  // When showDeleted=true, show all audits regardless.
  const whereClause = showDeleted
    ? { storeId }
    : {
        storeId,
        items: {
          none: {
            product: { deletedAt: { not: null } },
          },
        },
      }

  const [audits, total] = await Promise.all([
    db.inventoryAudit.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.inventoryAudit.count({ where: whereClause }),
  ])

  return {
    audits: audits.map((a) => ({
      id: a.id,
      number: a.number,
      status: a.status,
      itemCount: a._count.items,
      createdByName: `${a.createdBy.firstName} ${a.createdBy.lastName}`,
      createdAt: a.createdAt.toISOString(),
      closedAt: a.closedAt?.toISOString() ?? null,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function createAudit(storeId: string) {
  await requirePermission("inventory.audit", storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const storeProducts = await db.storeProduct.findMany({
    where: { storeId },
    include: { product: { select: { id: true, category: { select: { isSerialized: true } } } } },
  })

  if (storeProducts.length === 0) throw new Error("Нет товаров для инвентаризации")

  // Get serial unit counts for serialized products
  const serializedIds = storeProducts
    .filter((sp) => sp.product.category.isSerialized)
    .map((sp) => sp.product.id)
  const serialCounts = await getSerializedCounts(storeId, serializedIds)

  // DATA-02: Wrap in transaction so getNextNumber uses atomic counter
  const audit = await db.$transaction(async (tx) => {
    const number = await getNextNumber("I", tx)

    return tx.inventoryAudit.create({
      data: {
        number,
        storeId,
        userId: session.user.id,
        items: {
          create: storeProducts.map((sp) => ({
            productId: sp.product.id,
            expectedQty: sp.product.category.isSerialized
              ? (serialCounts[sp.product.id] ?? 0)
              : sp.quantity,
          })),
        },
      },
    })
  })

  return { id: audit.id, number: audit.number }
}

export async function getAudit(auditId: string) {
  const audit = await db.inventoryAudit.findUnique({
    where: { id: auditId },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
        orderBy: { product: { name: "asc" } },
      },
    },
  })

  if (!audit) throw new Error("Инвентаризация не найдена")

  await requirePermission("inventory.audit", audit.storeId)

  return {
    id: audit.id,
    number: audit.number,
    status: audit.status,
    storeName: audit.store.name,
    storeId: audit.storeId,
    createdByName: `${audit.createdBy.firstName} ${audit.createdBy.lastName}`,
    createdAt: audit.createdAt.toISOString(),
    closedAt: audit.closedAt?.toISOString() ?? null,
    items: audit.items.map((item) => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      unit: item.product.unit,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      difference: item.difference,
    })),
  }
}

export async function updateAuditItem(auditItemId: string, actualQty: number) {
  const item = await db.inventoryAuditItem.findUnique({
    where: { id: auditItemId },
    include: { audit: true },
  })
  if (!item) throw new Error("Позиция не найдена")
  if (item.audit.status !== "DRAFT") throw new Error("Инвентаризация уже закрыта")

  await requirePermission("inventory.audit", item.audit.storeId)

  const difference = actualQty - item.expectedQty

  await db.inventoryAuditItem.update({
    where: { id: auditItemId },
    data: { actualQty, difference },
  })

  return { success: true }
}

export async function closeAudit(auditId: string) {
  const audit = await db.inventoryAudit.findUnique({
    where: { id: auditId },
    include: { items: true },
  })
  if (!audit) throw new Error("Инвентаризация не найдена")
  if (audit.status !== "DRAFT") throw new Error("Инвентаризация уже закрыта")

  await requirePermission("inventory.audit", audit.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Check that all items have actualQty filled in
  const unfilled = audit.items.filter((item) => item.actualQty === null)
  if (unfilled.length > 0) {
    throw new Error(`Не все позиции подсчитаны (${unfilled.length} осталось)`)
  }

  const userId = session.user!.id

  await db.$transaction(async (tx) => {
    await tx.inventoryAudit.update({
      where: { id: auditId },
      data: { status: "CONFIRMED", closedAt: new Date() },
    })

    // INV-03: recompute expectedQty at close time (inside transaction, after FOR UPDATE).
    // This ensures sales/returns/transfers that happened between audit open and close
    // are reflected in the discrepancy calculation.
    //
    // INV-04: log every StoreProduct.quantity change to StoreProductHistory.

    // Process non-serialized items (quantity-based audit)
    for (const item of audit.items) {
      if (item.actualQty === null) continue

      // Check if this product is serialized — skip quantity adjustments for serialized
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { category: { select: { isSerialized: true } } },
      })
      if (product?.category.isSerialized) continue

      // INV-03: Lock row + read actual current quantity as recomputedExpected
      const spRows = await tx.$queryRaw<
        { id: string; quantity: number; costPrice: string | number }[]
      >`
        SELECT "id", "quantity", "costPrice" FROM "StoreProduct"
        WHERE "storeId" = ${audit.storeId} AND "productId" = ${item.productId}
        FOR UPDATE
      `
      const sp = spRows[0] ?? null
      if (!sp) continue

      const recomputedExpected = Number(sp.quantity)
      const actualQty = item.actualQty
      const recomputedDiff = actualQty - recomputedExpected

      // Update difference on the audit item for audit trail visibility
      await tx.inventoryAuditItem.update({
        where: { id: item.id },
        data: { difference: recomputedDiff, expectedQty: recomputedExpected },
      })

      if (recomputedDiff === 0) continue

      if (recomputedDiff < 0) {
        // Shortage — auto write-off
        const woNumber = await getNextNumber("WO", tx)

        await tx.stockWriteOff.create({
          data: {
            number: woNumber,
            storeId: audit.storeId,
            reason: `Инвентаризация ${audit.number}: недостача`,
            userId,
            items: {
              create: {
                productId: item.productId,
                quantity: Math.abs(recomputedDiff),
                costPrice: sp.costPrice ?? 0,
              },
            },
          },
        })

        await tx.storeProduct.update({
          where: {
            storeId_productId: {
              storeId: audit.storeId,
              productId: item.productId,
            },
          },
          data: { quantity: actualQty },
        })

        // INV-04: log quantity change
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: sp.id,
          quantityBefore: recomputedExpected,
          quantityAfter: actualQty,
          reason: "AUDIT_SHORTAGE",
          userId,
        })
      } else {
        // Surplus — auto receive
        const prNumber = await getNextNumber("PR", tx)

        await tx.stockReceive.create({
          data: {
            number: prNumber,
            storeId: audit.storeId,
            totalAmount: Number(sp.costPrice ?? 0) * recomputedDiff,
            comment: `Инвентаризация ${audit.number}: излишки`,
            userId,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            items: {
              create: {
                productId: item.productId,
                quantity: recomputedDiff,
                costPrice: sp.costPrice ?? 0,
              },
            },
          },
        })

        await tx.storeProduct.update({
          where: {
            storeId_productId: {
              storeId: audit.storeId,
              productId: item.productId,
            },
          },
          data: { quantity: actualQty },
        })

        // INV-04: log quantity change
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: sp.id,
          quantityBefore: recomputedExpected,
          quantityAfter: actualQty,
          reason: "AUDIT_SURPLUS",
          userId,
        })
      }
    }

    // Process serialized items — find MISSING units
    const auditItems = await tx.inventoryAuditItem.findMany({
      where: { auditId },
      include: {
        product: {
          include: { category: { select: { isSerialized: true } } },
        },
      },
    })

    const serializedItems = auditItems.filter((item) => item.product.category.isSerialized)

    // INV-02: fetch previous completed audit for this store to determine MISSING→WRITTEN_OFF
    const previousAudit = await tx.inventoryAudit.findFirst({
      where: {
        storeId: audit.storeId,
        status: "CONFIRMED",
        id: { not: auditId },
      },
      orderBy: { closedAt: "desc" },
      include: {
        auditSerials: {
          where: { status: "MISSING" },
          select: { serialUnitId: true },
        },
      },
    })
    const previouslyMissing = new Set(
      (previousAudit?.auditSerials ?? [])
        .map((s) => s.serialUnitId)
        .filter((id): id is string => id !== null),
    )

    for (const item of serializedItems) {
      // Find all IN_STOCK or MISSING (carried-over from previous audit) serial units
      const candidateUnits = await tx.serialUnit.findMany({
        where: {
          productId: item.productId,
          storeId: audit.storeId,
          status: { in: ["IN_STOCK", "MISSING"] },
        },
      })

      // Find which ones were scanned (FOUND)
      const foundRecords = await tx.inventoryAuditSerial.findMany({
        where: {
          auditId,
          auditItemId: item.id,
          status: "FOUND",
        },
        select: { serialUnitId: true },
      })
      const foundUnitIds = new Set(foundRecords.map((r) => r.serialUnitId).filter(Boolean))

      // INV-02: Resolve MISSING → IN_STOCK for units that are now FOUND
      for (const unit of candidateUnits) {
        if (foundUnitIds.has(unit.id) && unit.status === "MISSING") {
          await tx.serialUnit.update({
            where: { id: unit.id },
            data: { status: "IN_STOCK" },
          })
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              event: "MISSING_RESOLVED",
              storeId: audit.storeId,
              performedById: userId,
              comment: `Найден при инвентаризации ${audit.number}`,
            },
          })
        }
      }

      // Create MISSING/WRITTEN_OFF entries for unscanned units
      for (const unit of candidateUnits) {
        if (foundUnitIds.has(unit.id)) continue

        // Was this unit MISSING in previous audit? → WRITTEN_OFF
        const wasPreviouslyMissing = previouslyMissing.has(unit.id)
        const newSerialStatus = wasPreviouslyMissing ? "WRITTEN_OFF" : "MISSING"

        // Record in InventoryAuditSerial (only MISSING supported by AuditSerialStatus enum)
        await tx.inventoryAuditSerial.create({
          data: {
            auditId,
            auditItemId: item.id,
            serialUnitId: unit.id,
            scannedImei: unit.imei ?? unit.serialNumber ?? "N/A",
            status: "MISSING",
          },
        })

        // Update SerialUnit status
        await tx.serialUnit.update({
          where: { id: unit.id },
          data: { status: newSerialStatus },
        })

        // Create SerialUnitHistory event
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: unit.id,
            event: newSerialStatus === "WRITTEN_OFF" ? "WRITTEN_OFF" : "MISSING",
            storeId: audit.storeId,
            performedById: userId,
            comment:
              newSerialStatus === "WRITTEN_OFF"
                ? `Списан после двух подряд инвентаризаций (${audit.number})`
                : `Не найден при инвентаризации ${audit.number}`,
          },
        })
      }
    }
  })

  return { success: true }
}

// ---- Inventory Audit — Serial Scanning ----

export async function scanAuditImei(auditId: string, scannedImei: string) {
  if (!scannedImei || !/^\d{15}$/.test(scannedImei)) {
    throw new Error("Некорректный формат IMEI: ожидается 15 цифр")
  }

  const audit = await db.inventoryAudit.findUnique({
    where: { id: auditId },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
  })
  if (!audit) throw new Error("Инвентаризация не найдена")
  if (audit.status !== "DRAFT") throw new Error("Инвентаризация уже закрыта")

  await requirePermission("inventory.audit", audit.storeId)

  // Check if this IMEI was already scanned in this audit
  const existing = await db.inventoryAuditSerial.findFirst({
    where: { auditId, scannedImei },
  })
  if (existing) throw new Error("Этот IMEI уже отсканирован в данной инвентаризации")

  // Look for SerialUnit by IMEI (check imei and imei2 fields)
  const unit = await db.serialUnit.findFirst({
    where: {
      OR: [{ imei: scannedImei }, { imei2: scannedImei }],
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  })

  let status: "FOUND" | "SURPLUS"
  let serialUnitId: string | null = null
  let productName: string = "Неизвестный товар"
  let productSku: string = ""
  let productId: string | null = null

  if (unit && unit.storeId === audit.storeId && unit.status === "IN_STOCK") {
    // Found in this store, expected
    status = "FOUND"
    serialUnitId = unit.id
    productName = unit.product.name
    productSku = unit.product.sku
    productId = unit.productId
  } else {
    // Either doesn't exist, belongs to another store, or not IN_STOCK
    status = "SURPLUS"
    if (unit) {
      serialUnitId = unit.id
      productName = unit.product.name
      productSku = unit.product.sku
      productId = unit.productId
    }
  }

  // Find the corresponding audit item by productId
  let auditItemId: string | null = null
  if (productId) {
    const auditItem = audit.items.find((i) => i.product.id === productId)
    if (auditItem) {
      auditItemId = auditItem.id
    }
  }

  // Create an audit item for surplus products not in this audit
  if (!auditItemId && productId) {
    const newItem = await db.inventoryAuditItem.create({
      data: {
        auditId,
        productId,
        expectedQty: 0,
      },
    })
    auditItemId = newItem.id
  }

  if (!auditItemId) {
    // Completely unknown IMEI — no product at all in our system
    // We still need to record the scan. Create a placeholder — but schema requires auditItemId.
    // For unknown IMEI with no product, we throw an informative error
    throw new Error("IMEI не найден в системе. Невозможно привязать к товару.")
  }

  const record = await db.inventoryAuditSerial.create({
    data: {
      auditId,
      auditItemId,
      serialUnitId,
      scannedImei,
      status,
    },
  })

  return {
    id: record.id,
    status,
    scannedImei,
    productName,
    productSku,
    serialUnitId,
  }
}

export async function getAuditSerialResults(auditId: string) {
  const audit = await db.inventoryAudit.findUnique({
    where: { id: auditId },
    select: { storeId: true },
  })
  if (!audit) throw new Error("Инвентаризация не найдена")

  await requirePermission("inventory.audit", audit.storeId)

  const serials = await db.inventoryAuditSerial.findMany({
    where: { auditId },
    include: {
      serialUnit: {
        select: {
          imei: true,
          imei2: true,
          serialNumber: true,
          product: { select: { name: true, sku: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  })

  return serials.map((s) => ({
    id: s.id,
    status: s.status,
    scannedImei: s.scannedImei,
    productName: s.serialUnit?.product.name ?? "Неизвестный товар",
    productSku: s.serialUnit?.product.sku ?? "",
    imei: s.serialUnit?.imei ?? s.scannedImei,
    imei2: s.serialUnit?.imei2 ?? null,
    serialNumber: s.serialUnit?.serialNumber ?? null,
  }))
}

// ---- Write-off ----

export async function getWriteOffs(
  storeId: string,
  params: { page?: number; perPage?: number } = {},
) {
  await requirePermission("inventory.writeoff", storeId)

  const { page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const [writeOffs, total] = await Promise.all([
    db.stockWriteOff.findMany({
      where: { storeId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.stockWriteOff.count({ where: { storeId } }),
  ])

  return {
    writeOffs: writeOffs.map((wo) => ({
      id: wo.id,
      number: wo.number,
      reason: wo.reason,
      itemCount: wo._count.items,
      createdByName: `${wo.createdBy.firstName} ${wo.createdBy.lastName}`,
      createdAt: wo.createdAt.toISOString(),
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function createWriteOff(
  storeId: string,
  items: Array<{
    productId: string
    quantity: number
    serialUnitId?: string
    writeOffReason?: string
  }>,
  reason: string,
) {
  await requirePermission("inventory.writeoff", storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!reason.trim()) throw new Error("Укажите причину списания")
  if (items.length === 0) throw new Error("Добавьте товары")

  await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction
    const number = await getNextNumber("WO", tx)
    const writeOffItems: Array<{
      productId: string
      quantity: number
      costPrice: number
      serialUnitId?: string
      writeOffReason?: string
    }> = []

    for (const item of items) {
      if (item.serialUnitId) {
        // LOCK-05: FOR UPDATE на SerialUnit перед WRITTEN_OFF
        const [lockedUnit] = await lockSerialUnits(tx as any, [item.serialUnitId], storeId)
        if (lockedUnit.productId !== item.productId) {
          throw new Error("Серийная единица не принадлежит этому товару")
        }

        // Update unit status
        await tx.serialUnit.update({
          where: { id: item.serialUnitId },
          data: { status: "WRITTEN_OFF" },
        })

        // Write history
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: item.serialUnitId,
            event: "WRITTEN_OFF",
            storeId,
            performedById: session.user!.id,
            relatedDocument: number,
            relatedDocType: "WRITE_OFF",
            comment: item.writeOffReason || reason,
          },
        })

        writeOffItems.push({
          productId: item.productId,
          quantity: 1,
          costPrice: Number(lockedUnit.costPrice),
          serialUnitId: item.serialUnitId,
          writeOffReason: item.writeOffReason,
        })

        // Do NOT decrement StoreProduct.quantity for serialized products
      } else {
        // LOCK-05: FOR UPDATE на StoreProduct перед decrement
        const spRows = await tx.$queryRaw<
          { id: string; quantity: number; costPrice: string | number }[]
        >`
          SELECT id, quantity, "costPrice" FROM "StoreProduct"
          WHERE "storeId" = ${storeId} AND "productId" = ${item.productId}
          FOR UPDATE
        `
        const sp = spRows[0] ?? null
        if (!sp || sp.quantity < item.quantity) {
          throw new Error("Недостаточно товара на складе для списания")
        }

        writeOffItems.push({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: Number(sp.costPrice),
        })

        const prevQty = Number(sp.quantity)
        await tx.storeProduct.update({
          where: {
            storeId_productId: { storeId, productId: item.productId },
          },
          data: { quantity: { decrement: item.quantity } },
        })

        // INV-04: log write-off quantity change (non-serialized only)
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: sp.id,
          quantityBefore: prevQty,
          quantityAfter: prevQty - item.quantity,
          reason: "WRITE_OFF",
          userId: session.user!.id,
        })
      }
    }

    await tx.stockWriteOff.create({
      data: {
        number,
        storeId,
        reason,
        userId: session.user!.id,
        items: {
          create: writeOffItems.map((woItem) => ({
            productId: woItem.productId,
            quantity: woItem.quantity,
            costPrice: woItem.costPrice,
            serialUnitId: woItem.serialUnitId,
            writeOffReason: woItem.writeOffReason,
          })),
        },
      },
    })
  })

  return { success: true }
}

// ---- Product search for inventory forms ----

export async function searchInventoryProducts(storeId: string, search: string) {
  await requirePermission("inventory.view", storeId)

  if (!search || search.trim().length === 0) return []

  const storeProducts = await db.storeProduct.findMany({
    where: {
      storeId,
      product: {
        isActive: true,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
        ],
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unit: true,
          category: { select: { isSerialized: true, identifierType: true } },
        },
      },
    },
    take: 20,
  })

  const serializedIds = storeProducts
    .filter((sp) => sp.product.category.isSerialized)
    .map((sp) => sp.product.id)
  const serialCounts = await getSerializedCounts(storeId, serializedIds)

  return storeProducts.map((sp) => ({
    productId: sp.product.id,
    name: sp.product.name,
    sku: sp.product.sku,
    barcode: sp.product.barcode,
    unit: sp.product.unit,
    stock: sp.product.category.isSerialized ? (serialCounts[sp.product.id] ?? 0) : sp.quantity,
    costPrice: Number(sp.costPrice),
    sellPrice: Number(sp.sellPrice),
    isSerialized: sp.product.category.isSerialized,
    identifierType: sp.product.category.identifierType,
  }))
}

// Search all products (including those not yet in this store) for receives
export async function searchAllProducts(search: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!search || search.trim().length === 0) return []

  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      unit: true,
      category: { select: { isSerialized: true, identifierType: true } },
    },
    take: 20,
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit,
    isSerialized: p.category.isSerialized,
    identifierType: p.category.identifierType,
  }))
}

// Get all stores for transfer destination selection
export async function getStoresForTransfer() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const userStores = await db.userStore.findMany({
    where: { userId: session.user.id },
    include: { store: { select: { id: true, name: true } } },
  })

  return userStores.map((us) => ({
    id: us.store.id,
    name: us.store.name,
  }))
}
