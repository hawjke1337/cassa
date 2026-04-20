"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document-templates"
import type { DocumentType } from "@/lib/validations/document-templates"
import { getSale } from "@/actions/sales"
import { getOrder } from "@/actions/orders"
import { getRepair } from "@/actions/repairs"
import { getTradeInContractData } from "@/actions/trade-in"
import { formatMoney } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/document-variables"

export async function getDocumentTemplates(storeId: string) {
  await requirePermission("settings.templates", storeId)

  const templates = await db.documentTemplate.findMany({
    where: { storeId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      isDefault: true,
      createdAt: true,
    },
  })

  return templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function getDocumentTemplate(id: string) {
  const template = await db.documentTemplate.findUnique({
    where: { id },
    include: { store: { select: { name: true } } },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  return {
    id: template.id,
    storeId: template.storeId,
    storeName: template.store.name,
    name: template.name,
    type: template.type,
    layout: template.layout,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
  }
}

export async function createDocumentTemplate(data: {
  storeId: string
  name: string
  type: string
  layout: unknown
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = createDocumentTemplateSchema.parse(data)
  await requirePermission("settings.templates", validated.storeId)

  const template = await db.documentTemplate.create({
    data: {
      storeId: validated.storeId,
      name: validated.name,
      type: validated.type,
      layout: validated.layout as object,
      createdById: session.user.id,
    },
  })

  return { id: template.id }
}

export async function updateDocumentTemplate(
  id: string,
  data: {
    name: string
    layout: unknown
  },
) {
  const template = await db.documentTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const validated = updateDocumentTemplateSchema.parse(data)

  await db.documentTemplate.update({
    where: { id },
    data: {
      name: validated.name,
      layout: validated.layout as object,
    },
  })

  return { success: true }
}

export async function deleteDocumentTemplate(id: string) {
  const template = await db.documentTemplate.findUnique({
    where: { id },
    select: { storeId: true, isDefault: true },
  })
  if (!template) throw new Error("Шаблон не найден")
  if (template.isDefault) throw new Error("Нельзя удалить шаблон по умолчанию")

  await requirePermission("settings.templates", template.storeId)

  await db.documentTemplate.delete({ where: { id } })

  return { success: true }
}

export async function duplicateDocumentTemplate(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const template = await db.documentTemplate.findUnique({
    where: { id },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const copy = await db.documentTemplate.create({
    data: {
      storeId: template.storeId,
      name: `Копия — ${template.name}`,
      type: template.type,
      layout: template.layout as object,
      isDefault: false,
      createdById: session.user.id,
    },
  })

  return { id: copy.id }
}

export async function setDefaultDocumentTemplate(id: string) {
  const template = await db.documentTemplate.findUnique({
    where: { id },
    select: { storeId: true, type: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  await db.$transaction(async (tx) => {
    await tx.documentTemplate.updateMany({
      where: { storeId: template.storeId, type: template.type, isDefault: true },
      data: { isDefault: false },
    })
    await tx.documentTemplate.update({
      where: { id },
      data: { isDefault: true },
    })
  })

  return { success: true }
}

export async function getDefaultTemplate(storeId: string, type: DocumentType) {
  const template = await db.documentTemplate.findFirst({
    where: { storeId, type, isDefault: true },
  })
  if (!template) throw new Error("Шаблон не найден")
  return template
}

export async function getDocumentData(type: DocumentType, entityId: string) {
  switch (type) {
    case "SALE_RECEIPT": {
      const sale = await getSale(entityId)
      const saleEntity = await db.sale.findUnique({
        where: { id: entityId },
        select: { storeId: true },
      })
      if (!saleEntity) throw new Error("Продажа не найдена")
      return {
        storeId: saleEntity.storeId,
        data: {
          storeName: sale.storeName,
          storeAddress: sale.storeAddress ?? "",
          storePhone: sale.storePhone ?? "",
          number: sale.number,
          date: sale.createdAt,
          sellerName: sale.sellerName,
          totalAmount: sale.totalAmount,
          discountAmount: sale.discountAmount,
          finalAmount: sale.finalAmount,
          paymentMethods: sale.payments
            .map((p) => `${PAYMENT_METHOD_LABELS[p.method] || p.method}: ${formatMoney(p.amount)}`)
            .join(", "),
        },
        items: sale.items.map((i) => ({
          productName: i.productName,
          productSku: i.productSku,
          imei: [i.imei, i.imei2, i.serialNumber].filter(Boolean).join(" / "),
          quantity: i.quantity,
          price: i.price,
          discount: i.discount,
          total: i.total,
        })),
      }
    }

    case "ORDER_FORM": {
      const order = await getOrder(entityId)
      return {
        storeId: order.storeId,
        data: {
          storeName: order.storeName,
          number: order.number,
          date: order.createdAt,
          sellerName: order.sellerName,
          clientName: order.clientName,
          clientPhone: order.clientPhone,
          clientEmail: order.clientEmail ?? "",
          totalAmount: order.totalAmount,
          prepaidAmount: order.prepaidAmount,
          remainingAmount: order.totalAmount - order.prepaidAmount,
          estimatedDays: order.estimatedDays ?? "",
        },
        items: order.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        })),
      }
    }

    case "RECEIVE_DOC": {
      const receive = await db.stockReceive.findUnique({
        where: { id: entityId },
        include: {
          store: { select: { name: true } },
          supplier: { select: { name: true } },
          receivedBy: { select: { firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      })
      if (!receive) throw new Error("Приходная накладная не найдена")
      await requirePermission("inventory.receive", receive.storeId)
      return {
        storeId: receive.storeId,
        data: {
          storeName: receive.store.name,
          supplierName: receive.supplier?.name ?? "",
          number: receive.number,
          date: receive.createdAt.toISOString(),
          receivedByName: `${receive.receivedBy.firstName} ${receive.receivedBy.lastName}`,
          totalAmount: Number(receive.totalAmount),
        },
        items: receive.items.map((i) => ({
          productName: i.product.name,
          quantity: i.quantity,
          costPrice: Number(i.costPrice),
          total: Number(i.costPrice) * i.quantity,
        })),
      }
    }

    case "WRITE_OFF_DOC": {
      const writeOff = await db.stockWriteOff.findUnique({
        where: { id: entityId },
        include: {
          store: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      })
      if (!writeOff) throw new Error("Акт списания не найден")
      await requirePermission("inventory.writeoff", writeOff.storeId)
      const items = writeOff.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        costPrice: Number(i.costPrice),
        total: Number(i.costPrice) * i.quantity,
      }))
      return {
        storeId: writeOff.storeId,
        data: {
          storeName: writeOff.store.name,
          number: writeOff.number,
          date: writeOff.createdAt.toISOString(),
          reason: writeOff.reason,
          createdByName: `${writeOff.createdBy.firstName} ${writeOff.createdBy.lastName}`,
          totalAmount: items.reduce((sum, i) => sum + i.total, 0),
        },
        items,
      }
    }

    case "REPAIR_RECEIPT": {
      const repair = await getRepair(entityId)
      return {
        storeId: repair.storeId,
        data: {
          storeName: repair.storeName,
          number: repair.number,
          date: repair.createdAt,
          createdByName: repair.createdByName,
          clientName: repair.clientName,
          clientPhone: repair.clientPhone,
          deviceInfo: [repair.deviceType, repair.deviceBrand, repair.deviceModel]
            .filter(Boolean)
            .join(" "),
          deviceSerial: repair.deviceSerial ?? "",
          deviceCondition: repair.deviceCondition,
          defectDescription: repair.defectDescription,
          estimatedCost: repair.estimatedCost ?? "",
        },
        items: [],
      }
    }

    case "REPAIR_DELIVERY": {
      const repair = await getRepair(entityId)
      const totalPaid = repair.totalPaid
      const remaining = (repair.finalCost ?? 0) - totalPaid
      return {
        storeId: repair.storeId,
        data: {
          storeName: repair.storeName,
          number: repair.number,
          date: repair.createdAt,
          completedDate: repair.completedAt ?? "",
          clientName: repair.clientName,
          clientPhone: repair.clientPhone,
          deviceInfo: [repair.deviceType, repair.deviceBrand, repair.deviceModel]
            .filter(Boolean)
            .join(" "),
          deviceSerial: repair.deviceSerial ?? "",
          workDone: repair.workDone ?? "",
          finalCost: repair.finalCost ?? "",
          totalPaid,
          remainingAmount: remaining > 0 ? remaining : "",
          warrantyDays: repair.warrantyDays ?? "",
          warrantyUntil: repair.warrantyUntil ?? "",
        },
        items: [],
      }
    }

    case "TRADE_IN_CONTRACT": {
      const ti = await getTradeInContractData(entityId)
      return {
        storeId: ti.storeId,
        data: {
          storeName: ti.storeName,
          storeAddress: ti.storeAddress ?? "",
          storePhone: ti.storePhone ?? "",
          number: ti.number,
          date: ti.createdAt,
          sellerName: ti.acceptedByName,
          clientName: ti.customerName,
          clientPhone: ti.customerPhone,
          clientPassportSeries: ti.passportSeries ?? "",
          clientPassportNumber: ti.passportNumber ?? "",
          clientPassportIssuedBy: ti.passportIssuedBy ?? "",
          clientPassportIssuedAt: ti.passportIssuedAt ?? "",
          deviceType: ti.deviceType,
          deviceBrand: ti.deviceBrand ?? "",
          deviceModel: ti.deviceModel ?? "",
          deviceImei: ti.deviceImei ?? "",
          deviceCondition: ti.deviceCondition,
          agreedPrice: Number(ti.agreedPrice),
          dealType: ti.type === "TRADE_IN" ? "Трейд-ин (зачёт в покупку)" : "Выкуп",
        },
        items: [],
      }
    }

    case "RETURN_ACT": {
      const ret = await db.return.findUnique({
        where: { id: entityId },
        include: {
          sale: {
            include: {
              store: { select: { name: true, address: true, phone: true } },
            },
          },
          processedBy: { select: { firstName: true, lastName: true } },
          items: {
            include: {
              saleItem: {
                include: {
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      })
      if (!ret) throw new Error("Возврат не найден")
      await requirePermission("pos.return", ret.sale.storeId)
      return {
        storeId: ret.sale.storeId,
        data: {
          storeName: ret.sale.store.name,
          storeAddress: ret.sale.store.address ?? "",
          storePhone: ret.sale.store.phone ?? "",
          returnNumber: ret.number,
          returnDate: ret.createdAt.toISOString(),
          saleNumber: ret.sale.number,
          reason: ret.reason,
          refundMethod: ret.refundMethod
            ? PAYMENT_METHOD_LABELS[ret.refundMethod] || ret.refundMethod
            : "",
          totalAmount: Number(ret.amount),
          sellerName: `${ret.processedBy.firstName} ${ret.processedBy.lastName}`,
        },
        items: ret.items.map((ri) => ({
          productName: ri.saleItem.product?.name ?? "",
          quantity: ri.quantity,
          price: Number(ri.saleItem.price),
          total: +(
            (Number(ri.saleItem.price) - Number(ri.saleItem.discount)) *
            ri.quantity
          ).toFixed(2),
        })),
      }
    }

    default:
      throw new Error(`Неизвестный тип документа: ${type}`)
  }
}

export async function seedDefaultDocumentTemplates(storeId: string, createdById: string) {
  const { getDefaultLayouts } = await import("@/lib/default-document-templates")
  const defaultLayouts = getDefaultLayouts()

  for (const docType of DOCUMENT_TYPES) {
    const existing = await db.documentTemplate.findFirst({
      where: { storeId, type: docType as DocumentType, isDefault: true },
    })
    if (!existing) {
      await db.documentTemplate.create({
        data: {
          storeId,
          name: DOCUMENT_TYPE_LABELS[docType],
          type: docType as DocumentType,
          layout: defaultLayouts[docType] as object,
          isDefault: true,
          createdById,
        },
      })
    }
  }
}
