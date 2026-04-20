"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { getNextNumber } from "@/lib/counters"
import { warrantyClaimCreateSchema, warrantyClaimUpdateSchema } from "@/lib/validations/warranty"

export async function getWarrantyClaims(
  storeId: string,
  opts: {
    type?: string
    status?: string
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("warranty.view", storeId)

  const page = opts.page ?? 1
  const perPage = opts.perPage ?? 25

  const where: Record<string, unknown> = { storeId }

  if (opts.type && opts.type !== "ALL") {
    where.type = opts.type
  }

  if (opts.status && opts.status !== "ALL") {
    where.status = opts.status
  }

  const [claims, total] = await Promise.all([
    db.warrantyClaim.findMany({
      where,
      include: {
        serialUnit: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
        repair: { select: { number: true, deviceModel: true } },
        deviceRecord: { select: { imei: true, model: true } },
        customer: { select: { name: true, phone: true } },
        store: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.warrantyClaim.count({ where }),
  ])

  return {
    claims: claims.map((c) => ({
      id: c.id,
      number: c.number,
      type: c.type,
      status: c.status,
      description: c.description,
      resolution: c.resolution,
      deviceName:
        c.serialUnit?.product?.name ?? c.repair?.deviceModel ?? c.deviceRecord?.model ?? null,
      imei: c.serialUnit?.imei ?? c.deviceRecord?.imei ?? null,
      repairNumber: c.repair?.number ?? null,
      customerName: c.customer?.name ?? null,
      customerPhone: c.customer?.phone ?? null,
      storeName: c.store.name,
      createdByName: `${c.createdBy.firstName} ${c.createdBy.lastName}`,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function createWarrantyClaim(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const parsed = warrantyClaimCreateSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(firstError?.message ?? "Ошибка валидации")
  }

  const d = parsed.data
  await requirePermission("warranty.create", d.storeId)

  let customerId = d.customerId ?? null

  if (d.type === "SALE_WARRANTY" && d.serialUnitId) {
    const unit = await db.serialUnit.findUnique({
      where: { id: d.serialUnitId },
      include: {
        history: {
          where: { event: "SOLD" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })
    if (!unit) throw new Error("Серийный номер не найден")
    if (unit.status !== "SOLD") throw new Error("Устройство не находится в статусе SOLD")

    const soldDate = unit.history[0]?.createdAt
    if (soldDate) {
      const warrantyEnd = new Date(soldDate.getTime() + unit.warrantyDays * 86400000)
      if (warrantyEnd < new Date()) {
        throw new Error("Гарантийный срок истёк")
      }
    }
  }

  if (d.type === "REPAIR_WARRANTY" && d.repairId) {
    const repair = await db.repair.findUnique({
      where: { id: d.repairId },
      select: {
        warrantyUntil: true,
        clientPhone: true,
      },
    })
    if (!repair) throw new Error("Ремонт не найден")
    if (repair.warrantyUntil && repair.warrantyUntil < new Date()) {
      throw new Error("Гарантийный срок по ремонту истёк")
    }

    // Auto-find customer from repair.clientPhone if no customerId provided
    if (!customerId && repair.clientPhone) {
      const customer = await db.customer.findFirst({
        where: { phone: repair.clientPhone },
        select: { id: true },
      })
      if (customer) customerId = customer.id
    }
  }

  // DATA-02: Wrap in transaction so getNextNumber uses atomic counter
  const claim = await db.$transaction(async (tx) => {
    const number = await getNextNumber("WC", tx)

    return tx.warrantyClaim.create({
      data: {
        number,
        type: d.type,
        storeId: d.storeId,
        serialUnitId: d.serialUnitId ?? null,
        repairId: d.repairId ?? null,
        deviceRecordId: d.deviceRecordId ?? null,
        customerId,
        description: d.description.trim(),
        createdById: session.user.id,
      },
    })
  })

  return { id: claim.id, number: claim.number }
}

export async function updateWarrantyClaimStatus(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const parsed = warrantyClaimUpdateSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(firstError?.message ?? "Ошибка валидации")
  }

  const d = parsed.data

  const claim = await db.warrantyClaim.findUnique({
    where: { id: d.id },
    select: { storeId: true, status: true },
  })
  if (!claim) throw new Error("Обращение не найдено")

  const terminalStatuses = ["RESOLVED", "REJECTED"]
  if (terminalStatuses.includes(claim.status)) {
    throw new Error("Нельзя изменить статус закрытого обращения")
  }

  await requirePermission("warranty.manage", claim.storeId)

  const updateData: Record<string, unknown> = { status: d.status }

  if (d.resolution !== undefined) {
    updateData.resolution = d.resolution ?? null
  }

  if (d.status === "RESOLVED" || d.status === "REJECTED") {
    updateData.resolvedAt = new Date()
  }

  await db.warrantyClaim.update({
    where: { id: d.id },
    data: updateData,
  })

  return { success: true }
}

export async function getWarrantyClaim(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const claimMeta = await db.warrantyClaim.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!claimMeta) throw new Error("Обращение не найдено")

  await requirePermission("warranty.view", claimMeta.storeId)

  const claim = await db.warrantyClaim.findUnique({
    where: { id },
    include: {
      serialUnit: {
        include: {
          product: { select: { name: true, sku: true } },
          history: {
            include: {
              performedBy: { select: { firstName: true, lastName: true } },
              store: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      repair: {
        select: {
          id: true,
          number: true,
          deviceModel: true,
          deviceBrand: true,
          warrantyUntil: true,
          clientName: true,
          clientPhone: true,
        },
      },
      deviceRecord: {
        select: { id: true, imei: true, model: true, brand: true, deviceType: true },
      },
      customer: { select: { id: true, name: true, phone: true } },
      store: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!claim) throw new Error("Обращение не найдено")

  return {
    id: claim.id,
    number: claim.number,
    type: claim.type,
    status: claim.status,
    storeId: claim.storeId,
    storeName: claim.store.name,
    description: claim.description,
    resolution: claim.resolution,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    resolvedAt: claim.resolvedAt?.toISOString() ?? null,
    createdByName: `${claim.createdBy.firstName} ${claim.createdBy.lastName}`,
    customer: claim.customer
      ? {
          id: claim.customer.id,
          name: claim.customer.name,
          phone: claim.customer.phone,
        }
      : null,
    serialUnit: claim.serialUnit
      ? {
          id: claim.serialUnit.id,
          imei: claim.serialUnit.imei,
          imei2: claim.serialUnit.imei2 ?? null,
          serialNumber: claim.serialUnit.serialNumber ?? null,
          productName: claim.serialUnit.product.name,
          productSku: claim.serialUnit.product.sku,
          warrantyDays: claim.serialUnit.warrantyDays,
          history: claim.serialUnit.history.map((h) => ({
            id: h.id,
            event: h.event,
            storeName: h.store.name,
            performedByName: `${h.performedBy.firstName} ${h.performedBy.lastName}`,
            relatedDocument: h.relatedDocument,
            comment: h.comment,
            createdAt: h.createdAt.toISOString(),
          })),
        }
      : null,
    repair: claim.repair
      ? {
          id: claim.repair.id,
          number: claim.repair.number,
          deviceModel: claim.repair.deviceModel,
          deviceBrand: claim.repair.deviceBrand,
          warrantyUntil: claim.repair.warrantyUntil?.toISOString() ?? null,
          clientName: claim.repair.clientName,
          clientPhone: claim.repair.clientPhone,
        }
      : null,
    deviceRecord: claim.deviceRecord
      ? {
          id: claim.deviceRecord.id,
          imei: claim.deviceRecord.imei,
          model: claim.deviceRecord.model,
          brand: claim.deviceRecord.brand,
          deviceType: claim.deviceRecord.deviceType,
        }
      : null,
  }
}

export async function lookupForWarrantyClaim(storeId: string, imei: string) {
  await requirePermission("warranty.create", storeId)

  const trimmedImei = imei.trim()
  if (!trimmedImei) return { type: "not_found" as const }

  // Search SerialUnit (SOLD status)
  const unit = await db.serialUnit.findFirst({
    where: {
      OR: [{ imei: trimmedImei }, { imei2: trimmedImei }, { serialNumber: trimmedImei }],
      status: { in: ["SOLD", "IN_STOCK"] },
    },
    include: {
      product: { select: { name: true, sku: true } },
      history: {
        where: { event: "SOLD" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      deviceRecord: { select: { id: true } },
    },
  })

  if (unit) {
    const soldDate = unit.history[0]?.createdAt
    const warrantyEnd = soldDate
      ? new Date(soldDate.getTime() + unit.warrantyDays * 86400000)
      : null
    return {
      type: "SALE_WARRANTY" as const,
      serialUnitId: unit.id,
      deviceRecordId: unit.deviceRecord?.id ?? null,
      productName: unit.product.name,
      productSku: unit.product.sku,
      imei: unit.imei,
      soldDate: soldDate?.toISOString() ?? null,
      warrantyEnd: warrantyEnd?.toISOString() ?? null,
      isUnderWarranty: warrantyEnd ? warrantyEnd > new Date() : false,
    }
  }

  // Search repairs by device serial
  const repair = await db.repair.findFirst({
    where: {
      deviceSerial: trimmedImei,
      status: "DELIVERED",
      warrantyUntil: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      deviceModel: true,
      deviceBrand: true,
      warrantyUntil: true,
      deviceRecordId: true,
    },
  })

  if (repair) {
    return {
      type: "REPAIR_WARRANTY" as const,
      repairId: repair.id,
      repairNumber: repair.number,
      deviceModel: repair.deviceModel,
      deviceBrand: repair.deviceBrand,
      deviceRecordId: repair.deviceRecordId,
      warrantyEnd: repair.warrantyUntil?.toISOString() ?? null,
      isUnderWarranty: true,
    }
  }

  // Search by Sale number (REPAIR-09)
  const saleByNumber = await db.sale.findFirst({
    where: {
      number: trimmedImei,
      status: "COMPLETED",
    },
    include: {
      items: {
        include: {
          serialUnit: {
            select: {
              id: true,
              imei: true,
              warrantyDays: true,
              product: { select: { name: true, sku: true } },
              deviceRecord: { select: { id: true } },
            },
          },
        },
        take: 1,
      },
    },
  })

  if (saleByNumber) {
    const itemWithSerial = saleByNumber.items.find((i) => i.serialUnit)
    if (itemWithSerial?.serialUnit) {
      const su = itemWithSerial.serialUnit
      const warrantyEnd = new Date(saleByNumber.createdAt.getTime() + su.warrantyDays * 86400000)
      return {
        type: "SALE_WARRANTY" as const,
        serialUnitId: su.id,
        deviceRecordId: su.deviceRecord?.id ?? null,
        productName: su.product.name,
        productSku: su.product.sku,
        imei: su.imei,
        soldDate: saleByNumber.createdAt.toISOString(),
        warrantyEnd: warrantyEnd.toISOString(),
        isUnderWarranty: warrantyEnd > new Date(),
      }
    }

    // Non-serial sale (e.g., repair sale) -- return basic info
    return {
      type: "SALE_WARRANTY" as const,
      serialUnitId: null as string | null,
      deviceRecordId: null as string | null,
      productName: saleByNumber.items[0]?.name ?? "Unknown",
      productSku: null as string | null,
      imei: null as string | null,
      soldDate: saleByNumber.createdAt.toISOString(),
      warrantyEnd: null as string | null,
      isUnderWarranty: false,
    }
  }

  return { type: "not_found" as const }
}
