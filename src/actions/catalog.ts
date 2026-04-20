"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { productSchema, categorySchema, brandSchema } from "@/lib/validations/catalog"
import type { ProductFormData, CategoryFormData, BrandFormData } from "@/lib/validations/catalog"
import { getSerializedCounts } from "@/lib/stock-helpers"

// ---- Products ----

export async function getProducts(
  storeId: string,
  params: {
    search?: string
    categoryId?: string
    brandId?: string
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("catalog.view", storeId)
  const canSeePrices = await checkPermission("catalog.prices", storeId)

  const { search, categoryId, brandId, page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = { isActive: true }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ]
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (brandId) {
    where.brandId = brandId
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, isSerialized: true } },
        brand: { select: { id: true, name: true } },
        storeProducts: {
          where: { storeId },
          select: {
            quantity: true,
            minQty: true,
            sellPrice: true,
            costPrice: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    db.product.count({ where }),
  ])

  const serializedProductIds = products.filter((p) => p.category.isSerialized).map((p) => p.id)
  const serialCounts = await getSerializedCounts(storeId, serializedProductIds)

  const serialized = products.map((p) => {
    const sp = p.storeProducts[0]
    const isSerialized = p.category.isSerialized
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      brandId: p.brandId,
      brandName: p.brand?.name ?? null,
      description: p.description,
      unit: p.unit,
      isActive: p.isActive,
      isSerialized,
      quantity: isSerialized ? (serialCounts[p.id] ?? 0) : (sp?.quantity ?? 0),
      minQty: sp?.minQty ?? 0,
      sellPrice: sp ? Number(sp.sellPrice) : 0,
      costPrice: canSeePrices && sp ? Number(sp.costPrice) : null,
    }
  })

  return {
    products: serialized,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function getProduct(productId: string, storeId: string) {
  await requirePermission("catalog.view", storeId)
  const canSeePrices = await checkPermission("catalog.prices", storeId)

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, name: true, isSerialized: true } },
      brand: { select: { id: true, name: true } },
      storeProducts: {
        where: { storeId },
        select: {
          quantity: true,
          minQty: true,
          sellPrice: true,
          costPrice: true,
        },
      },
    },
  })

  if (!product) {
    throw new Error("Товар не найден")
  }

  const sp = product.storeProducts[0]
  const isSerialized = product.category.isSerialized
  let quantity = sp?.quantity ?? 0
  if (isSerialized) {
    const counts = await getSerializedCounts(storeId, [product.id])
    quantity = counts[product.id] ?? 0
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    description: product.description,
    unit: product.unit,
    isActive: product.isActive,
    isSerialized,
    quantity,
    minQty: sp?.minQty ?? 0,
    sellPrice: sp ? Number(sp.sellPrice) : 0,
    costPrice: canSeePrices && sp ? Number(sp.costPrice) : null,
  }
}

export async function createProduct(storeId: string, data: ProductFormData) {
  await requirePermission("catalog.edit", storeId)

  const validated = productSchema.parse(data)

  const product = await db.product.create({
    data: {
      name: validated.name,
      sku: validated.sku,
      barcode: validated.barcode || null,
      categoryId: validated.categoryId,
      brandId: validated.brandId || null,
      description: validated.description || null,
      unit: validated.unit,
      storeProducts: {
        create: {
          storeId,
          sellPrice: validated.sellPrice,
          costPrice: validated.costPrice,
          minQty: validated.minQty,
        },
      },
    },
  })

  revalidatePath("/dashboard/catalog")
  return { id: product.id }
}

export async function updateProduct(productId: string, storeId: string, data: ProductFormData) {
  await requirePermission("catalog.edit", storeId)
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = productSchema.parse(data)

  // Get current store product for price comparison
  const currentSp = await db.storeProduct.findUnique({
    where: { storeId_productId: { storeId, productId } },
  })

  // Update product
  await db.product.update({
    where: { id: productId },
    data: {
      name: validated.name,
      sku: validated.sku,
      barcode: validated.barcode || null,
      categoryId: validated.categoryId,
      brandId: validated.brandId || null,
      description: validated.description || null,
      unit: validated.unit,
    },
  })

  // Upsert store product
  await db.storeProduct.upsert({
    where: { storeId_productId: { storeId, productId } },
    create: {
      storeId,
      productId,
      sellPrice: validated.sellPrice,
      costPrice: validated.costPrice,
      minQty: validated.minQty,
    },
    update: {
      sellPrice: validated.sellPrice,
      costPrice: validated.costPrice,
      minQty: validated.minQty,
    },
  })

  // Track price changes
  if (currentSp) {
    const oldSell = Number(currentSp.sellPrice)
    const oldCost = Number(currentSp.costPrice)

    if (oldSell !== validated.sellPrice) {
      await db.priceHistory.create({
        data: {
          productId,
          storeId,
          field: "sellPrice",
          oldPrice: oldSell,
          newPrice: validated.sellPrice,
          changedBy: session.user.id,
        },
      })
    }

    if (oldCost !== validated.costPrice) {
      await db.priceHistory.create({
        data: {
          productId,
          storeId,
          field: "costPrice",
          oldPrice: oldCost,
          newPrice: validated.costPrice,
          changedBy: session.user.id,
        },
      })
    }
  }

  revalidatePath("/dashboard/catalog")
  return { id: productId }
}

export async function deleteProduct(productId: string) {
  await requirePermission("catalog.delete")

  await db.product.update({
    where: { id: productId },
    data: { isActive: false },
  })

  revalidatePath("/dashboard/catalog")
  return { success: true }
}

// ---- Categories ----

export async function getCategories() {
  const categories = await db.category.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    productCount: c._count.products,
    isSerialized: c.isSerialized,
    identifierType: c.identifierType,
  }))
}

export async function createCategory(data: CategoryFormData) {
  await requirePermission("catalog.edit")

  const validated = categorySchema.parse(data)

  const category = await db.category.create({
    data: {
      name: validated.name,
      parentId: validated.parentId || null,
      isSerialized: validated.isSerialized,
      identifierType: validated.identifierType ?? null,
    },
  })

  revalidatePath("/dashboard/catalog")
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    isSerialized: category.isSerialized,
    identifierType: category.identifierType,
  }
}

export async function updateCategory(id: string, data: CategoryFormData) {
  await requirePermission("catalog.edit")

  const validated = categorySchema.parse(data)

  // Prevent setting parent to self
  if (validated.parentId === id) {
    throw new Error("Категория не может быть родителем самой себя")
  }

  const current = await db.category.findUnique({
    where: { id },
    select: { isSerialized: true, name: true },
  })

  const isSerializedChanged = validated.isSerialized !== current?.isSerialized
  let forcedOverride = false
  let affectedSerialUnits = 0

  // Prevent enabling serialization on a category that already has stock
  if (validated.isSerialized && !current?.isSerialized) {
    const stockCount = await db.storeProduct.count({
      where: {
        product: { categoryId: id },
        quantity: { gt: 0 },
      },
    })
    if (stockCount > 0 && !validated.forceOverride) {
      throw new Error(
        `CATEGORY_HAS_STOCK: Нельзя включить сериализацию (есть ${stockCount} товаров с остатками)`,
      )
    }
    if (stockCount > 0 && validated.forceOverride) {
      forcedOverride = true
      affectedSerialUnits = stockCount
    }
  }

  // Prevent disabling serialization when serial units exist
  if (!validated.isSerialized && current?.isSerialized) {
    const serialCount = await db.serialUnit.count({
      where: { product: { categoryId: id } },
    })
    if (serialCount > 0 && !validated.forceOverride) {
      throw new Error(
        `CATEGORY_HAS_SERIAL_UNITS: Нельзя отключить сериализацию (есть ${serialCount} серийных единиц)`,
      )
    }
    if (serialCount > 0 && validated.forceOverride) {
      forcedOverride = true
      affectedSerialUnits = serialCount
    }
  }

  // INV-01: admin force override requires explicit reason + permission + AuditLog trail.
  if (forcedOverride) {
    // Admin-only permission; requirePermission throws if insufficient.
    await requirePermission("settings.stores")
    if (!validated.forceReason || validated.forceReason.trim().length === 0) {
      throw new Error("FORCE_REASON_REQUIRED: Укажите причину принудительной смены")
    }
  }

  const category = await db.category.update({
    where: { id },
    data: {
      name: validated.name,
      parentId: validated.parentId || null,
      isSerialized: validated.isSerialized,
      identifierType: validated.identifierType ?? null,
    },
  })

  if (forcedOverride && isSerializedChanged) {
    const session = await auth()
    if (session?.user?.id) {
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Category",
          entityId: id,
          metadata: {
            type: "CATEGORY_ISSERIALIZED_FORCE_CHANGE",
            oldValue: current?.isSerialized ?? null,
            newValue: validated.isSerialized,
            reason: validated.forceReason,
            affectedSerialUnits,
            categoryName: current?.name ?? validated.name,
          },
          changes: {
            isSerialized: {
              old: current?.isSerialized ?? null,
              new: validated.isSerialized,
            },
          },
        },
      })
    }
  }

  revalidatePath("/dashboard/catalog")
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    isSerialized: category.isSerialized,
    identifierType: category.identifierType,
  }
}

/**
 * INV-01: UI helper for category-form to query blocking counts.
 * Returns existing SerialUnit count + StoreProduct-with-stock count for a category.
 */
export async function getCategorySerialCount(categoryId: string) {
  await requirePermission("catalog.edit")
  const [serialCount, stockCount] = await Promise.all([
    db.serialUnit.count({ where: { product: { categoryId } } }),
    db.storeProduct.count({
      where: { product: { categoryId }, quantity: { gt: 0 } },
    }),
  ])
  return { serialCount, stockCount }
}

export async function deleteCategory(id: string) {
  await requirePermission("catalog.edit")

  // Check if category has products
  const count = await db.product.count({ where: { categoryId: id } })
  if (count > 0) {
    throw new Error("Невозможно удалить категорию с товарами")
  }

  // Check if category has children
  const children = await db.category.count({ where: { parentId: id } })
  if (children > 0) {
    throw new Error("Невозможно удалить категорию с подкатегориями")
  }

  await db.category.delete({ where: { id } })

  revalidatePath("/dashboard/catalog")
  return { success: true }
}

// ---- Brands ----

export async function getBrands() {
  const brands = await db.brand.findMany({
    orderBy: { name: "asc" },
  })

  return brands.map((b) => ({
    id: b.id,
    name: b.name,
  }))
}

export async function createBrand(data: BrandFormData) {
  await requirePermission("catalog.edit")

  const validated = brandSchema.parse(data)

  const brand = await db.brand.create({
    data: { name: validated.name },
  })

  revalidatePath("/dashboard/catalog")
  return { id: brand.id, name: brand.name }
}
