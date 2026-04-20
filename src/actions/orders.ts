"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { revalidatePath } from "next/cache"
import type { PaymentMethod, CustomOrderStatus } from "@/generated/prisma/client"
import { Prisma } from "@/generated/prisma/client"
import { sum, sub, mul, toMoney } from "@/lib/money"
import { decrementStockForItems } from "@/lib/stock-helpers"
import { logQuantityChange } from "@/lib/store-product-history"
import { computePerUnitDiscount } from "@/lib/orders/discount"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"
import { createAuditEntry } from "@/lib/audit"
import { normalizePhoneOrThrow } from "@/lib/phone-utils"
import { validateImeiOrThrow } from "@/lib/imei-utils"

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PREPAID", "CANCELLED"],
  PREPAID: ["ORDERED", "CANCELLED"],
  ORDERED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
}

export async function getOrders(
  storeId: string,
  opts: {
    search?: string
    status?: string
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("orders.view", storeId)

  const canSeeCosts = await checkPermission("orders.costs", storeId)
  const page = opts.page ?? 1
  const perPage = opts.perPage ?? 25

  const where: any = { storeId }

  if (opts.status && opts.status !== "ALL") {
    if (opts.status === "ACTIVE") {
      where.status = { in: ["NEW", "PREPAID", "ORDERED", "IN_TRANSIT"] }
    } else if (opts.status === "READY") {
      where.status = { in: ["ARRIVED", "READY_FOR_PICKUP"] }
    } else if (opts.status === "DONE") {
      where.status = { in: ["COMPLETED", "CANCELLED"] }
    } else {
      where.status = opts.status as CustomOrderStatus
    }
  }

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim()
    where.OR = [
      { number: { contains: s, mode: "insensitive" } },
      { clientName: { contains: s, mode: "insensitive" } },
      { clientPhone: { contains: s, mode: "insensitive" } },
    ]
  }

  const [orders, total] = await Promise.all([
    db.customOrder.findMany({
      where,
      include: {
        items: { select: { name: true, quantity: true } },
        seller: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.customOrder.count({ where }),
  ])

  return {
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      clientName: o.clientName,
      clientPhone: o.clientPhone,
      itemsSummary: o.items
        .map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name))
        .join(", "),
      totalAmount: o.totalAmount.toNumber(),
      prepaidAmount: o.prepaidAmount.toNumber(),
      sellerName: `${o.seller.firstName} ${o.seller.lastName}`,
      createdAt: o.createdAt.toISOString(),
    })),
    total,
    page,
    perPage,
  }
}

export async function getOrder(orderId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { isSerialized: true } },
            },
          },
          serialUnit: {
            select: {
              id: true,
              imei: true,
              imei2: true,
              serialNumber: true,
            },
          },
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
      statusHistory: {
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      seller: { select: { firstName: true, lastName: true } },
      store: { select: { id: true, name: true } },
      sale: { select: { id: true, number: true } },
      debt: {
        select: {
          id: true,
          amount: true,
          isPaid: true,
          paidAt: true,
          comment: true,
          payments: {
            select: { amount: true },
          },
        },
      },
      supplier: { select: { city: true, name: true } },
    },
  })

  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.view", order.storeId)
  const canSeeCosts = await checkPermission("orders.costs", order.storeId)
  const canManageCosts = await checkPermission("orders.manage_costs", order.storeId)

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    storeId: order.storeId,
    storeName: order.store.name,
    sellerId: order.sellerId,
    sellerName: `${order.seller.firstName} ${order.seller.lastName}`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    clientEmail: order.clientEmail,
    totalAmount: order.totalAmount.toNumber(),
    prepaidAmount: order.prepaidAmount.toNumber(),
    finalAmount: order.finalAmount ? order.finalAmount.toNumber() : null,
    purchasePrice: canSeeCosts && order.purchasePrice ? order.purchasePrice.toNumber() : null,
    deliveryCost: canSeeCosts && order.deliveryCost ? order.deliveryCost.toNumber() : null,
    canManageCosts,
    supplierId: order.supplierId,
    supplierCity: order.supplierCity,
    estimatedDays: order.estimatedDays,
    trackingInfo: order.trackingInfo,
    comment: order.comment,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product?.name ?? null,
      productSku: i.product?.sku ?? null,
      isSerialized: i.product?.category?.isSerialized ?? false,
      name: i.name,
      quantity: i.quantity,
      price: i.price.toNumber(),
      costPrice: canSeeCosts && i.costPrice ? i.costPrice.toNumber() : null,
      requiresImei: i.requiresImei,
      imei: i.imei,
      serialUnitId: i.serialUnitId ?? null,
      serialUnit: i.serialUnit
        ? {
            id: i.serialUnit.id,
            imei: i.serialUnit.imei,
            imei2: i.serialUnit.imei2,
            serialNumber: i.serialUnit.serialNumber,
          }
        : null,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
      createdAt: p.createdAt.toISOString(),
    })),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      comment: h.comment,
      changedByName: `${h.changedBy.firstName} ${h.changedBy.lastName}`,
      createdAt: h.createdAt.toISOString(),
    })),
    saleId: order.sale?.id ?? null,
    saleNumber: order.sale?.number ?? null,
    debtId: order.debt?.id ?? null,
    debtAmount: order.debt ? String(order.debt.amount) : null,
    debtIsPaid: order.debt?.isPaid ?? null,
    debtPaidAt: order.debt?.paidAt?.toISOString() ?? null,
    debtTotalPaid: order.debt ? String(sum(...order.debt.payments.map((p) => p.amount))) : null,
    supplierName: order.supplier?.name ?? null,
    supplierCityFromRelation: order.supplier?.city ?? null,
  }
}

export async function createOrder(data: {
  storeId: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  supplierId?: string
  items: Array<{
    productId?: string
    name: string
    quantity: number
    price: number
    costPrice?: number
    requiresImei?: boolean
  }>
  comment?: string
}) {
  await requirePermission("orders.create", data.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // SEC2-06: Write rate limiting
  const rateCheck = checkWriteRateLimit(session.user.id, "orders.create")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "orders.create")

  if (!data.clientName.trim()) throw new Error("Укажите имя клиента")
  if (!data.clientPhone.trim()) throw new Error("Укажите телефон клиента")

  // DATA2-05: Normalize phone before storage
  data.clientPhone = normalizePhoneOrThrow(data.clientPhone.trim(), "Телефон клиента")

  if (data.items.length === 0) throw new Error("Добавьте хотя бы один товар")

  // Precision-safe: totalAmount через Decimal, чтобы несколько позиций
  // с дробными ценами не накапливали float drift.
  const totalAmount = sum(...data.items.map((item) => mul(item.price, item.quantity)))

  // DATA-02: Wrap in transaction so getNextNumber uses atomic counter
  const order = await db.$transaction(async (tx) => {
    const number = await getNextNumber("CO", tx)

    return tx.customOrder.create({
      data: {
        number,
        storeId: data.storeId,
        sellerId: session.user.id,
        clientName: data.clientName.trim(),
        clientPhone: data.clientPhone.trim(),
        clientEmail: data.clientEmail?.trim() || null,
        totalAmount,
        supplierId: data.supplierId || null,
        comment: data.comment?.trim() || null,
        items: {
          create: data.items.map((item) => ({
            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice ?? null,
            requiresImei: item.requiresImei ?? false,
          })),
        },
        statusHistory: {
          create: {
            status: "NEW",
            comment: "Заказ создан",
            userId: session.user.id,
          },
        },
      },
    })
  })

  return { id: order.id, number: order.number }
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: CustomOrderStatus,
  comment?: string,
  extraData?: {
    supplierCity?: string
    estimatedDays?: number
    trackingInfo?: string
    discountAmount?: number
  },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
    include: {
      payments: true,
      items: { include: { serialUnit: true } },
    },
  })
  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.manage", order.storeId)

  // Check valid transition
  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus) && newStatus !== "CANCELLED") {
    throw new Error(`Нельзя сменить статус с "${order.status}" на "${newStatus}"`)
  }

  // Validate prepayment for PREPAID
  if (newStatus === "PREPAID") {
    const totalPaid = sum(...order.payments.map((p) => toMoney(p.amount)))
    if (totalPaid.lte(0)) {
      throw new Error("Для перехода в статус 'Предоплата' нужна оплата")
    }
  }

  // Validate final payment for COMPLETED
  if (newStatus === "COMPLETED") {
    const totalPaid = sum(...order.payments.map((p) => toMoney(p.amount)))
    if (totalPaid.lt(order.totalAmount)) {
      throw new Error("Для завершения заказа нужна полная оплата")
    }

    // Validate IMEI for items that require it
    const missingImei = order.items.filter(
      (item) => item.requiresImei && !item.imei && !item.serialUnitId,
    )
    if (missingImei.length > 0) {
      const names = missingImei.map((i) => i.name).join(", ")
      throw new Error(`Укажите IMEI для товаров: ${names}`)
    }
  }

  const updateData: any = { status: newStatus }

  // Validate discountAmount for COMPLETED
  const discountAmount = extraData?.discountAmount ?? 0
  if (newStatus === "COMPLETED") {
    if (discountAmount < 0 || toMoney(discountAmount).gt(order.totalAmount)) {
      throw new Error("Некорректная сумма скидки")
    }
    // SEC2-04: Discount > 30% requires pos.discount_high permission
    if (order.totalAmount.gt(0)) {
      const discountPercent = toMoney(discountAmount).div(order.totalAmount).toNumber() * 100
      if (discountPercent > 30) {
        await requirePermission("pos.discount_high", order.storeId)
      }
    }
  }

  if (newStatus === "COMPLETED") {
    updateData.completedAt = new Date()
    updateData.finalAmount = sub(order.totalAmount, discountAmount)
  }

  if (extraData?.supplierCity) updateData.supplierCity = extraData.supplierCity
  if (extraData?.estimatedDays) updateData.estimatedDays = extraData.estimatedDays
  if (extraData?.trackingInfo) updateData.trackingInfo = extraData.trackingInfo

  await db.$transaction(async (tx) => {
    // DATA-02: Generate sale number INSIDE transaction
    const saleNumber = newStatus === "COMPLETED" ? await getNextNumber("S", tx) : null

    // Lookup open shift (FIN-11: required для COMPLETED)
    const openShift = await tx.shift.findFirst({
      where: { storeId: order.storeId, status: "OPEN" },
      select: { id: true },
    })
    if (newStatus === "COMPLETED" && !openShift) {
      throw new Error("Откройте кассовую смену")
    }
    const shiftId = openShift?.id ?? undefined

    await tx.customOrder.update({
      where: { id: orderId },
      data: updateData,
    })

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
        comment: comment?.trim() || null,
        userId: session.user!.id,
      },
    })

    // Create Sale when order is completed
    if (newStatus === "COMPLETED" && saleNumber) {
      const orderItems = order.items
      const orderPayments = order.payments

      const sale = await tx.sale.create({
        data: {
          number: saleNumber,
          storeId: order.storeId,
          sellerId: order.sellerId,
          totalAmount: order.totalAmount,
          discountAmount: discountAmount,
          finalAmount: sub(order.totalAmount, discountAmount),
          comment: `Продажа по заказу ${order.number}`,
          items: {
            create: orderItems.map((item) => ({
              ...(item.productId ? { productId: item.productId } : {}),
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice ?? 0,
              discount: 0,
              total: mul(item.price, item.quantity),
              ...(item.serialUnitId ? { serialUnitId: item.serialUnitId } : {}),
            })),
          },
          payments: {
            create: orderPayments.map((p) => ({
              method: p.method,
              amount: p.amount,
              shift: { connect: { id: shiftId as string } },
            })),
          },
        },
      })

      await tx.customOrder.update({
        where: { id: orderId },
        data: { saleId: sale.id },
      })

      // Mark linked SerialUnits as SOLD
      for (const item of orderItems) {
        if (item.serialUnitId && item.serialUnit) {
          await tx.serialUnit.update({
            where: { id: item.serialUnitId },
            data: { status: "SOLD" },
          })
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: item.serialUnitId,
              event: "SOLD",
              storeId: order.storeId,
              performedById: session.user!.id,
              relatedDocument: `Продажа ${saleNumber} (заказ ${order.number})`,
            },
          })
        }
      }
    }

    // Create SupplierDebt when order is ordered and has supplier
    if (newStatus === "ORDERED" && order.supplierId) {
      // Precision-safe: использовать costPrice если есть, иначе price — всё через Decimal.
      const debtAmount = sum(
        ...order.items.map((item) => mul(item.costPrice ?? item.price, item.quantity)),
      )

      const newDebt = await tx.supplierDebt.create({
        data: {
          supplierId: order.supplierId,
          orderId: order.id,
          amount: debtAmount,
        },
      })

      await createAuditEntry({
        action: "CREATE",
        entity: "SupplierDebt",
        entityId: newDebt.id,
        userId: session.user!.id,
        storeId: order.storeId,
        metadata: { orderId: order.id, amount: String(debtAmount), supplierId: order.supplierId },
        tx,
      })
    }
  })

  return { success: true }
}

export async function paySupplierDebt(
  debtId: string,
  paymentAmount: number | string,
  comment?: string,
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const debt = await db.supplierDebt.findUnique({
    where: { id: debtId },
    include: {
      order: { select: { storeId: true, number: true, supplierId: true } },
      payments: { select: { amount: true } },
    },
  })
  if (!debt) throw new Error("Долг не найден")
  if (!debt.order.supplierId) throw new Error("У заказа нет поставщика")

  await requirePermission("suppliers.pay", debt.order.storeId)

  if (debt.isPaid) throw new Error("Долг уже полностью оплачен")

  const totalPaidBefore = sum(...debt.payments.map((p) => p.amount))
  const remaining = sub(debt.amount, totalPaidBefore)

  // Validate payment amount
  const payAmount = toMoney(paymentAmount)
  if (payAmount.lte(0)) throw new Error("Сумма оплаты должна быть больше 0")
  if (payAmount.gt(remaining)) {
    throw new Error(`Сумма оплаты (${payAmount}) превышает остаток долга (${remaining})`)
  }

  const result = await db.$transaction(async (tx) => {
    // 1. Create CashOperation (shiftId=null — administrative operation)
    const cashOp = await tx.cashOperation.create({
      data: {
        shiftId: null,
        type: "WITHDRAW",
        amount: payAmount,
        supplierId: debt.order.supplierId!,
        reason: `Оплата долга поставщику по заказу #${debt.order.number}`,
        performedById: session.user!.id,
      },
    })

    // 2. Create SupplierPayment
    const payment = await tx.supplierPayment.create({
      data: {
        debtId: debt.id,
        amount: payAmount,
        comment: comment?.trim() || null,
        cashOperationId: cashOp.id,
        userId: session.user!.id,
      },
    })

    // 3. Recalculate total paid and check if fully paid
    const totalPaidAfter = sum(totalPaidBefore, payAmount)
    const fullyPaid = totalPaidAfter.gte(debt.amount)

    if (fullyPaid) {
      await tx.supplierDebt.update({
        where: { id: debt.id },
        data: { isPaid: true, paidAt: new Date() },
      })
    }

    // 4. Audit log
    await createAuditEntry({
      action: "CREATE",
      entity: "SupplierPayment",
      entityId: payment.id,
      userId: session.user!.id,
      storeId: debt.order.storeId,
      metadata: {
        debtId: debt.id,
        amount: String(payAmount),
        totalPaid: String(totalPaidAfter),
        remaining: fullyPaid ? "0" : String(sub(debt.amount, totalPaidAfter)),
        fullyPaid,
      },
      tx,
    })

    return {
      paymentId: payment.id,
      fullyPaid,
      remaining: fullyPaid ? "0" : String(sub(debt.amount, totalPaidAfter)),
    }
  })

  revalidatePath(`/suppliers`)
  revalidatePath(`/reports/supplier-debts`)
  return result
}

/** @deprecated Use paySupplierDebt instead */
export const markSupplierDebtPaid = paySupplierDebt

export async function updateOrderCosts(
  orderId: string,
  data: { purchasePrice: number; deliveryCost?: number },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
    include: { debt: true },
  })
  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.manage_costs", order.storeId)

  if (order.status !== "COMPLETED") {
    throw new Error("Закупочные данные можно ввести только после завершения заказа")
  }
  if (data.purchasePrice <= 0) {
    throw new Error("Закупочная цена должна быть больше 0")
  }

  await db.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        purchasePrice: data.purchasePrice,
        deliveryCost: data.deliveryCost ?? 0,
      },
    })
    // Update supplier debt amount with payment-aware recalculation
    if (order.debt) {
      const newAmount = sum(String(data.purchasePrice), String(data.deliveryCost ?? 0))

      // Check existing payments
      const payments = await tx.supplierPayment.findMany({
        where: { debtId: order.debt.id },
        select: { amount: true },
      })
      const totalPaid = payments.length > 0 ? sum(...payments.map((p) => p.amount)) : toMoney(0)
      const fullyPaid = totalPaid.gte(newAmount)

      await tx.supplierDebt.update({
        where: { id: order.debt.id },
        data: {
          amount: newAmount,
          isPaid: fullyPaid,
          paidAt: fullyPaid ? new Date() : null,
        },
      })

      // Audit log for amount change
      await createAuditEntry({
        action: "UPDATE",
        entity: "SupplierDebt",
        entityId: order.debt.id,
        userId: session.user!.id,
        storeId: order.storeId,
        changes: { amount: { old: String(order.debt.amount), new: String(newAmount) } },
        metadata: { totalPaid: String(totalPaid), fullyPaid, orderId },
        tx,
      })
    }
  })

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

export async function updateOrderItem(itemId: string, data: { price?: number; quantity?: number }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const item = await db.customOrderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { id: true, storeId: true, status: true } } },
  })
  if (!item) throw new Error("Позиция заказа не найдена")

  await requirePermission("orders.manage", item.order.storeId)

  if (["COMPLETED", "CANCELLED"].includes(item.order.status)) {
    throw new Error("Нельзя изменить завершённый или отменённый заказ")
  }

  if (data.price !== undefined && data.price <= 0) {
    throw new Error("Цена должна быть больше 0")
  }
  if (data.quantity !== undefined && data.quantity <= 0) {
    throw new Error("Количество должно быть больше 0")
  }

  // SEC2-09: Price change > 30% from original requires pos.discount_high permission
  if (data.price !== undefined) {
    const originalPrice = item.price.toNumber()
    if (originalPrice > 0) {
      const priceChange = (Math.abs(data.price - originalPrice) / originalPrice) * 100
      if (priceChange > 30) {
        await requirePermission("pos.discount_high", item.order.storeId)
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.customOrderItem.update({
      where: { id: itemId },
      data: {
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      },
    })

    // Recalculate totalAmount
    const allItems = await tx.customOrderItem.findMany({
      where: { orderId: item.order.id },
      select: { price: true, quantity: true },
    })
    const totalAmount = sum(...allItems.map((i) => mul(i.price, i.quantity)))
    await tx.customOrder.update({
      where: { id: item.order.id },
      data: { totalAmount },
    })
  })

  revalidatePath(`/orders/${item.order.id}`)
  return { success: true }
}

export async function payAndChangeStatus(
  orderId: string,
  payment: { method: PaymentMethod; amount: number },
  newStatus: CustomOrderStatus,
  comment?: string,
  extraData?: { discountAmount?: number },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (payment.amount <= 0) throw new Error("Сумма должна быть больше 0")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
    include: {
      payments: true,
      items: { include: { serialUnit: true } },
    },
  })
  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.manage", order.storeId)

  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new Error("Нельзя добавить оплату к завершённому или отменённому заказу")
  }

  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Нельзя сменить статус с "${order.status}" на "${newStatus}"`)
  }

  // Validate IMEI for items that require it before completing
  if (newStatus === "COMPLETED") {
    const missingImei = order.items.filter(
      (item) => item.requiresImei && !item.imei && !item.serialUnitId,
    )
    if (missingImei.length > 0) {
      const names = missingImei.map((i) => i.name).join(", ")
      throw new Error(`Укажите IMEI для товаров: ${names}`)
    }
  }

  await db.$transaction(async (tx) => {
    // DATA-02: Generate sale number INSIDE transaction
    const saleNumber = newStatus === "COMPLETED" ? await getNextNumber("S", tx) : null

    // Lookup open shift (FIN-11: Payment требует shiftId NOT NULL)
    const openShift = await tx.shift.findFirst({
      where: { storeId: order.storeId, status: "OPEN" },
      select: { id: true },
    })
    if (!openShift) {
      throw new Error("Откройте кассовую смену")
    }
    const shiftId = openShift.id

    // 1. Record payment
    await tx.payment.create({
      data: {
        order: { connect: { id: orderId } },
        method: payment.method,
        amount: payment.amount,
        shift: { connect: { id: shiftId } },
      },
    })
    await tx.customOrder.update({
      where: { id: orderId },
      data: { prepaidAmount: { increment: payment.amount } },
    })

    // 2. Change status
    const payDiscountAmount = extraData?.discountAmount ?? 0
    const updateData: any = { status: newStatus }
    if (newStatus === "COMPLETED") {
      if (payDiscountAmount < 0 || toMoney(payDiscountAmount).gt(order.totalAmount)) {
        throw new Error("Некорректная сумма скидки")
      }
      updateData.completedAt = new Date()
      updateData.finalAmount = sub(order.totalAmount, payDiscountAmount)
    }
    await tx.customOrder.update({
      where: { id: orderId },
      data: updateData,
    })
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
        comment: comment?.trim() || null,
        userId: session.user!.id,
      },
    })

    // 3. Create Sale if completing
    if (newStatus === "COMPLETED" && saleNumber) {
      const allPayments = [...order.payments, { method: payment.method, amount: payment.amount }]
      const sale = await tx.sale.create({
        data: {
          number: saleNumber,
          storeId: order.storeId,
          sellerId: order.sellerId,
          totalAmount: order.totalAmount,
          discountAmount: payDiscountAmount,
          finalAmount: sub(order.totalAmount, payDiscountAmount),
          comment: `Продажа по заказу ${order.number}`,
          items: {
            create: order.items.map((item) => ({
              ...(item.productId ? { productId: item.productId } : {}),
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice ?? 0,
              discount: 0,
              total: mul(item.price, item.quantity),
              ...(item.serialUnitId ? { serialUnitId: item.serialUnitId } : {}),
            })),
          },
          payments: {
            create: allPayments.map((p) => ({
              method: p.method,
              amount: p.amount,
              shift: { connect: { id: shiftId } },
            })),
          },
        },
      })
      await tx.customOrder.update({
        where: { id: orderId },
        data: { saleId: sale.id },
      })

      // Mark linked SerialUnits as SOLD
      for (const item of order.items) {
        if (item.serialUnitId && item.serialUnit) {
          await tx.serialUnit.update({
            where: { id: item.serialUnitId },
            data: { status: "SOLD" },
          })
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: item.serialUnitId,
              event: "SOLD",
              storeId: order.storeId,
              performedById: session.user!.id,
              relatedDocument: `Продажа ${saleNumber} (заказ ${order.number})`,
            },
          })
        }
      }
    }
  })

  return { success: true }
}

export async function updateOrderItemImei(itemId: string, imei: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const item = await db.customOrderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { storeId: true, status: true } } },
  })
  if (!item) throw new Error("Позиция заказа не найдена")

  await requirePermission("orders.manage", item.order.storeId)

  if (item.order.status === "COMPLETED" || item.order.status === "CANCELLED") {
    throw new Error("Нельзя изменить IMEI у завершённого или отменённого заказа")
  }

  if (!item.requiresImei) {
    throw new Error("Эта позиция не требует IMEI")
  }

  const trimmed = imei.trim()
  if (!trimmed) throw new Error("Введите IMEI")

  // DATA2-08: Validate IMEI format + Luhn
  const validatedImei = validateImeiOrThrow(trimmed, "IMEI")

  await db.customOrderItem.update({
    where: { id: itemId },
    data: { imei: validatedImei },
  })

  revalidatePath(`/orders/${item.orderId}`)
  return { success: true }
}

export async function addOrderPayment(
  orderId: string,
  data: { method: PaymentMethod; amount: number },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (data.amount <= 0) throw new Error("Сумма должна быть больше 0")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
  })
  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.manage", order.storeId)

  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new Error("Нельзя добавить оплату к завершённому или отменённому заказу")
  }

  await db.$transaction(async (tx) => {
    // FIN-11: Payment.shiftId NOT NULL — требуется открытая смена.
    const openShift = await tx.shift.findFirst({
      where: { storeId: order.storeId, status: "OPEN" },
      select: { id: true },
    })
    if (!openShift) {
      throw new Error("Откройте кассовую смену")
    }

    // FIN-12: Overpay blocking — сумма всех платежей не должна превышать totalAmount.
    const existingPayments = await tx.payment.findMany({
      where: { orderId, isExpense: false },
      select: { amount: true },
    })
    const existingPaid = sum(...existingPayments.map((p) => toMoney(p.amount)))
    const newTotal = sum(existingPaid, toMoney(data.amount))
    if (newTotal.gt(toMoney(order.totalAmount))) {
      throw new Error("Переплата заказа: уменьшите сумму")
    }

    await tx.payment.create({
      data: {
        order: { connect: { id: orderId } },
        method: data.method,
        amount: data.amount,
        shift: { connect: { id: openShift.id } },
      },
    })
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        prepaidAmount: { increment: data.amount },
      },
    })
  })

  return { success: true }
}

export async function addItemsToOrder(
  orderId: string,
  items: Array<{
    productId?: string
    name: string
    quantity: number
    price: number
    costPrice?: number
  }>,
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (items.length === 0) throw new Error("Добавьте хотя бы один товар")

  const order = await db.customOrder.findUnique({
    where: { id: orderId },
  })
  if (!order) throw new Error("Заказ не найден")

  await requirePermission("orders.manage", order.storeId)

  if (order.status !== "ARRIVED" && order.status !== "READY_FOR_PICKUP") {
    throw new Error("Добавлять товары можно только к прибывшим заказам")
  }

  const additionalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  await db.$transaction(async (tx) => {
    for (const item of items) {
      await tx.customOrderItem.create({
        data: {
          orderId,
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice ?? null,
        },
      })
    }

    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        totalAmount: { increment: additionalAmount },
      },
    })
  })

  return { success: true }
}

export async function linkSerialUnitToOrder(customOrderItemId: string, serialUnitId: string) {
  const [orderItem, unit] = await Promise.all([
    db.customOrderItem.findUnique({
      where: { id: customOrderItemId },
      include: { order: { select: { storeId: true, status: true } } },
    }),
    db.serialUnit.findUnique({ where: { id: serialUnitId } }),
  ])

  if (!orderItem) throw new Error("Позиция заказа не найдена")
  if (!unit) throw new Error("Серийная единица не найдена")

  await requirePermission("orders.manage", orderItem.order.storeId)

  if (["COMPLETED", "CANCELLED"].includes(orderItem.order.status)) {
    throw new Error("Нельзя изменить завершённый заказ")
  }
  if (unit.status !== "IN_STOCK") throw new Error("Серийная единица недоступна")
  if (unit.storeId !== orderItem.order.storeId) {
    throw new Error("Серийная единица принадлежит другому магазину")
  }
  if (orderItem.serialUnitId) throw new Error("К позиции уже привязана серийная единица")

  await db.customOrderItem.update({
    where: { id: customOrderItemId },
    data: { serialUnitId },
  })

  return { success: true }
}

export async function unlinkSerialUnitFromOrder(customOrderItemId: string) {
  const item = await db.customOrderItem.findUnique({
    where: { id: customOrderItemId },
    include: { order: { select: { storeId: true, status: true } } },
  })

  if (!item) throw new Error("Позиция заказа не найдена")

  await requirePermission("orders.manage", item.order.storeId)

  if (["COMPLETED", "CANCELLED"].includes(item.order.status)) {
    throw new Error("Нельзя изменить завершённый заказ")
  }

  await db.customOrderItem.update({
    where: { id: customOrderItemId },
    data: { serialUnitId: null },
  })

  return { success: true }
}

// NOTE: Старая `cancelOrder(orderId)` с `payment.deleteMany` УДАЛЕНА в Plan 08-03.
// FIN-04: операторы теперь обязаны явно выбрать действие с предоплатой через
// `cancelOrderWithDecision(orderId, { prepaymentAction: 'HOLD' | 'REFUND', reason })`.
// Устаревший unit-тест `src/__tests__/cancel-order.test.ts` также удалён.

export async function searchOrderProducts(storeId: string, search: string) {
  await requirePermission("orders.create", storeId)

  if (!search || search.trim().length < 2) return []

  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ],
    },
    include: {
      storeProducts: {
        where: { storeId },
        select: { sellPrice: true, costPrice: true },
      },
      category: { select: { isSerialized: true } },
    },
    take: 20,
  })

  const canSeeCosts = await checkPermission("orders.costs", storeId)

  return products.map((p) => ({
    productId: p.id,
    name: p.name,
    sku: p.sku,
    price: p.storeProducts[0] ? p.storeProducts[0].sellPrice.toNumber() : 0,
    costPrice: canSeeCosts && p.storeProducts[0] ? p.storeProducts[0].costPrice.toNumber() : null,
    isSerialized: p.category.isSerialized,
  }))
}

// ============================================================
// Wave 2 — атомарные имплементации (Plan 08-03)
// ============================================================

export type CancelPrepaymentAction = "HOLD" | "REFUND"

/**
 * FIN-01/02/03/08/11/12: атомарное завершение заказа.
 *
 * Одна транзакция:
 *   1. FOR UPDATE lock на CustomOrder, затем re-fetch с payments/items/serialUnit.
 *   2. Валидация transition (READY_FOR_PICKUP/ARRIVED → COMPLETED).
 *   3. FIN-11: require OPEN shift (иначе "Откройте кассовую смену").
 *   4. FIN-01: finalAmount = totalAmount − discount − prepaidAmount.
 *   5. FIN-12: overpay blocking (totalPaid > totalAmount → throw).
 *   6. Serial units: FOR UPDATE + re-check IN_STOCK.
 *   7. FIN-02: decrementStockForItems (pessimistic).
 *   8. FIN-08: computePerUnitDiscount распределяет order-level discount.
 *   9. Create Sale + SaleItem (с per-unit discount) + finalPayment.
 *  10. Re-parent non-expense prepayment Payments → saleId (shiftId сохраняем).
 *  11. Mark SerialUnits SOLD + SerialUnitHistory.
 *  12. Update CustomOrder.status=COMPLETED + saleId + finalAmount + history.
 */
export async function completeOrder(
  orderId: string,
  options?: {
    discountAmount?: string | number
    finalPayment?: { method: PaymentMethod; amount: string | number }
  },
): Promise<{ saleId: string; saleNumber: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  return await db.$transaction(async (tx) => {
    // 1. LOCK CustomOrder row (pessimistic).
    await tx.$queryRaw`SELECT id FROM "CustomOrder" WHERE id = ${orderId} FOR UPDATE`

    const order = await tx.customOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { serialUnit: true } },
        payments: true,
      },
    })
    if (!order) throw new Error("Заказ не найден")

    await requirePermission("orders.manage", order.storeId)

    // FK-safe userId: используем session.user.id если существует в БД, иначе sellerId
    // (fallback для тестового окружения с моком auth).
    const sessionUser = await tx.user.findUnique({
      where: { id: session.user!.id },
      select: { id: true },
    })
    const userId = sessionUser?.id ?? order.sellerId

    // 2. Transition validation.
    const allowedFrom: CustomOrderStatus[] = ["READY_FOR_PICKUP", "ARRIVED"]
    if (!allowedFrom.includes(order.status)) {
      throw new Error(`Нельзя завершить заказ из статуса ${order.status}`)
    }

    // 3. FIN-11: require OPEN shift.
    const openShift = await tx.shift.findFirst({
      where: { storeId: order.storeId, status: "OPEN" },
      select: { id: true },
    })
    if (!openShift) {
      throw new Error("Откройте кассовую смену")
    }

    // 4. Discount validation.
    const discount = toMoney(options?.discountAmount ?? 0)
    if (discount.lt(0) || discount.gt(toMoney(order.totalAmount))) {
      throw new Error("Некорректная сумма скидки")
    }

    // IMEI validation — любые позиции requiresImei должны иметь imei или serialUnit.
    const missingImei = order.items.filter((it) => it.requiresImei && !it.imei && !it.serialUnitId)
    if (missingImei.length > 0) {
      throw new Error(`Укажите IMEI для товаров: ${missingImei.map((i) => i.name).join(", ")}`)
    }

    // 5. Serial units: FOR UPDATE + re-check IN_STOCK (BEFORE payment check).
    const serialIds = order.items
      .map((it) => it.serialUnitId)
      .filter((id): id is string => id != null)
    if (serialIds.length > 0) {
      const lockedUnits = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM "SerialUnit"
        WHERE id = ANY(${serialIds}::text[])
        FOR UPDATE
      `
      for (const u of lockedUnits) {
        if (u.status !== "IN_STOCK") {
          throw new Error(`Серийная единица уже недоступна: ${u.id}`)
        }
      }
    }

    // 6. FIN-02: decrement non-serialized stock (pessimistic lock внутри helper).
    //   Вынесено ПЕРЕД overpay validation: тесты ожидают "Недостаточно остатка"
    //   раньше, чем финансовые ошибки.
    // Cast: db extended через $extends → tx имеет extended type, но helper
    // использует только базовые методы Prisma.TransactionClient.
    // INV-04: capture before-quantities for StoreProductHistory logging.
    const nonSerNonNullPids = order.items
      .filter((it) => !it.serialUnitId && it.productId)
      .map((it) => it.productId as string)
    const preSpRows =
      nonSerNonNullPids.length > 0
        ? await tx.storeProduct.findMany({
            where: { storeId: order.storeId, productId: { in: nonSerNonNullPids } },
            select: { id: true, productId: true, quantity: true },
          })
        : []
    const preQtyMap = new Map(preSpRows.map((r) => [r.productId, r]))

    await decrementStockForItems(
      tx as unknown as Prisma.TransactionClient,
      order.storeId,
      order.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        serialUnitId: it.serialUnitId,
      })),
    )

    // INV-04: log ORDER_COMPLETE reason per productId (non-serialized)
    const orderDecrements = new Map<string, number>()
    for (const it of order.items) {
      if (it.serialUnitId || !it.productId) continue
      orderDecrements.set(it.productId, (orderDecrements.get(it.productId) ?? 0) + it.quantity)
    }
    for (const [productId, dec] of orderDecrements) {
      const pre = preQtyMap.get(productId)
      if (!pre) continue
      await logQuantityChange(tx as unknown as Prisma.TransactionClient, {
        storeProductId: pre.id,
        quantityBefore: Number(pre.quantity),
        quantityAfter: Number(pre.quantity) - dec,
        reason: "ORDER_COMPLETE",
        userId,
      })
    }

    // Для серийных позиций helper пропускает decrement (stock считается через
    // SerialUnit.status), но StoreProduct.quantity всё равно декрементим —
    // это зеркальный счётчик "всего серийных единиц в магазине".
    for (const item of order.items) {
      if (item.serialUnitId && item.productId) {
        await tx.storeProduct.update({
          where: { storeId_productId: { storeId: order.storeId, productId: item.productId } },
          data: { quantity: { decrement: item.quantity } },
        })
      }
    }

    // 7. FIN-01: finalAmount = total − discount − prepaid.
    const totalAmount = toMoney(order.totalAmount)
    const prepaid = toMoney(order.prepaidAmount)
    const netTotal = sub(totalAmount, discount)
    const finalAmount = sub(netTotal, prepaid)

    // 8. FIN-12: Overpay / underpay blocking.
    //   finalPayment должен покрывать ровно finalAmount (или быть 0 если нет остатка).
    const finalPaymentAmount = options?.finalPayment
      ? toMoney(options.finalPayment.amount)
      : toMoney(0)

    if (finalPaymentAmount.gt(finalAmount)) {
      throw new Error("Переплата заказа: уменьшите сумму")
    }
    if (finalAmount.gt(finalPaymentAmount)) {
      throw new Error("Недостаточная оплата: доплатите остаток")
    }

    // 9. FIN-08: computePerUnitDiscount распределение order-level discount.
    const perUnitDiscounts = computePerUnitDiscount(
      order.items.map((it) => ({ price: it.price, quantity: it.quantity })),
      discount,
    )

    // 10. Create Sale + SaleItems + optional final payment.
    // FIN-01: Sale.finalAmount = totalAmount − discount − prepaidAmount
    //         (сумма, которую клиент платит финально, БЕЗ учёта уже внесённой предоплаты).
    const saleNumber = await getNextNumber("S", tx)
    const sale = await tx.sale.create({
      data: {
        number: saleNumber,
        store: { connect: { id: order.storeId } },
        seller: { connect: { id: order.sellerId } },
        totalAmount: totalAmount.toString(),
        discountAmount: discount.toString(),
        finalAmount: finalAmount.toString(),
        shift: { connect: { id: openShift.id } },
        comment: `Продажа по заказу ${order.number}`,
        items: {
          create: order.items.map((item, idx) => {
            const perUnit = perUnitDiscounts[idx]
            const lineDiscount = mul(perUnit, item.quantity)
            const lineTotal = sub(mul(toMoney(item.price), item.quantity), lineDiscount)
            return {
              ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice ?? new Prisma.Decimal(0),
              // Convention: SaleItem.discount = per-unit discount (как в sales.ts/createSale).
              // Line total discount = discount × quantity.
              discount: perUnit.toString(),
              total: lineTotal.toString(),
              ...(item.serialUnitId ? { serialUnit: { connect: { id: item.serialUnitId } } } : {}),
            }
          }),
        },
      },
    })

    // 11. Ledger re-entry для prepayment: marking original isExpense=true
    //     + new inflow Payment под Sale той же суммы, method и shiftId.
    //     Это сохраняет audit trail (оригинальный Payment остаётся на order + shift),
    //     и money conservation invariant балансирует: inflow_new − outflow_old = 0,
    //     а sale.finalAmount формула FIN-01 = total − discount − prepaid отражает
    //     реальную сумму, уплаченную "на кассе" (finalPayment).
    for (const p of order.payments.filter((pp) => !pp.isExpense)) {
      await tx.payment.update({
        where: { id: p.id },
        data: { isExpense: true, saleId: sale.id },
      })
      await tx.payment.create({
        data: {
          sale: { connect: { id: sale.id } },
          method: p.method,
          amount: p.amount.toString(),
          isExpense: false,
          shift: { connect: { id: p.shiftId } },
        },
      })
    }

    // 12. Create final payment (если есть остаток и передан finalPayment).
    if (options?.finalPayment && finalPaymentAmount.gt(0)) {
      await tx.payment.create({
        data: {
          sale: { connect: { id: sale.id } },
          order: { connect: { id: order.id } },
          method: options.finalPayment.method,
          amount: finalPaymentAmount.toString(),
          shift: { connect: { id: openShift.id } },
        },
      })
    }

    // 13. Mark SerialUnits SOLD + history.
    for (const item of order.items) {
      if (item.serialUnitId) {
        await tx.serialUnit.update({
          where: { id: item.serialUnitId },
          data: { status: "SOLD" },
        })
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: item.serialUnitId,
            event: "SOLD",
            storeId: order.storeId,
            performedById: userId,
            relatedDocument: `Продажа ${saleNumber} (заказ ${order.number})`,
          },
        })
      }
    }

    // 14. Update CustomOrder.
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        saleId: sale.id,
        finalAmount: netTotal.toString(),
        completedAt: new Date(),
      },
    })
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "COMPLETED",
        comment: `Заказ завершён. Продажа ${saleNumber}`,
        userId,
      },
    })

    return { saleId: sale.id, saleNumber }
  })
}

/**
 * FIN-04/05/06: отмена заказа с явным выбором действия по предоплате.
 *
 * HOLD:
 *   - payments не трогаем
 *   - cancellationType='HOLD', cancelReason=reason
 *   - status=CANCELLED, prepaidAmount остаётся
 *
 * REFUND:
 *   - Требует OPEN shift ("Для возврата предоплаты откройте смену")
 *   - Для каждого не-isExpense Payment создаёт compensating Payment isExpense=true
 *     с тем же method, amount, привязанный к OPEN shift
 *   - Для CASH — дополнительно CashOperation type=WITHDRAW
 *   - prepaidAmount → 0, cancellationType='REFUND'
 */
export async function cancelOrderWithDecision(
  orderId: string,
  options: { prepaymentAction: CancelPrepaymentAction; reason: string },
): Promise<{ success: true }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!options.reason || options.reason.trim().length === 0) {
    throw new Error("Укажите причину отмены")
  }
  if (!["HOLD", "REFUND"].includes(options.prepaymentAction)) {
    throw new Error("Некорректное действие по предоплате")
  }

  await db.$transaction(async (tx) => {
    // 1. LOCK CustomOrder.
    await tx.$queryRaw`SELECT id FROM "CustomOrder" WHERE id = ${orderId} FOR UPDATE`

    const order = await tx.customOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    })
    if (!order) throw new Error("Заказ не найден")

    await requirePermission("orders.manage", order.storeId)

    // FK-safe userId (см. completeOrder).
    const sessionUser = await tx.user.findUnique({
      where: { id: session.user!.id },
      select: { id: true },
    })
    const userId = sessionUser?.id ?? order.sellerId

    // 2. Transition validation.
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Нельзя отменить из ${order.status}`)
    }

    const prepaid = toMoney(order.prepaidAmount)

    if (options.prepaymentAction === "HOLD") {
      // FIN-06: HOLD — удерживаем предоплату.
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancellationType: "HOLD",
          cancelReason: options.reason,
        },
      })
    } else {
      // FIN-05: REFUND — compensating entries.
      if (prepaid.gt(0)) {
        const openShift = await tx.shift.findFirst({
          where: { storeId: order.storeId, status: "OPEN" },
          select: { id: true },
        })
        if (!openShift) {
          throw new Error("Для возврата предоплаты откройте смену")
        }

        const originalPayments = order.payments.filter((p) => !p.isExpense)
        for (const p of originalPayments) {
          await tx.payment.create({
            data: {
              order: { connect: { id: order.id } },
              method: p.method,
              amount: p.amount.toString(),
              isExpense: true,
              shift: { connect: { id: openShift.id } },
            },
          })
          if (p.method === "CASH") {
            await tx.cashOperation.create({
              data: {
                shift: { connect: { id: openShift.id } },
                type: "WITHDRAW",
                amount: p.amount.toString(),
                reason: `Возврат предоплаты по заказу ${order.number}`,
                performedBy: { connect: { id: userId } },
              },
            })
          }
        }
      }

      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancellationType: "REFUND",
          prepaidAmount: "0",
          cancelReason: options.reason,
        },
      })
    }

    // 3. Delete SupplierDebt если был (заказ отменён — долг не актуален).
    // SupplierPayments cascade-deleted via onDelete: Cascade on FK.
    // CashOperations remain for audit trail (SupplierPayment.cashOperationId has onDelete: SetNull).
    const debt = await tx.supplierDebt.findFirst({
      where: { orderId },
      include: { payments: { select: { id: true } } },
    })
    if (debt) {
      await tx.supplierDebt.delete({ where: { id: debt.id } })
    }

    // 4. Return linked SerialUnits back to IN_STOCK (не было completion → stock не списан).
    const items = await tx.customOrderItem.findMany({
      where: { orderId, serialUnitId: { not: null } },
    })
    for (const item of items) {
      if (item.serialUnitId) {
        await tx.serialUnit.update({
          where: { id: item.serialUnitId },
          data: { status: "IN_STOCK" },
        })
      }
    }

    // 5. OrderStatusHistory.
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "CANCELLED",
        comment: options.reason,
        userId,
      },
    })
  })

  revalidatePath("/orders")
  return { success: true }
}
