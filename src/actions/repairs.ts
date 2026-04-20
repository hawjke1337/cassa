"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { findOrCreateDeviceRecordTx } from "@/actions/device-records"
import type { PaymentMethod, RepairStatus } from "@/generated/prisma/client"
import { Prisma } from "@/generated/prisma/client"
import { sum, mul, toMoney } from "@/lib/money"
import { assertCostNotFrozen } from "@/lib/repair-guards"
import { normalizePhoneOrThrow } from "@/lib/phone-utils"
import { validateImeiOrThrow } from "@/lib/imei-utils"

export async function lookupDeviceByImei(storeId: string, imei: string) {
  await requirePermission("repairs.create", storeId)

  if (!imei.trim()) return { type: "none" as const }

  // 1. Check SerialUnit (our sold device)
  const serialUnit = await db.serialUnit.findFirst({
    where: {
      OR: [{ imei }, { imei2: imei }, { serialNumber: imei }],
      status: "SOLD",
    },
    include: {
      product: { select: { name: true, sku: true } },
      saleItem: {
        include: {
          sale: { select: { number: true, createdAt: true } },
        },
      },
    },
  })

  if (serialUnit) {
    const saleDate = serialUnit.saleItem?.sale?.createdAt
    const warrantyEnd = saleDate
      ? new Date(saleDate.getTime() + serialUnit.warrantyDays * 86400000)
      : null
    const isUnderWarranty = warrantyEnd ? warrantyEnd > new Date() : false

    return {
      type: "serialUnit" as const,
      serialUnitId: serialUnit.id,
      productName: serialUnit.product.name,
      saleNumber: serialUnit.saleItem?.sale?.number ?? null,
      saleDate: saleDate?.toISOString() ?? null,
      warrantyUntil: warrantyEnd?.toISOString() ?? null,
      isUnderWarranty,
    }
  }

  // 2. Check DeviceRecord (previously seen device)
  const deviceRecord = await db.deviceRecord.findFirst({
    where: {
      OR: [{ imei }, { imei2: imei }, { serialNumber: imei }],
    },
    include: {
      repairs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { number: true, createdAt: true },
      },
    },
  })

  if (deviceRecord) {
    const lastRepair = deviceRecord.repairs[0]
    return {
      type: "deviceRecord" as const,
      deviceRecordId: deviceRecord.id,
      deviceType: deviceRecord.deviceType,
      brand: deviceRecord.brand,
      model: deviceRecord.model,
      lastRepairNumber: lastRepair?.number ?? null,
      lastRepairDate: lastRepair?.createdAt?.toISOString() ?? null,
    }
  }

  // 3. Nothing found
  return { type: "new" as const }
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["WAITING_APPROVAL", "CANCELLED"],
  WAITING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
}

export async function getRepairs(
  storeId: string,
  opts: {
    search?: string
    status?: string
    masterId?: string
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("repairs.view", storeId)

  const page = opts.page ?? 1
  const perPage = opts.perPage ?? 25

  const where: any = { storeId }

  if (opts.status && opts.status !== "ALL") {
    if (opts.status === "ACTIVE") {
      where.status = {
        in: ["RECEIVED", "DIAGNOSING", "WAITING_APPROVAL", "APPROVED", "IN_PROGRESS"],
      }
    } else if (opts.status === "READY") {
      where.status = { in: ["COMPLETED", "READY_FOR_PICKUP"] }
    } else if (opts.status === "DONE") {
      where.status = { in: ["DELIVERED", "CANCELLED"] }
    } else {
      where.status = opts.status as RepairStatus
    }
  }

  if (opts.masterId) {
    where.masterId = opts.masterId
  }

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim()
    where.OR = [
      { number: { contains: s, mode: "insensitive" } },
      { clientName: { contains: s, mode: "insensitive" } },
      { clientPhone: { contains: s, mode: "insensitive" } },
      { deviceType: { contains: s, mode: "insensitive" } },
      { deviceSerial: { contains: s, mode: "insensitive" } },
    ]
  }

  const [repairs, total] = await Promise.all([
    db.repair.findMany({
      where,
      include: {
        master: { select: { firstName: true, lastName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.repair.count({ where }),
  ])

  return {
    repairs: repairs.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      deviceType: r.deviceType,
      deviceBrand: r.deviceBrand,
      deviceModel: r.deviceModel,
      masterName: r.master ? `${r.master.firstName} ${r.master.lastName}` : null,
      createdByName: `${r.createdBy.firstName} ${r.createdBy.lastName}`,
      estimatedCost: r.estimatedCost ? r.estimatedCost.toNumber() : null,
      agreedCost: r.agreedCost ? r.agreedCost.toNumber() : null,
      finalCost: r.finalCost ? r.finalCost.toNumber() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    perPage,
  }
}

export async function getRepair(repairId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Minimal fetch for permission check (Fix 3: check before full fetch)
  const repairMeta = await db.repair.findUnique({
    where: { id: repairId },
    select: { storeId: true },
  })
  if (!repairMeta) throw new Error("Ремонт не найден")

  await requirePermission("repairs.view", repairMeta.storeId)
  // Fix 2: only expose devicePassword to users who can manage repairs
  const canManage = await checkPermission("repairs.manage", repairMeta.storeId)

  // Full fetch after permission check
  const repair = await db.repair.findUnique({
    where: { id: repairId },
    include: {
      store: { select: { id: true, name: true } },
      master: { select: { firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      payments: { orderBy: { createdAt: "asc" } },
      statusHistory: {
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      warrantyClaims: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!repair) throw new Error("Ремонт не найден")

  // Precision-safe через Decimal helpers.
  const totalPaid = sum(...repair.payments.map((p) => toMoney(p.amount))).toNumber()

  return {
    id: repair.id,
    number: repair.number,
    status: repair.status,
    storeId: repair.storeId,
    storeName: repair.store.name,
    masterId: repair.masterId,
    masterName: repair.master ? `${repair.master.firstName} ${repair.master.lastName}` : null,
    createdById: repair.createdById,
    createdByName: `${repair.createdBy.firstName} ${repair.createdBy.lastName}`,
    clientName: repair.clientName,
    clientPhone: repair.clientPhone,
    deviceType: repair.deviceType,
    deviceBrand: repair.deviceBrand,
    deviceModel: repair.deviceModel,
    deviceSerial: repair.deviceSerial,
    deviceCondition: repair.deviceCondition,
    devicePassword: canManage ? repair.devicePassword : null,
    defectDescription: repair.defectDescription,
    diagnosis: repair.diagnosis,
    workDone: repair.workDone,
    estimatedCost: repair.estimatedCost ? repair.estimatedCost.toNumber() : null,
    agreedCost: repair.agreedCost ? repair.agreedCost.toNumber() : null,
    finalCost: repair.finalCost ? repair.finalCost.toNumber() : null,
    warrantyDays: repair.warrantyDays,
    warrantyUntil: repair.warrantyUntil?.toISOString() ?? null,
    comment: repair.comment,
    createdAt: repair.createdAt.toISOString(),
    updatedAt: repair.updatedAt.toISOString(),
    completedAt: repair.completedAt?.toISOString() ?? null,
    totalPaid,
    payments: repair.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toNumber(),
      createdAt: p.createdAt.toISOString(),
    })),
    statusHistory: repair.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      comment: h.comment,
      changedByName: `${h.changedBy.firstName} ${h.changedBy.lastName}`,
      createdAt: h.createdAt.toISOString(),
    })),
    warrantyClaims: repair.warrantyClaims.map((c) => ({
      id: c.id,
      description: c.description,
      resolution: c.resolution,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    })),
  }
}

export async function createRepair(data: {
  storeId: string
  clientName: string
  clientPhone: string
  deviceType: string
  deviceBrand?: string
  deviceModel?: string
  deviceSerial?: string
  deviceCondition: string
  devicePassword?: string
  defectDescription: string
  masterId?: string
  estimatedCost?: number
  warrantyDays?: number
  comment?: string
  deviceRecordId?: string
  serialUnitId?: string
}) {
  await requirePermission("repairs.create", data.storeId)

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!data.clientName.trim()) throw new Error("Укажите имя клиента")
  if (!data.clientPhone.trim()) throw new Error("Укажите телефон клиента")
  if (!data.deviceType.trim()) throw new Error("Укажите тип устройства")
  if (!data.deviceCondition.trim()) throw new Error("Укажите состояние устройства")
  if (!data.defectDescription.trim()) throw new Error("Укажите описание неисправности")

  // DATA2-05: Normalize phone before storage
  data.clientPhone = normalizePhoneOrThrow(data.clientPhone.trim(), "Телефон клиента")

  // DATA2-08: Validate IMEI if provided (deviceSerial may be IMEI)
  if (data.deviceSerial && /^\d{15}$/.test(data.deviceSerial.replace(/\s/g, ""))) {
    data.deviceSerial = validateImeiOrThrow(data.deviceSerial, "IMEI устройства")
  }

  const repair = await db.$transaction(async (tx) => {
    // DATA-02: Generate number INSIDE transaction
    const number = await getNextNumber("REP", tx)
    let deviceRecordId = data.deviceRecordId || null
    const serialUnitId = data.serialUnitId || null

    // If we have a serial/IMEI but no existing device record, create one
    if (data.deviceSerial && !deviceRecordId && !serialUnitId) {
      deviceRecordId = await findOrCreateDeviceRecordTx(tx, {
        imei: data.deviceSerial,
        deviceType: data.deviceType,
        brand: data.deviceBrand || undefined,
        model: data.deviceModel || undefined,
      })
    }

    return tx.repair.create({
      data: {
        number,
        storeId: data.storeId,
        createdById: session.user.id,
        masterId: data.masterId || null,
        clientName: data.clientName.trim(),
        clientPhone: data.clientPhone.trim(),
        deviceType: data.deviceType.trim(),
        deviceBrand: data.deviceBrand?.trim() || null,
        deviceModel: data.deviceModel?.trim() || null,
        deviceSerial: data.deviceSerial?.trim() || null,
        deviceCondition: data.deviceCondition.trim(),
        devicePassword: data.devicePassword?.trim() || null,
        defectDescription: data.defectDescription.trim(),
        estimatedCost: data.estimatedCost ?? null,
        warrantyDays: data.warrantyDays ?? 30,
        comment: data.comment?.trim() || null,
        deviceRecordId,
        serialUnitId,
        statusHistory: {
          create: {
            status: "RECEIVED",
            comment: "Устройство принято",
            userId: session.user.id,
          },
        },
      },
    })
  })

  return { id: repair.id, number: repair.number }
}

export async function updateRepairStatus(
  repairId: string,
  newStatus: RepairStatus,
  comment?: string,
  extraData?: {
    masterId?: string
    diagnosis?: string
    agreedCost?: number
    finalCost?: number
    workDone?: string
    estimatedCost?: number
  },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // Minimal fetch outside transaction — only for permission check
  const repairForPerm = await db.repair.findUnique({
    where: { id: repairId },
    select: { storeId: true },
  })
  if (!repairForPerm) throw new Error("Ремонт не найден")

  await requirePermission("repairs.manage", repairForPerm.storeId)

  await db.$transaction(async (tx) => {
    // Re-fetch inside transaction to avoid TOCTOU race on status
    const repair = await tx.repair.findUnique({ where: { id: repairId } })
    if (!repair) throw new Error("Ремонт не найден")

    // Validate transition atomically
    const allowed = VALID_TRANSITIONS[repair.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new Error(`Нельзя сменить статус с "${repair.status}" на "${newStatus}"`)
    }

    const updateData: any = { status: newStatus }

    if (extraData?.masterId !== undefined) updateData.masterId = extraData.masterId
    if (extraData?.diagnosis !== undefined) updateData.diagnosis = extraData.diagnosis
    if (extraData?.agreedCost !== undefined) updateData.agreedCost = extraData.agreedCost
    if (extraData?.estimatedCost !== undefined) updateData.estimatedCost = extraData.estimatedCost
    if (extraData?.workDone !== undefined) updateData.workDone = extraData.workDone

    // REPAIR-06: Cost freeze guard for extraData cost fields
    const costFieldsInExtra = ["estimatedCost", "agreedCost", "finalCost"] as const
    const hasCostChangeInExtra = costFieldsInExtra.some((f) => extraData?.[f] !== undefined)
    if (hasCostChangeInExtra) {
      assertCostNotFrozen(repair.status)
    }

    if (newStatus === "COMPLETED") {
      updateData.completedAt = new Date()
      updateData.finalCost =
        extraData?.finalCost !== undefined ? extraData.finalCost : (repair.agreedCost ?? null)
    }

    if (newStatus === "DELIVERED") {
      const warrantyDays = repair.warrantyDays ?? 30
      const warrantyUntil = new Date()
      warrantyUntil.setDate(warrantyUntil.getDate() + warrantyDays)
      updateData.warrantyUntil = warrantyUntil

      // --- REPAIR-01: Create Sale on DELIVERED ---
      const openShift = await tx.shift.findFirst({
        where: { storeId: repair.storeId, status: "OPEN" },
        select: { id: true },
      })
      if (!openShift) throw new Error("Откройте кассовую смену")

      const finalCost = repair.finalCost ?? repair.agreedCost ?? repair.estimatedCost
      if (!finalCost || finalCost.lte(new Prisma.Decimal(0))) {
        throw new Error("Укажите итоговую стоимость ремонта")
      }

      // FK-safe userId: session.user.id может не существовать в test DB
      const sessionUser = await tx.user.findUnique({
        where: { id: session.user!.id },
        select: { id: true },
      })
      const sellerId = sessionUser?.id ?? repair.createdById

      const saleNumber = await getNextNumber("S", tx)

      const sale = await tx.sale.create({
        data: {
          number: saleNumber,
          storeId: repair.storeId,
          sellerId,
          type: "REPAIR",
          status: "COMPLETED",
          totalAmount: finalCost,
          discountAmount: 0,
          finalAmount: finalCost,
          shiftId: openShift.id,
        },
      })

      updateData.saleId = sale.id

      // --- REPAIR-04: Create SaleItems from RepairParts for COGS ---
      const parts = await tx.repairPart.findMany({ where: { repairId } })
      const partsCogs =
        parts.length > 0 ? sum(...parts.map((p) => mul(p.costPrice, p.quantity))) : toMoney("0")

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: null,
          name: `Ремонт: ${repair.deviceType}${repair.deviceModel ? " " + repair.deviceModel : ""}`,
          quantity: 1,
          price: finalCost,
          costPrice: partsCogs,
          discount: 0,
          total: finalCost,
        },
      })

      // --- REPAIR-01: Re-parent payments from repair to sale ---
      await tx.payment.updateMany({
        where: { repairId: repairId },
        data: { saleId: sale.id, repairId: null },
      })
    }

    // --- REPAIR-01: CANCELLED restores spare parts stock ---
    if (newStatus === "CANCELLED") {
      const parts = await tx.repairPart.findMany({ where: { repairId } })
      for (const part of parts) {
        await tx.storeProduct.updateMany({
          where: { storeId: part.storeId, productId: part.productId },
          data: { quantity: { increment: part.quantity } },
        })
      }
    }

    if (extraData?.finalCost !== undefined && newStatus !== "COMPLETED") {
      updateData.finalCost = extraData.finalCost
    }

    // REPAIR-05: Record cost history for cost fields changed via extraData
    for (const field of ["estimatedCost", "agreedCost", "finalCost"] as const) {
      const newVal = field === "finalCost" ? updateData.finalCost : extraData?.[field]
      if (newVal !== undefined) {
        const oldVal = repair[field]
        if (oldVal?.toString() !== newVal?.toString()) {
          await tx.repairCostHistory.create({
            data: {
              repairId,
              field,
              oldValue: oldVal ?? null,
              newValue: newVal ?? null,
              userId: session.user!.id,
            },
          })
        }
      }
    }

    await tx.repair.update({
      where: { id: repairId },
      data: updateData,
    })

    await tx.repairStatusHistory.create({
      data: {
        repairId,
        status: newStatus,
        comment: comment?.trim() || null,
        userId: session.user!.id,
      },
    })
  })

  return { success: true }
}

export async function updateRepair(
  repairId: string,
  data: {
    masterId?: string | null
    diagnosis?: string
    estimatedCost?: number | null
    agreedCost?: number | null
    workDone?: string
    warrantyDays?: number
    comment?: string
  },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const repair = await db.repair.findUnique({
    where: { id: repairId },
  })
  if (!repair) throw new Error("Ремонт не найден")

  await requirePermission("repairs.manage", repair.storeId)

  // REPAIR-06: Cost freeze guard
  const costFields = ["estimatedCost", "agreedCost"] as const
  const hasCostChange = costFields.some((f) => data[f] !== undefined)
  if (hasCostChange) {
    assertCostNotFrozen(repair.status)
  }

  const updateData: any = {}

  if (data.masterId !== undefined) updateData.masterId = data.masterId
  if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis.trim() || null
  if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost
  if (data.agreedCost !== undefined) updateData.agreedCost = data.agreedCost
  if (data.workDone !== undefined) updateData.workDone = data.workDone.trim() || null
  if (data.warrantyDays !== undefined) updateData.warrantyDays = data.warrantyDays
  if (data.comment !== undefined) updateData.comment = data.comment.trim() || null

  // REPAIR-05: Record cost history atomically with update
  await db.$transaction(async (tx) => {
    for (const field of costFields) {
      if (data[field] !== undefined) {
        const oldVal = repair[field]
        const newVal = data[field]
        if (oldVal?.toString() !== newVal?.toString()) {
          await tx.repairCostHistory.create({
            data: {
              repairId,
              field,
              oldValue: oldVal ?? null,
              newValue: newVal ?? null,
              userId: session.user!.id,
            },
          })
        }
      }
    }
    await tx.repair.update({
      where: { id: repairId },
      data: updateData,
    })
  })

  return { success: true }
}

export async function addRepairPayment(
  repairId: string,
  data: { method: PaymentMethod; amount: number },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (data.amount <= 0) throw new Error("Сумма должна быть больше 0")

  const repair = await db.repair.findUnique({
    where: { id: repairId },
  })
  if (!repair) throw new Error("Ремонт не найден")

  await requirePermission("repairs.manage", repair.storeId)

  if (repair.status === "DELIVERED" || repair.status === "CANCELLED") {
    throw new Error("Нельзя добавить оплату к завершённому или отменённому ремонту")
  }

  const payment = await db.$transaction(async (tx) => {
    const openShift = await tx.shift.findFirst({
      where: { storeId: repair.storeId, status: "OPEN" },
      select: { id: true },
    })
    // BUILD-01 / FIN-11: Payment.shiftId теперь NOT NULL — каждый платёж обязан
    // быть привязан к открытой смене. Если смена закрыта — оплата невозможна
    // (бизнес-правило: касса должна быть открыта). Возвращаем явный trapped
    // error вместо попытки сохранить null (которая упала бы на DB constraint).
    if (!openShift) {
      throw new Error("Нет открытой смены в магазине — невозможно принять оплату ремонта")
    }
    return tx.payment.create({
      data: {
        repairId,
        method: data.method,
        amount: data.amount,
        shiftId: openShift.id,
      },
    })
  })

  return { success: true }
}

/**
 * REPAIR-03: Добавление запчасти к ремонту с декрементом StoreProduct.quantity.
 * Использует SELECT FOR UPDATE для предотвращения race condition.
 */
export async function addRepairPart(
  repairId: string,
  data: { productId: string; quantity: number },
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  if (data.quantity <= 0) throw new Error("Количество должно быть больше 0")

  const repair = await db.repair.findUnique({ where: { id: repairId } })
  if (!repair) throw new Error("Ремонт не найден")

  await requirePermission("repairs.manage", repair.storeId)

  if (
    repair.status === "COMPLETED" ||
    repair.status === "DELIVERED" ||
    repair.status === "CANCELLED"
  ) {
    throw new Error("Нельзя добавить запчасть к завершённому ремонту")
  }

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: number; costPrice: any }>>`
      SELECT id, quantity, "costPrice"
      FROM "StoreProduct"
      WHERE "storeId" = ${repair.storeId} AND "productId" = ${data.productId}
      FOR UPDATE
    `
    if (!locked.length) throw new Error("Товар не найден в магазине")
    const sp = locked[0]
    if (sp.quantity < data.quantity) throw new Error("Недостаточно запчастей")

    await tx.storeProduct.update({
      where: { id: sp.id },
      data: { quantity: { decrement: data.quantity } },
    })

    await tx.repairPart.create({
      data: {
        repairId,
        productId: data.productId,
        storeId: repair.storeId,
        quantity: data.quantity,
        costPrice: sp.costPrice,
      },
    })

    return { success: true }
  })
}

/**
 * REPAIR-03: Удаление запчасти из ремонта с восстановлением StoreProduct.quantity.
 */
export async function removeRepairPart(partId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const part = await db.repairPart.findUnique({
    where: { id: partId },
    include: { repair: { select: { storeId: true, status: true } } },
  })
  if (!part) throw new Error("Запчасть не найдена")

  await requirePermission("repairs.manage", part.repair.storeId)

  if (part.repair.status === "COMPLETED" || part.repair.status === "DELIVERED") {
    throw new Error("Нельзя удалить запчасть завершённого ремонта")
  }

  return db.$transaction(async (tx) => {
    await tx.storeProduct.updateMany({
      where: { storeId: part.storeId, productId: part.productId },
      data: { quantity: { increment: part.quantity } },
    })
    await tx.repairPart.delete({ where: { id: partId } })
    return { success: true }
  })
}

export async function getStoreMasters(storeId: string) {
  await requirePermission("repairs.view", storeId)

  const userStores = await db.userStore.findMany({
    where: { storeId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, isActive: true },
      },
    },
  })

  // BUILD-01: отбрасываем UserStore с удалённым user (onDelete: SetNull),
  // затем фильтруем только активных — удалённые/неактивные мастера не должны
  // попадать в список доступных для назначения на ремонт.
  return userStores
    .filter((us) => us.user !== null && us.user.isActive)
    .map((us) => ({
      id: us.user!.id,
      name: `${us.user!.firstName} ${us.user!.lastName}`,
    }))
}
