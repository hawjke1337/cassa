"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { createSaleSchema, type CreateSaleInput } from "@/lib/validations/sales"
import type { PaymentMethod } from "@/generated/prisma/client"
import { Prisma } from "@/generated/prisma/client"
import { sum, mul, sub, toMoney } from "@/lib/money"
import { decrementStockForItems, lockSerialUnits } from "@/lib/stock-helpers"
import { logQuantityChange } from "@/lib/store-product-history"
import { z } from "zod"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"

/**
 * FIN-09: createReturn принимает payload с обязательным refundMethod.
 * Список значений зеркалит PaymentMethod enum из Prisma schema; используем
 * `z.nativeEnum` через локальный const-объект чтобы не тянуть runtime enum
 * import (granted Prisma client под путём @/generated тяжеловесен на boundary).
 */
const REFUND_METHOD_VALUES = {
  CASH: "CASH",
  CARD: "CARD",
  SBP: "SBP",
  TRANSFER: "TRANSFER",
  CREDIT: "CREDIT",
} as const

const createReturnSchema = z.object({
  saleId: z.string().min(1),
  items: z
    .array(
      z.object({
        saleItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Выберите товары для возврата"),
  reason: z.string().min(1, "Укажите причину возврата"),
  // FIN-09: refundMethod обязательное поле — Zod throws если undefined,
  // ошибка содержит "refundMethod" path что ловит Wave 0 RED тест.
  refundMethod: z.nativeEnum(REFUND_METHOD_VALUES),
})

export type CreateReturnInput = z.infer<typeof createReturnSchema>

// UX2-06: shared include shape used by both the freshly-created Sale
// returned from the transaction and the idempotency short-circuit
// lookup (`db.sale.findUnique`). Keeping them in one place guarantees
// that the two paths return identical formatted payloads.
const SALE_RETURN_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      serialUnit: { select: { id: true, imei: true, imei2: true, serialNumber: true } },
    },
  },
  payments: true,
  seller: { select: { firstName: true, lastName: true } },
  store: { select: { name: true, address: true, phone: true } },
} as const

type SaleWithRelations = Prisma.SaleGetPayload<{ include: typeof SALE_RETURN_INCLUDE }>

function formatSaleResult(sale: SaleWithRelations) {
  return {
    id: sale.id,
    number: sale.number,
    totalAmount: sale.totalAmount.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    finalAmount: sale.finalAmount.toNumber(),
    cashReceived: sale.cashReceived ? sale.cashReceived.toNumber() : null,
    changeAmount: sale.changeAmount ? sale.changeAmount.toNumber() : null,
    comment: sale.comment,
    createdAt: sale.createdAt.toISOString(),
    sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
    storeName: sale.store.name,
    storeAddress: sale.store.address,
    storePhone: sale.store.phone,
    items: sale.items.map((si) => ({
      id: si.id,
      productId: si.productId,
      productName: si.product?.name ?? si.name,
      productSku: si.product?.sku ?? "",
      quantity: si.quantity,
      price: si.price.toNumber(),
      costPrice: si.costPrice.toNumber(),
      discount: si.discount.toNumber(),
      total: si.total.toNumber(),
      imei: si.serialUnit?.imei ?? null,
      imei2: si.serialUnit?.imei2 ?? null,
      serialNumber: si.serialUnit?.serialNumber ?? null,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
    })),
  }
}

export async function searchPosProducts(storeId: string, search: string, categoryId?: string) {
  await requirePermission("pos.sell", storeId)

  // UX2-17: Allow category-only queries (empty search + non-empty categoryId).
  // Previously any empty search short-circuited to [], so клик по категории ничего не давал.
  if (!search?.trim() && !categoryId) {
    return []
  }

  const trimmed = search?.trim() ?? ""

  const storeProducts = await db.storeProduct.findMany({
    where: {
      storeId,
      product: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(trimmed.length > 0
          ? {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { sku: { contains: trimmed, mode: "insensitive" } },
                { barcode: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          category: { select: { isSerialized: true, identifierType: true } },
        },
      },
    },
    take: 20,
  })

  // Count available serial units for serialized products
  const serializedProductIds = storeProducts
    .filter((sp) => sp.product.category?.isSerialized)
    .map((sp) => sp.productId)

  const serialCounts: Record<string, number> = {}
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
    for (const c of counts) {
      serialCounts[c.productId] = c._count
    }
  }

  return storeProducts
    .map((sp) => {
      const isSerialized = sp.product.category?.isSerialized ?? false
      const identifierType = sp.product.category?.identifierType ?? null
      // LOCK-06: Available stock excludes reserved quantity (pending transfers)
      const maxStock = isSerialized
        ? (serialCounts[sp.productId] ?? 0)
        : sp.quantity - sp.reservedQuantity

      if (maxStock <= 0) return null

      return {
        productId: sp.product.id,
        name: sp.product.name,
        sku: sp.product.sku,
        barcode: sp.product.barcode,
        price: sp.sellPrice.toNumber(),
        costPrice: sp.costPrice.toNumber(),
        maxStock,
        isSerialized,
        identifierType,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export async function searchByImeiForPos(storeId: string, imei: string) {
  await requirePermission("pos.sell", storeId)

  const unit = await db.serialUnit.findFirst({
    where: {
      OR: [{ imei: imei }, { imei2: imei }, { serialNumber: imei }],
      storeId,
      status: "IN_STOCK",
    },
    include: {
      product: { select: { id: true, name: true, sku: true, barcode: true } },
    },
  })

  if (!unit) return null

  const sp = await db.storeProduct.findUnique({
    where: { storeId_productId: { storeId, productId: unit.productId } },
  })

  return {
    serialUnitId: unit.id,
    productId: unit.product.id,
    name: unit.product.name,
    sku: unit.product.sku,
    barcode: unit.product.barcode,
    imei: unit.imei,
    imei2: unit.imei2,
    serialNumber: unit.serialNumber,
    price: sp ? sp.sellPrice.toNumber() : 0,
    costPrice: unit.costPrice.toNumber(),
  }
}

export async function createSale(rawData: CreateSaleInput) {
  // 1. Zod validation — strips price/costPrice if client sends them (SEC-01, SEC-02)
  const data = createSaleSchema.parse(rawData)

  // 2. Auth
  await requirePermission("pos.sell", data.storeId)
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  const sellerId = session.user.id

  // SEC2-06: Write rate limiting
  const rateCheck = checkWriteRateLimit(session.user.id, "pos.sell")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "pos.sell")

  // UX2-06: Idempotency check BEFORE opening transaction.
  // Если клиент повторил запрос (refresh / double-click / retry),
  // возвращаем существующий Sale без попытки создания дубля.
  // Проверка вне транзакции безопасна: уникальный индекс на
  // Sale.idempotencyKey защищает от race (unique constraint error
  // → retry findUnique ниже, см. catch для P2002 после tx.sale.create).
  if (data.idempotencyKey) {
    const existing = await db.sale.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: SALE_RETURN_INCLUDE,
    })
    if (existing) {
      // SEC2-01: подтверждаем что текущий user имеет доступ к store этого Sale
      if (existing.storeId !== data.storeId) {
        throw new Error("idempotencyKey принадлежит другой продаже")
      }
      return formatSaleResult(existing)
    }
  }

  const sale = await db
    .$transaction(async (tx) => {
      // DATA-02: Generate number INSIDE transaction to prevent duplicates
      const number = await getNextNumber("S", tx)

      // SEC-05: Require open shift
      const openShift = await tx.shift.findFirst({
        where: { storeId: data.storeId, status: "OPEN" },
        select: { id: true },
      })
      if (!openShift) {
        throw new Error("Откройте кассовую смену перед продажей")
      }
      const shiftId = openShift.id

      // DATA-01: Batch lock all StoreProduct rows for this sale with SELECT FOR UPDATE
      const productIds = data.items.map((i) => i.productId)
      const locked = await tx.$queryRaw<
        {
          productId: string
          quantity: number
          reservedQuantity: number
          sellPrice: Prisma.Decimal
          costPrice: Prisma.Decimal
          productName: string
        }[]
      >`
      SELECT sp."productId", sp.quantity, sp."reservedQuantity", sp."sellPrice", sp."costPrice", p.name as "productName"
      FROM "StoreProduct" sp
      JOIN "Product" p ON p.id = sp."productId"
      WHERE sp."storeId" = ${data.storeId} AND sp."productId" = ANY(${productIds}::text[])
      FOR UPDATE OF sp
    `
      const stockMap = new Map(locked.map((r) => [r.productId, r]))

      // LOCK-01: Batch lock all SerialUnit rows via SELECT FOR UPDATE
      const serialUnitIds = data.items
        .filter((i) => i.serialUnitId)
        .map((i) => i.serialUnitId as string)
      const lockedSerials = await lockSerialUnits(tx as any, serialUnitIds, data.storeId)
      const serialMap = new Map(lockedSerials.map((u) => [u.id, u]))

      // Resolve prices from DB for each item (SEC-01, SEC-02, SEC-03, SEC-04)
      // Все денежные поля — Prisma.Decimal (не float) — чтобы избежать precision loss.
      const resolvedItems: Array<{
        productId: string
        quantity: number
        price: Prisma.Decimal
        costPrice: Prisma.Decimal
        discount: Prisma.Decimal
        productName: string
        serialUnitId: string | null
      }> = []

      for (const item of data.items) {
        let price: Prisma.Decimal
        let costPrice: Prisma.Decimal
        let productName: string

        if (item.serialUnitId) {
          // LOCK-01: Serialized product — use pre-locked SerialUnit from serialMap
          const unit = serialMap.get(item.serialUnitId)
          if (!unit) throw new Error("Серийная единица недоступна для продажи")
          // productId validation
          if (unit.productId !== item.productId) {
            throw new Error("Серийная единица не принадлежит этому товару")
          }
          // Get price from StoreProduct (already locked via FOR UPDATE)
          const stock = stockMap.get(item.productId)
          if (!stock) throw new Error("Товар не найден в магазине")
          price = toMoney(stock.sellPrice)
          costPrice = toMoney(unit.costPrice)
          productName = stock.productName
        } else {
          // Regular product: both prices from StoreProduct (already locked via FOR UPDATE)
          const stock = stockMap.get(item.productId)
          if (!stock) throw new Error("Товар не найден в магазине")
          // SEC-04 + DATA-01 + LOCK-06: quantity check on locked row, excluding reserved
          const availableQty = stock.quantity - (stock.reservedQuantity ?? 0)
          if (availableQty < item.quantity) {
            throw new Error(`Недостаточно товара "${stock.productName}" на складе`)
          }
          price = toMoney(stock.sellPrice)
          costPrice = toMoney(stock.costPrice)
          productName = stock.productName
        }

        // SEC-03: discount bounds (Decimal comparisons)
        const discount = toMoney(item.discount)
        if (discount.lt(0)) throw new Error("Скидка не может быть отрицательной")
        if (discount.gt(price)) throw new Error("Скидка не может превышать цену товара")

        // SEC-03: high discount check (> 30% of price)
        if (price.gt(0) && discount.div(price).gt("0.3")) {
          const hasHighDiscountPerm = await checkPermission("pos.discount_high", data.storeId)
          if (!hasHighDiscountPerm) {
            const percent = Math.round(Number(discount.div(price)) * 100)
            throw new Error(
              `Скидка ${percent}% превышает 30%. Требуется разрешение "Скидка свыше 30%"`,
            )
          }
        }

        resolvedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price,
          costPrice,
          discount,
          productName,
          serialUnitId: item.serialUnitId ?? null,
        })
      }

      // Calculate totals from server-side prices via Decimal helpers — no float drift.
      const totalAmount = sum(...resolvedItems.map((ri) => mul(ri.price, ri.quantity)))
      const discountAmount = sum(...resolvedItems.map((ri) => mul(ri.discount, ri.quantity)))
      const finalAmount = sub(totalAmount, discountAmount)

      // Validate payment total via Decimal
      const paymentTotal = sum(...data.payments.map((p) => toMoney(p.amount)))
      if (paymentTotal.lt(finalAmount)) {
        throw new Error("Сумма оплаты меньше суммы чека")
      }

      // Create sale with server-resolved prices
      const newSale = await tx.sale.create({
        data: {
          number,
          storeId: data.storeId,
          sellerId,
          totalAmount,
          discountAmount,
          finalAmount,
          cashReceived: data.cashReceived ?? null,
          changeAmount: data.changeAmount ?? null,
          comment: data.comment || null,
          shiftId,
          // UX2-06: сохраняем idempotencyKey в Sale для защиты от дублей
          // при повторных вызовах. Уникальный индекс обеспечивает
          // атомарную проверку на случай параллельных запросов.
          idempotencyKey: data.idempotencyKey ?? null,
          items: {
            create: resolvedItems.map((ri) => ({
              productId: ri.productId,
              name: ri.productName,
              quantity: ri.quantity,
              price: ri.price,
              costPrice: ri.costPrice,
              discount: ri.discount,
              // (price - discount) * quantity — precision-safe via Decimal
              total: mul(sub(ri.price, ri.discount), ri.quantity),
              serialUnitId: ri.serialUnitId,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({
              method: p.method as PaymentMethod,
              amount: p.amount,
              shiftId,
            })),
          },
        },
        include: SALE_RETURN_INCLUDE,
      })

      // Update serial units and write history
      for (const ri of resolvedItems) {
        if (ri.serialUnitId) {
          await tx.serialUnit.update({
            where: { id: ri.serialUnitId },
            data: { status: "SOLD" },
          })
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: ri.serialUnitId,
              event: "SOLD",
              storeId: data.storeId,
              comment: `Продажа ${number}`,
              performedById: sellerId,
            },
          })
        }
      }

      // LOCK-03: Atomic batch stock decrement for non-serialized items (reuses Phase 8 helper)
      // INV-04: capture before/after StoreProduct.quantity to log into StoreProductHistory.
      const nonSerializedItems = resolvedItems.filter((ri) => !ri.serialUnitId)
      const productIdsToLog = Array.from(new Set(nonSerializedItems.map((ri) => ri.productId)))
      const preSpRows =
        productIdsToLog.length > 0
          ? await tx.storeProduct.findMany({
              where: { storeId: data.storeId, productId: { in: productIdsToLog } },
              select: { id: true, productId: true, quantity: true },
            })
          : []
      const preQtyMap = new Map(preSpRows.map((r) => [r.productId, r]))

      await decrementStockForItems(
        tx as any,
        data.storeId,
        resolvedItems.map((ri) => ({
          productId: ri.productId,
          quantity: ri.quantity,
          serialUnitId: ri.serialUnitId,
        })),
      )

      // INV-04: log quantity change per productId for non-serialized
      const decrementsByProduct = new Map<string, number>()
      for (const ri of nonSerializedItems) {
        decrementsByProduct.set(
          ri.productId,
          (decrementsByProduct.get(ri.productId) ?? 0) + ri.quantity,
        )
      }
      for (const [productId, dec] of decrementsByProduct) {
        const pre = preQtyMap.get(productId)
        if (!pre) continue
        await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
          storeProductId: pre.id,
          quantityBefore: Number(pre.quantity),
          quantityAfter: Number(pre.quantity) - dec,
          reason: "SALE",
          userId: sellerId,
        })
      }

      // Explicit StoreProduct.quantity decrement for serialized items
      // (keeps StoreProduct counter consistent — mirrors completeOrder pattern)
      for (const ri of resolvedItems) {
        if (ri.serialUnitId) {
          await tx.storeProduct.update({
            where: {
              storeId_productId: { storeId: data.storeId, productId: ri.productId },
            },
            data: { quantity: { decrement: 1 } },
          })
        }
      }

      return newSale
    })
    .catch(async (err) => {
      // UX2-06: Race condition recovery.
      // Два concurrent createSale с одним idempotencyKey: первый commit-ит,
      // второй получает P2002 на уникальном индексе idempotencyKey.
      // Мы находим существующий Sale и возвращаем его вместо проброса ошибки.
      if (
        data.idempotencyKey &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Prisma 7 + pg adapter: meta.target может быть string/string[]
        // или отсутствовать (только modelName). Надёжнее попробовать
        // найти Sale по ключу — если существует, это наш race.
        const existing = await db.sale.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: SALE_RETURN_INCLUDE,
        })
        if (existing) return existing
      }
      throw err
    })

  return formatSaleResult(sale)
}

export async function getSale(saleId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          serialUnit: { select: { id: true, imei: true, imei2: true, serialNumber: true } },
          returnItems: {
            include: { return_: { select: { id: true, number: true } } },
          },
        },
      },
      payments: true,
      seller: { select: { firstName: true, lastName: true } },
      store: { select: { name: true, address: true, phone: true } },
      returns: {
        include: {
          items: true,
          processedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!sale) throw new Error("Продажа не найдена")

  // SEC2-01: IDOR fix — verify user has access to this sale's store
  await requirePermission("pos.sell", sale.storeId)

  return {
    id: sale.id,
    number: sale.number,
    status: sale.status,
    type: sale.type,
    totalAmount: sale.totalAmount.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    finalAmount: sale.finalAmount.toNumber(),
    comment: sale.comment,
    createdAt: sale.createdAt.toISOString(),
    sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
    storeName: sale.store.name,
    storeAddress: sale.store.address,
    storePhone: sale.store.phone,
    items: sale.items.map((si) => ({
      id: si.id,
      productId: si.productId,
      productName: si.product?.name ?? si.name,
      productSku: si.product?.sku ?? "",
      quantity: si.quantity,
      price: si.price.toNumber(),
      costPrice: si.costPrice.toNumber(),
      discount: si.discount.toNumber(),
      total: si.total.toNumber(),
      returnedQuantity: si.returnItems.reduce((sum, ri) => sum + ri.quantity, 0),
      imei: si.serialUnit?.imei ?? null,
      imei2: si.serialUnit?.imei2 ?? null,
      serialNumber: si.serialUnit?.serialNumber ?? null,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
    })),
    returns: sale.returns.map((r) => ({
      id: r.id,
      number: r.number,
      reason: r.reason,
      amount: r.amount.toNumber(),
      createdAt: r.createdAt.toISOString(),
      processedByName: `${r.processedBy.firstName} ${r.processedBy.lastName}`,
      items: r.items.map((ri) => ({
        saleItemId: ri.saleItemId,
        quantity: ri.quantity,
      })),
    })),
  }
}

export async function searchSaleByNumber(number: string) {
  await requirePermission("pos.return")

  if (!number.trim()) return null

  const sale = await db.sale.findFirst({
    where: {
      number: { equals: number.trim(), mode: "insensitive" },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          returnItems: true,
          serialUnit: { select: { id: true, imei: true, imei2: true, serialNumber: true } },
        },
      },
      payments: true,
      seller: { select: { firstName: true, lastName: true } },
      store: { select: { name: true, address: true, phone: true } },
    },
  })

  if (!sale) return null

  return {
    id: sale.id,
    number: sale.number,
    status: sale.status,
    type: sale.type,
    totalAmount: sale.totalAmount.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    finalAmount: sale.finalAmount.toNumber(),
    comment: sale.comment,
    createdAt: sale.createdAt.toISOString(),
    sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
    storeName: sale.store.name,
    storeAddress: sale.store.address,
    storePhone: sale.store.phone,
    items: sale.items.map((si) => ({
      id: si.id,
      productId: si.productId,
      productName: si.product?.name ?? si.name,
      productSku: si.product?.sku ?? "",
      quantity: si.quantity,
      price: si.price.toNumber(),
      costPrice: si.costPrice.toNumber(),
      discount: si.discount.toNumber(),
      total: si.total.toNumber(),
      returnedQuantity: si.returnItems.reduce((sum, ri) => sum + ri.quantity, 0),
      serialUnitId: si.serialUnit?.id ?? null,
      imei: si.serialUnit?.imei ?? null,
      imei2: si.serialUnit?.imei2 ?? null,
      serialNumber: si.serialUnit?.serialNumber ?? null,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
    })),
    matchedSaleItemId: null as string | null,
  }
}

export async function searchSaleByImei(imei: string) {
  await requirePermission("pos.return")

  if (!imei.trim()) return null

  const unit = await db.serialUnit.findFirst({
    where: {
      OR: [{ imei }, { imei2: imei }, { serialNumber: imei }],
      status: "SOLD",
    },
    include: {
      saleItem: {
        include: {
          sale: {
            include: {
              items: {
                include: {
                  product: { select: { id: true, name: true, sku: true } },
                  returnItems: true,
                  serialUnit: { select: { id: true, imei: true, imei2: true, serialNumber: true } },
                },
              },
              payments: true,
              seller: { select: { firstName: true, lastName: true } },
              store: { select: { name: true, address: true, phone: true } },
            },
          },
        },
      },
    },
  })

  if (!unit?.saleItem?.sale) return null

  const sale = unit.saleItem.sale
  return {
    id: sale.id,
    number: sale.number,
    status: sale.status,
    type: sale.type,
    totalAmount: sale.totalAmount.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    finalAmount: sale.finalAmount.toNumber(),
    comment: sale.comment,
    createdAt: sale.createdAt.toISOString(),
    sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
    storeName: sale.store.name,
    storeAddress: sale.store.address,
    storePhone: sale.store.phone,
    items: sale.items.map((si) => ({
      id: si.id,
      productId: si.productId,
      productName: si.product?.name ?? si.name,
      productSku: si.product?.sku ?? "",
      quantity: si.quantity,
      price: si.price.toNumber(),
      costPrice: si.costPrice.toNumber(),
      discount: si.discount.toNumber(),
      total: si.total.toNumber(),
      returnedQuantity: si.returnItems.reduce((sum, ri) => sum + ri.quantity, 0),
      serialUnitId: si.serialUnit?.id ?? null,
      imei: si.serialUnit?.imei ?? null,
      imei2: si.serialUnit?.imei2 ?? null,
      serialNumber: si.serialUnit?.serialNumber ?? null,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
    })),
    matchedSaleItemId: unit.saleItem.id,
  }
}

export async function createReturn(rawData: {
  saleId: string
  items: Array<{ saleItemId: string; quantity: number }>
  reason: string
  refundMethod?: "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"
}) {
  // FIN-09: validate refundMethod required + structure через Zod.
  // Сообщение об ошибке Zod содержит "refundMethod" — Wave 0 тест это проверяет.
  const data = createReturnSchema.parse(rawData)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // SEC-06: Load sale BEFORE permission check to get storeId
  const saleForAuth = await db.sale.findUnique({
    where: { id: data.saleId },
    select: { storeId: true },
  })
  if (!saleForAuth) throw new Error("Продажа не найдена")

  // SEC-06: Check permission with storeId from sale
  await requirePermission("pos.return", saleForAuth.storeId)

  // FIN-10: Atomicity — вся работа внутри одной db.$transaction.
  // Любой throw откатывает Sale.status, Return create, stock changes, CustomOrder sync —
  // Prisma делает это автоматически, ручных compensations не пишем.
  const result = await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction to prevent duplicates
    const number = await getNextNumber("R", tx)
    const sale = await tx.sale.findUnique({
      where: { id: data.saleId },
      include: {
        items: {
          include: { returnItems: true },
          // serialUnitId is a scalar field on SaleItem, included automatically
        },
        payments: true,
        customOrder: true,
      },
    })

    if (!sale) throw new Error("Продажа не найдена")
    if (sale.status === "RETURNED") throw new Error("Продажа уже полностью возвращена")

    // FIN-09: Soft-set validation — refundMethod обязан принадлежать множеству
    // методов оригинальной оплаты Sale (исключаем compensating entries isExpense=true).
    const originalMethods = new Set<PaymentMethod>(
      sale.payments.filter((p) => !p.isExpense).map((p) => p.method),
    )
    if (originalMethods.size > 0 && !originalMethods.has(data.refundMethod as PaymentMethod)) {
      const methodsList = Array.from(originalMethods).join(", ")
      throw new Error(
        `Метод возврата ${data.refundMethod} не совпадает с методами оплаты: ${methodsList}`,
      )
    }

    // Lookup open shift
    const openShift = await tx.shift.findFirst({
      where: { storeId: sale.storeId, status: "OPEN" },
      select: { id: true },
    })
    const shiftId = openShift?.id ?? null

    // Аккумулируем returnAmount через Decimal — без float drift.
    let returnAmount: Prisma.Decimal = new Prisma.Decimal(0)

    for (const returnItem of data.items) {
      const saleItem = sale.items.find((si) => si.id === returnItem.saleItemId)
      if (!saleItem) throw new Error("Позиция не найдена")

      const alreadyReturned = saleItem.returnItems.reduce((s, ri) => s + ri.quantity, 0)
      const available = saleItem.quantity - alreadyReturned
      if (returnItem.quantity > available) {
        throw new Error(`Нельзя вернуть больше, чем продано`)
      }

      // (price - discount) × quantity — всё через Decimal
      const lineAmount = mul(sub(saleItem.price, saleItem.discount), returnItem.quantity)
      returnAmount = sum(returnAmount, lineAmount)
    }

    // Create return
    const newReturn = await tx.return.create({
      data: {
        number,
        saleId: data.saleId,
        reason: data.reason,
        amount: returnAmount,
        userId: session.user!.id,
        refundMethod: data.refundMethod as PaymentMethod,
        shiftId,
        items: {
          create: data.items.map((ri) => ({
            saleItemId: ri.saleItemId,
            quantity: ri.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // DATA-01: Lock StoreProduct rows before restoring stock
    const returnProductIds = data.items
      .map((ri) => sale.items.find((si) => si.id === ri.saleItemId)!)
      .filter((si) => !si.serialUnitId && si.productId)
      .map((si) => si.productId)
    if (returnProductIds.length > 0) {
      await tx.$queryRaw`
        SELECT "productId" FROM "StoreProduct"
        WHERE "storeId" = ${sale.storeId} AND "productId" = ANY(${returnProductIds}::text[])
        FOR UPDATE
      `
    }

    // Restore stock
    for (const returnItem of data.items) {
      const saleItem = sale.items.find((si) => si.id === returnItem.saleItemId)!
      if (saleItem.serialUnitId) {
        // Serialized: restore serial unit status
        await tx.serialUnit.update({
          where: { id: saleItem.serialUnitId },
          data: { status: "IN_STOCK", storeId: sale.storeId },
        })
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: saleItem.serialUnitId,
            event: "RETURNED",
            storeId: sale.storeId,
            comment: `Возврат ${number}`,
            performedById: session.user!.id,
          },
        })
      } else if (saleItem.productId) {
        // Non-serialized: increment stock (row already locked via FOR UPDATE above)
        const beforeSp = await tx.storeProduct.findUnique({
          where: {
            storeId_productId: { storeId: sale.storeId, productId: saleItem.productId },
          },
        })
        await tx.storeProduct.update({
          where: {
            storeId_productId: { storeId: sale.storeId, productId: saleItem.productId },
          },
          data: { quantity: { increment: returnItem.quantity } },
        })
        // INV-04: log RETURN reason for non-serialized return
        if (beforeSp) {
          await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
            storeProductId: beforeSp.id,
            quantityBefore: Number(beforeSp.quantity),
            quantityAfter: Number(beforeSp.quantity) + returnItem.quantity,
            reason: "RETURN",
            userId: session.user!.id,
          })
        }
      }
    }

    // Check if all items fully returned
    const updatedSale = await tx.sale.findUnique({
      where: { id: data.saleId },
      include: {
        items: { include: { returnItems: true } },
      },
    })

    const isFullReturn = updatedSale!.items.every((si) => {
      const returned = si.returnItems.reduce((sum, ri) => sum + ri.quantity, 0)
      return returned >= si.quantity
    })

    await tx.sale.update({
      where: { id: data.saleId },
      data: {
        status: isFullReturn ? "RETURNED" : "PARTIALLY_RETURNED",
      },
    })

    // FIN-07: Sync CustomOrder при возврате связанной Sale.
    // Full return → CustomOrder.status = CANCELLED + cancellationType='REFUND' + audit history.
    // Partial return → CustomOrder остаётся COMPLETED (товар частично у клиента).
    // НЕ добавляем REFUNDED enum value — reuse CANCELLED + OrderStatusHistory для аудита.
    if (sale.customOrder && isFullReturn) {
      await tx.customOrder.update({
        where: { id: sale.customOrder.id },
        data: {
          status: "CANCELLED",
          cancellationType: "REFUND",
          cancelReason: `Возврат продажи ${sale.number}: ${data.reason}`,
        },
      })
      await tx.orderStatusHistory.create({
        data: {
          orderId: sale.customOrder.id,
          status: "CANCELLED",
          userId: session.user!.id,
          comment: `Возврат продажи ${sale.number}: ${data.reason}`,
        },
      })
    }

    return {
      id: newReturn.id,
      number: newReturn.number,
      amount: newReturn.amount.toNumber(),
    }
  })

  return result
}

export async function getSalesByShift(shiftId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    select: { storeId: true },
  })
  if (!shift) throw new Error("Смена не найдена")

  await requirePermission("pos.sell", shift.storeId)

  const sales = await db.sale.findMany({
    where: { shiftId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      items: { include: { product: { select: { name: true } } } },
      payments: true,
      seller: { select: { firstName: true, lastName: true } },
    },
  })

  return sales.map((s) => ({
    id: s.id,
    number: s.number,
    createdAt: s.createdAt.toISOString(),
    finalAmount: s.finalAmount.toNumber(),
    sellerName: `${s.seller.firstName} ${s.seller.lastName}`,
    itemCount: s.items.reduce((sum, i) => sum + i.quantity, 0),
    status: s.status,
  }))
}

export async function getDailySummary(storeId: string, date: Date) {
  await requirePermission("pos.sell", storeId)

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const sales = await db.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { payments: true },
  })

  // Агрегация через Decimal — 0.1 + 0.2 = 0.3 ровно, без float drift.
  const totalRevenueDec = sum(...sales.map((s) => s.finalAmount))
  const totalDiscountDec = sum(...sales.map((s) => s.discountAmount))
  const avgCheckDec = sales.length > 0 ? totalRevenueDec.div(sales.length) : new Prisma.Decimal(0)

  const byMethodDec: Record<string, Prisma.Decimal> = {}
  for (const sale of sales) {
    for (const p of sale.payments) {
      byMethodDec[p.method] = byMethodDec[p.method]
        ? sum(byMethodDec[p.method], p.amount)
        : toMoney(p.amount)
    }
  }

  // Serialize к числу для клиента (граница API) через .toNumber() — не Number().
  const byMethod: Record<string, number> = {}
  for (const [k, v] of Object.entries(byMethodDec)) {
    byMethod[k] = v.toNumber()
  }

  return {
    totalRevenue: +totalRevenueDec.toFixed(2),
    totalDiscount: +totalDiscountDec.toFixed(2),
    salesCount: sales.length,
    avgCheck: +avgCheckDec.toFixed(2),
    byMethod,
  }
}
