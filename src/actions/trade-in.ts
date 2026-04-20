"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { createTradeInSchema } from "@/lib/validations/trade-in"
import { findOrCreateDeviceRecordTx } from "@/actions/device-records"
import type { TradeInStatus, TradeInType, PaymentMethod } from "@/generated/prisma/client"
import { isValidImei } from "@/lib/imei-utils"
import { mskStartOfDay, mskEndOfDay } from "@/lib/timezone"

// ---- Valid status transitions ----

const VALID_TRANSITIONS: Record<string, TradeInStatus[]> = {
  PENDING: ["IN_STOCK", "IN_REPAIR", "WRITTEN_OFF"],
  IN_STOCK: ["SOLD", "WRITTEN_OFF"],
  IN_REPAIR: ["IN_STOCK", "WRITTEN_OFF"],
  SOLD: ["WRITTEN_OFF"],
}

// ---- List ----

interface GetTradeInsFilters {
  type?: TradeInType
  status?: TradeInStatus
  dateFrom?: string
  dateTo?: string
}

export async function getTradeIns(storeId: string, filters: GetTradeInsFilters = {}) {
  await requirePermission("tradein.view", storeId)

  const where: Record<string, unknown> = { storeId }

  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: mskStartOfDay(new Date(filters.dateFrom)) } : {}),
      ...(filters.dateTo ? { lte: mskEndOfDay(new Date(filters.dateTo)) } : {}),
    }
  }

  const tradeIns = await db.tradeIn.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      acceptedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return tradeIns.map((ti) => ({
    id: ti.id,
    number: ti.number,
    type: ti.type,
    status: ti.status,
    customerName: ti.customer.name,
    customerPhone: ti.customer.phone,
    customerId: ti.customer.id,
    deviceType: ti.deviceType,
    deviceBrand: ti.deviceBrand,
    deviceModel: ti.deviceModel,
    agreedPrice: Number(ti.agreedPrice),
    acceptedBy: `${ti.acceptedBy.lastName} ${ti.acceptedBy.firstName}`,
    createdAt: ti.createdAt.toISOString(),
  }))
}

// ---- Detail ----

export async function getTradeIn(id: string) {
  const tiForPerm = await db.tradeIn.findUnique({ where: { id }, select: { storeId: true } })
  if (!tiForPerm) throw new Error("Запись трейд-ина не найдена")
  await requirePermission("tradein.view", tiForPerm.storeId)

  const ti = await db.tradeIn.findUnique({
    where: { id },
    include: {
      customer: true,
      store: { select: { id: true, name: true, address: true, phone: true } },
      acceptedBy: { select: { firstName: true, lastName: true } },
      sale: { select: { id: true, number: true } },
      product: { select: { id: true, name: true, sku: true } },
      repair: { select: { id: true, number: true, status: true } },
      payout: { select: { id: true, method: true, amount: true } },
    },
  })

  if (!ti) throw new Error("Запись трейд-ина не найдена")

  return {
    id: ti.id,
    number: ti.number,
    type: ti.type,
    status: ti.status,
    storeId: ti.storeId,
    storeName: ti.store.name,
    acceptedBy: `${ti.acceptedBy.lastName} ${ti.acceptedBy.firstName}`,
    customer: {
      id: ti.customer.id,
      name: ti.customer.name,
      phone: ti.customer.phone,
      passportSeries: ti.customer.passportSeries,
      passportNumber: ti.customer.passportNumber,
      passportIssuedBy: ti.customer.passportIssuedBy,
      passportIssuedAt: ti.customer.passportIssuedAt?.toISOString() ?? null,
    },
    deviceType: ti.deviceType,
    deviceBrand: ti.deviceBrand,
    deviceModel: ti.deviceModel,
    deviceImei: ti.deviceImei,
    deviceCondition: ti.deviceCondition,
    estimatedPrice: Number(ti.estimatedPrice),
    agreedPrice: Number(ti.agreedPrice),
    sale: ti.sale ? { id: ti.sale.id, number: ti.sale.number } : null,
    product: ti.product ? { id: ti.product.id, name: ti.product.name, sku: ti.product.sku } : null,
    repair: ti.repair
      ? { id: ti.repair.id, number: ti.repair.number, status: ti.repair.status }
      : null,
    payout: ti.payout ? { method: ti.payout.method, amount: Number(ti.payout.amount) } : null,
    comment: ti.comment,
    createdAt: ti.createdAt.toISOString(),
  }
}

// ---- Create ----

export async function createTradeIn(data: unknown) {
  const parsed = createTradeInSchema.parse(data)
  await requirePermission("tradein.accept", parsed.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // INV-06: Trade-in deviceImei — универсальное поле для любого серийника
  // (может быть IMEI телефона или SN аксессуара). Форма не знает identifierType
  // категории (товара ещё нет), поэтому применяем "мягкую" валидацию:
  // - 15-значное число → проверяем Luhn (иначе ошибка)
  // - любое другое непустое значение → принимаем как SN
  if (parsed.deviceImei && parsed.deviceImei.trim()) {
    const trimmed = parsed.deviceImei.trim()
    if (/^\d{15}$/.test(trimmed) && !isValidImei(trimmed)) {
      throw new Error(
        `Невалидный IMEI: ${trimmed}. 15-значный номер должен пройти проверку Luhn. Если это серийный номер (не IMEI), введите его в другом формате.`,
      )
    }
    parsed.deviceImei = trimmed
  }

  // Validate customer exists
  const customer = await db.customer.findUnique({ where: { id: parsed.customerId } })
  if (!customer) throw new Error("Клиент не найден")

  const result = await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction
    const number = await getNextNumber("TI", tx)
    // Lookup open shift for linking payments
    const openShift = await tx.shift.findFirst({
      where: { storeId: parsed.storeId, status: "OPEN" },
      select: { id: true },
    })

    let payoutId: string | undefined

    // INV-07: если agreedPrice === 0, выплата не создаётся (бесплатный приём).
    // Иначе для BUYBACK создаём Payment(isExpense=true).
    const isFreePickup = parsed.agreedPrice === 0

    if (parsed.type === "BUYBACK" && !isFreePickup) {
      if (!parsed.paymentMethod) throw new Error("Укажите способ выплаты")
      // BUILD-01 / FIN-11: Payment.shiftId NOT NULL — выплата возможна только
      // при открытой смене магазина. Если смена закрыта — бизнес-правило
      // запрещает выплату (операция должна пройти через кассу).
      if (!openShift) {
        throw new Error("Нет открытой смены в магазине — невозможно выплатить по trade-in")
      }
      const payment = await tx.payment.create({
        data: {
          method: parsed.paymentMethod as PaymentMethod,
          amount: parsed.agreedPrice,
          isExpense: true,
          storeId: parsed.storeId,
          shiftId: openShift.id,
        },
      })
      payoutId = payment.id
    }

    // INV-09: initialStatus выбирается оператором (PENDING по умолчанию, IN_STOCK если готов).
    // estimatedPrice делаем fallback на agreedPrice (UX2-11: одно поле).
    const effectiveEstimatedPrice = parsed.estimatedPrice ?? parsed.agreedPrice

    // Create trade-in record
    const tradeIn = await tx.tradeIn.create({
      data: {
        number,
        type: parsed.type,
        status: parsed.initialStatus,
        storeId: parsed.storeId,
        acceptedById: session.user!.id,
        customerId: parsed.customerId,
        deviceType: parsed.deviceType,
        deviceBrand: parsed.deviceBrand || null,
        deviceModel: parsed.deviceModel || null,
        deviceImei: parsed.deviceImei || null,
        deviceCondition: parsed.deviceCondition,
        estimatedPrice: effectiveEstimatedPrice,
        agreedPrice: parsed.agreedPrice,
        comment: parsed.comment || null,
        payoutId: payoutId || null,
      },
    })

    return tradeIn
  })

  return { id: result.id, number: result.number }
}

// ---- Status transitions ----

export async function updateTradeInStatus(id: string, newStatus: TradeInStatus) {
  const ti = await db.tradeIn.findUnique({ where: { id } })
  if (!ti) throw new Error("Запись не найдена")
  await requirePermission("tradein.manage", ti.storeId)

  const allowed = VALID_TRANSITIONS[ti.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Нельзя перевести из "${ti.status}" в "${newStatus}"`)
  }

  await db.tradeIn.update({
    where: { id },
    data: { status: newStatus },
  })
}

// ---- Link to Sale ----

export async function linkTradeInToSale(id: string, saleNumber: string) {
  const ti = await db.tradeIn.findUnique({ where: { id } })
  if (!ti) throw new Error("Запись трейд-ина не найдена")
  await requirePermission("tradein.manage", ti.storeId)

  const sale = await db.sale.findUnique({ where: { number: saleNumber } })
  if (!sale) throw new Error(`Продажа №${saleNumber} не найдена`)
  if (ti.type !== "TRADE_IN") throw new Error("Привязка к продаже доступна только для трейд-ин")
  if (ti.saleId) throw new Error("Трейд-ин уже привязан к продаже")

  await db.$transaction(async (tx) => {
    // Link trade-in to sale
    await tx.tradeIn.update({
      where: { id },
      data: { saleId: sale.id },
    })

    // Add trade-in value to sale discount
    const newDiscount = Number(sale.discountAmount) + Number(ti.agreedPrice)
    const newFinal = Number(sale.totalAmount) - newDiscount

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        discountAmount: newDiscount,
        finalAmount: Math.max(0, newFinal),
      },
    })
  })
}

// ---- Create Product from trade-in ----

export async function createProductFromTradeIn(
  id: string,
  productData: { categoryId: string; sellPrice: number },
) {
  const ti = await db.tradeIn.findUnique({ where: { id } })
  if (!ti) throw new Error("Запись не найдена")
  await requirePermission("tradein.manage", ti.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  if (ti.status !== "PENDING")
    throw new Error("Создание товара возможно только из статуса «Ожидает»")
  if (ti.productId) throw new Error("Товар уже создан для этого трейд-ина")

  const productName = `б/у ${[ti.deviceBrand, ti.deviceModel].filter(Boolean).join(" ") || ti.deviceType}`
  const sku = `BU-${ti.number}`

  const result = await db.$transaction(async (tx) => {
    // Check if category is serialized before creating product (affects description)
    const category = await tx.category.findUnique({
      where: { id: productData.categoryId },
      select: { isSerialized: true, identifierType: true },
    })

    if (!category) throw new Error("Категория не найдена")

    const isSerialized = category.isSerialized && !!ti.deviceImei

    const product = await tx.product.create({
      data: {
        name: productName,
        sku,
        categoryId: productData.categoryId,
        description: isSerialized
          ? `Состояние: ${ti.deviceCondition}`
          : `Состояние: ${ti.deviceCondition}${ti.deviceImei ? `. IMEI: ${ti.deviceImei}` : ""}`,
      },
    })

    // Create store product with price
    // For serialized products, quantity is tracked per SerialUnit, not StoreProduct
    await tx.storeProduct.create({
      data: {
        storeId: ti.storeId,
        productId: product.id,
        quantity: isSerialized ? 0 : 1,
        costPrice: ti.agreedPrice,
        sellPrice: productData.sellPrice,
      },
    })

    // For serialized categories with IMEI, create SerialUnit and DeviceRecord
    let deviceRecordId: string | null = null
    if (isSerialized) {
      const existing = await tx.serialUnit.findFirst({ where: { imei: ti.deviceImei } })
      if (existing) throw new Error(`Серийная единица с IMEI ${ti.deviceImei} уже существует`)

      deviceRecordId = await findOrCreateDeviceRecordTx(tx, {
        imei: ti.deviceImei!,
        deviceType: ti.deviceType,
        brand: ti.deviceBrand || undefined,
        model: ti.deviceModel || undefined,
        customerId: ti.customerId,
      })

      const unit = await tx.serialUnit.create({
        data: {
          productId: product.id,
          storeId: ti.storeId,
          imei: ti.deviceImei,
          status: "IN_STOCK",
          costPrice: ti.agreedPrice,
          deviceRecordId,
        },
      })

      await tx.serialUnitHistory.create({
        data: {
          serialUnitId: unit.id,
          event: "RECEIVED",
          storeId: ti.storeId,
          performedById: session.user!.id,
          relatedDocument: ti.number,
          relatedDocType: "TRADE_IN",
        },
      })
    }

    // Link product, update status, and set deviceRecordId in a single update
    await tx.tradeIn.update({
      where: { id },
      data: { productId: product.id, status: "IN_STOCK", deviceRecordId },
    })

    return product
  })

  return { id: result.id, name: result.name, sku: result.sku }
}

// ---- Send to repair ----

export async function sendTradeInToRepair(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const ti = await db.tradeIn.findUnique({
    where: { id },
    include: { customer: true },
  })
  if (!ti) throw new Error("Запись не найдена")
  await requirePermission("tradein.manage", ti.storeId)
  if (ti.repairId) throw new Error("Ремонт уже создан для этого трейд-ина")
  if (ti.status !== "PENDING")
    throw new Error("Отправка на ремонт возможна только из статуса «Ожидает»")

  const result = await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction
    const repairNumber = await getNextNumber("REP", tx)

    const repair = await tx.repair.create({
      data: {
        number: repairNumber,
        storeId: ti.storeId,
        createdById: session.user!.id,
        clientName: ti.customer.name,
        clientPhone: ti.customer.phone,
        deviceType: ti.deviceType,
        deviceBrand: ti.deviceBrand,
        deviceModel: ti.deviceModel,
        deviceSerial: ti.deviceImei,
        deviceCondition: ti.deviceCondition,
        defectDescription: "Трейд-ин: требуется диагностика/ремонт перед продажей",
      },
    })

    await tx.tradeIn.update({
      where: { id },
      data: { repairId: repair.id, status: "IN_REPAIR" },
    })

    return repair
  })

  return { id: result.id, number: result.number }
}

// ---- Delete ----

export async function deleteTradeIn(id: string) {
  const ti = await db.tradeIn.findUnique({ where: { id } })
  if (!ti) throw new Error("Запись не найдена")
  await requirePermission("tradein.delete", ti.storeId)

  const DELETABLE_STATUSES: TradeInStatus[] = ["PENDING", "WRITTEN_OFF"]
  if (!DELETABLE_STATUSES.includes(ti.status)) {
    throw new Error(`Невозможно удалить trade-in в статусе ${ti.status}`)
  }

  await db.$transaction(async (tx) => {
    // Unlink payout before deleting (FK constraint)
    if (ti.payoutId) {
      await tx.tradeIn.update({ where: { id }, data: { payoutId: null } })
      await tx.payment.delete({ where: { id: ti.payoutId } })
    }
    await tx.tradeIn.delete({ where: { id } })
  })
}

// ---- Contract data for PDF ----

export async function getTradeInContractData(id: string) {
  const tiForPerm = await db.tradeIn.findUnique({ where: { id }, select: { storeId: true } })
  if (!tiForPerm) throw new Error("Запись не найдена")
  await requirePermission("tradein.view", tiForPerm.storeId)

  const ti = await db.tradeIn.findUnique({
    where: { id },
    include: {
      store: { select: { name: true, address: true, phone: true } },
      acceptedBy: { select: { firstName: true, lastName: true } },
      customer: true,
    },
  })

  if (!ti) throw new Error("Запись не найдена")

  return {
    storeId: ti.storeId,
    storeName: ti.store.name,
    storeAddress: ti.store.address,
    storePhone: ti.store.phone,
    number: ti.number,
    type: ti.type,
    acceptedByName: `${ti.acceptedBy.lastName} ${ti.acceptedBy.firstName}`,
    customerName: ti.customer.name,
    customerPhone: ti.customer.phone,
    passportSeries: ti.customer.passportSeries,
    passportNumber: ti.customer.passportNumber,
    passportIssuedBy: ti.customer.passportIssuedBy,
    passportIssuedAt: ti.customer.passportIssuedAt?.toISOString() ?? null,
    deviceType: ti.deviceType,
    deviceBrand: ti.deviceBrand,
    deviceModel: ti.deviceModel,
    deviceImei: ti.deviceImei,
    deviceCondition: ti.deviceCondition,
    agreedPrice: Number(ti.agreedPrice),
    createdAt: ti.createdAt.toISOString(),
  }
}
