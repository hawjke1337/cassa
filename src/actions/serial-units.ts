"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { writeSerialHistory } from "@/lib/serial-history"
import { serialUnitUpdateImeiSchema, imeiSearchSchema } from "@/lib/validations/serial"
import type { SerialUnitStatus } from "@/generated/prisma/client"

export async function searchByImei(query: string) {
  await requirePermission("serial.search")

  const validated = imeiSearchSchema.parse({ query })
  const q = validated.query.trim()

  const [serialUnit, deviceRecord] = await Promise.all([
    db.serialUnit.findFirst({
      where: {
        OR: [
          { imei: q },
          { imei2: q },
          { serialNumber: q },
        ],
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
        store: {
          select: { id: true, name: true },
        },
        history: {
          orderBy: { createdAt: "desc" },
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
            store: { select: { name: true } },
          },
        },
        saleItem: {
          select: {
            id: true,
            sale: {
              select: { id: true, number: true, createdAt: true },
            },
          },
        },
        warrantyClaims: {
          select: { id: true, number: true, status: true },
        },
      },
    }),
    db.deviceRecord.findFirst({
      where: {
        OR: [
          { imei: q },
          { imei2: q },
          { serialNumber: q },
        ],
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        repairs: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        tradeIns: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ])

  return {
    serialUnit: serialUnit
      ? {
          id: serialUnit.id,
          productId: serialUnit.productId,
          productName: serialUnit.product.name,
          productSku: serialUnit.product.sku,
          storeId: serialUnit.storeId,
          storeName: serialUnit.store.name,
          imei: serialUnit.imei,
          imei2: serialUnit.imei2,
          serialNumber: serialUnit.serialNumber,
          status: serialUnit.status,
          costPrice: Number(serialUnit.costPrice),
          warrantyDays: serialUnit.warrantyDays,
          createdAt: serialUnit.createdAt.toISOString(),
          sale: serialUnit.saleItem
            ? {
                saleId: serialUnit.saleItem.sale.id,
                saleNumber: serialUnit.saleItem.sale.number,
                saleDate: serialUnit.saleItem.sale.createdAt.toISOString(),
              }
            : null,
          warrantyClaims: serialUnit.warrantyClaims.map((wc) => ({
            id: wc.id,
            number: wc.number,
            status: wc.status,
          })),
          history: serialUnit.history.map((h) => ({
            id: h.id,
            event: h.event,
            storeName: h.store.name,
            performedBy: `${h.performedBy.firstName} ${h.performedBy.lastName}`,
            relatedDocument: h.relatedDocument,
            relatedDocType: h.relatedDocType,
            comment: h.comment,
            createdAt: h.createdAt.toISOString(),
          })),
        }
      : null,
    deviceRecord: deviceRecord
      ? {
          id: deviceRecord.id,
          imei: deviceRecord.imei,
          imei2: deviceRecord.imei2,
          serialNumber: deviceRecord.serialNumber,
          deviceType: deviceRecord.deviceType,
          brand: deviceRecord.brand,
          model: deviceRecord.model,
          customer: deviceRecord.customer
            ? {
                id: deviceRecord.customer.id,
                name: deviceRecord.customer.name,
                phone: deviceRecord.customer.phone,
              }
            : null,
          repairs: deviceRecord.repairs.map((r) => ({
            id: r.id,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          })),
          tradeIns: deviceRecord.tradeIns.map((t) => ({
            id: t.id,
            status: t.status,
            createdAt: t.createdAt.toISOString(),
          })),
          createdAt: deviceRecord.createdAt.toISOString(),
        }
      : null,
  }
}

export async function getSerialUnitsForProduct(
  storeId: string,
  productId: string,
  status?: SerialUnitStatus
) {
  await requirePermission("serial.view", storeId)

  const units = await db.serialUnit.findMany({
    where: {
      storeId,
      productId,
      ...(status ? { status } : {}),
    },
    include: {
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return units.map((u) => ({
    id: u.id,
    imei: u.imei,
    imei2: u.imei2,
    serialNumber: u.serialNumber,
    status: u.status,
    costPrice: Number(u.costPrice),
    warrantyDays: u.warrantyDays,
    productName: u.product.name,
    productSku: u.product.sku,
    createdAt: u.createdAt.toISOString(),
  }))
}

export async function countSerialUnits(storeId: string, productId: string) {
  return db.serialUnit.count({
    where: { storeId, productId, status: "IN_STOCK" },
  })
}

export async function correctSerialImei(
  id: string,
  data: { imei?: string | null; imei2?: string | null; serialNumber?: string | null }
) {
  await requirePermission("serial.edit")

  const validated = serialUnitUpdateImeiSchema.parse({ id, ...data })

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const result = await db.$transaction(async (tx) => {
    const unit = await tx.serialUnit.findUnique({
      where: { id: validated.id },
    })

    if (!unit) throw new Error("Серийная единица не найдена")
    if (unit.status !== "IN_STOCK") {
      throw new Error("Редактирование IMEI/SN возможно только для единиц со статусом В НАЛИЧИИ")
    }

    const updated = await tx.serialUnit.update({
      where: { id: validated.id },
      data: {
        imei: validated.imei ?? null,
        imei2: validated.imei2 ?? null,
        serialNumber: validated.serialNumber ?? null,
      },
    })

    await writeSerialHistory(tx, {
      serialUnitId: validated.id,
      event: "IMEI_CORRECTED",
      storeId: unit.storeId,
      performedById: session.user!.id,
      comment: `IMEI: ${unit.imei ?? "—"} → ${validated.imei ?? "—"}, IMEI2: ${unit.imei2 ?? "—"} → ${validated.imei2 ?? "—"}, SN: ${unit.serialNumber ?? "—"} → ${validated.serialNumber ?? "—"}`,
    })

    return updated
  })

  return {
    id: result.id,
    imei: result.imei,
    imei2: result.imei2,
    serialNumber: result.serialNumber,
    status: result.status,
  }
}
