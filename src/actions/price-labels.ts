"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { createTemplateSchema, updateTemplateSchema } from "@/lib/validations/price-labels"
import type { PrintProductData } from "@/lib/validations/price-labels"

export async function getTemplates(storeId: string) {
  await requirePermission("settings.templates", storeId)

  const templates = await db.priceLabelTemplate.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      isDefault: true,
      createdAt: true,
    },
  })

  return templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function getTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
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
    width: template.width,
    height: template.height,
    layout: template.layout,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
  }
}

export async function createTemplate(data: {
  storeId: string
  name: string
  layout: unknown
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = createTemplateSchema.parse(data)
  await requirePermission("settings.templates", validated.storeId)

  const template = await db.priceLabelTemplate.create({
    data: {
      storeId: validated.storeId,
      name: validated.name,
      width: validated.layout.width,
      height: validated.layout.height,
      layout: validated.layout as object,
      createdById: session.user.id,
    },
  })

  return { id: template.id }
}

export async function updateTemplate(id: string, data: {
  name: string
  layout: unknown
}) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const validated = updateTemplateSchema.parse(data)

  await db.priceLabelTemplate.update({
    where: { id },
    data: {
      name: validated.name,
      width: validated.layout.width,
      height: validated.layout.height,
      layout: validated.layout as object,
    },
  })

  return { success: true }
}

export async function deleteTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  await db.priceLabelTemplate.delete({ where: { id } })

  return { success: true }
}

export async function duplicateTemplate(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const copy = await db.priceLabelTemplate.create({
    data: {
      storeId: template.storeId,
      name: `Копия — ${template.name}`,
      width: template.width,
      height: template.height,
      layout: template.layout as object,
      isDefault: false,
      createdById: session.user.id,
    },
  })

  return { id: copy.id }
}

export async function setDefaultTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  await db.$transaction(async (tx) => {
    await tx.priceLabelTemplate.updateMany({
      where: { storeId: template.storeId, isDefault: true },
      data: { isDefault: false },
    })
    await tx.priceLabelTemplate.update({
      where: { id },
      data: { isDefault: true },
    })
  })

  return { success: true }
}

export async function getProductsForPrint(
  storeId: string,
  productIds: string[]
): Promise<PrintProductData[]> {
  await requirePermission("catalog.view", storeId)

  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      storeProducts: {
        where: { storeId },
        select: { sellPrice: true },
      },
    },
  })

  const priceHistories = await db.priceHistory.findMany({
    where: {
      productId: { in: productIds },
      storeId,
      field: "sellPrice",
    },
    orderBy: { changedAt: "desc" },
    distinct: ["productId"],
    select: {
      productId: true,
      oldPrice: true,
    },
  })

  const oldPriceMap = new Map(
    priceHistories.map((ph) => [ph.productId, Number(ph.oldPrice)])
  )

  return products.map((p) => {
    const sp = p.storeProducts[0]
    const sellPrice = sp ? Number(sp.sellPrice) : 0
    const oldPrice = oldPriceMap.get(p.id) ?? null

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      sellPrice,
      oldPrice: oldPrice !== null && oldPrice !== sellPrice ? oldPrice : null,
    }
  })
}

export async function getTemplatesForPrint(storeId: string) {
  await requirePermission("catalog.view", storeId)

  return db.priceLabelTemplate.findMany({
    where: { storeId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      isDefault: true,
    },
  })
}
