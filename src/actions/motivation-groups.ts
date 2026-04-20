"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { motivationGroupSchema } from "@/lib/validations/motivation"

export async function getMotivationGroups() {
  await requirePermission("motivation.groups.manage")

  const groups = await db.motivationGroup.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  })

  return groups.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    description: g.description,
    productCount: g._count.products,
    createdAt: g.createdAt.toISOString(),
  }))
}

export async function getMotivationGroup(id: string) {
  await requirePermission("motivation.groups.manage")

  const group = await db.motivationGroup.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })

  if (!group) throw new Error("Мотивационная группа не найдена")

  return {
    id: group.id,
    code: group.code,
    name: group.name,
    description: group.description,
    products: group.products.map((p) => ({
      id: p.product.id,
      name: p.product.name,
      sku: p.product.sku,
      categoryName: p.product.category.name,
    })),
  }
}

export async function createMotivationGroup(data: unknown) {
  await requirePermission("motivation.groups.manage")

  const validated = motivationGroupSchema.parse(data)

  const existing = await db.motivationGroup.findUnique({
    where: { code: validated.code },
  })
  if (existing) throw new Error("Группа с таким кодом уже существует")

  const group = await db.motivationGroup.create({
    data: validated,
  })

  return { id: group.id }
}

export async function updateMotivationGroup(id: string, data: unknown) {
  await requirePermission("motivation.groups.manage")

  const validated = motivationGroupSchema.parse(data)

  const existing = await db.motivationGroup.findFirst({
    where: { code: validated.code, id: { not: id } },
  })
  if (existing) throw new Error("Группа с таким кодом уже существует")

  await db.motivationGroup.update({
    where: { id },
    data: validated,
  })
}

export async function deleteMotivationGroup(id: string) {
  await requirePermission("motivation.groups.manage")

  await db.motivationGroup.delete({ where: { id } })
}

export async function addProductsToGroup(groupId: string, productIds: string[]) {
  await requirePermission("motivation.groups.manage")

  // Check for products already in other groups
  const existing = await db.motivationGroupProduct.findMany({
    where: { productId: { in: productIds } },
    include: { group: { select: { name: true } } },
  })

  const inOtherGroups = existing.filter((e) => e.groupId !== groupId)
  if (inOtherGroups.length > 0) {
    // Remove from old groups first
    await db.motivationGroupProduct.deleteMany({
      where: {
        productId: { in: inOtherGroups.map((e) => e.productId) },
      },
    })
  }

  // Filter out products already in this group
  const alreadyInGroup = new Set(existing.filter((e) => e.groupId === groupId).map((e) => e.productId))
  const newProductIds = productIds.filter((id) => !alreadyInGroup.has(id))

  if (newProductIds.length > 0) {
    await db.motivationGroupProduct.createMany({
      data: newProductIds.map((productId) => ({
        groupId,
        productId,
      })),
    })
  }

  return { added: newProductIds.length, moved: inOtherGroups.length }
}

export async function removeProductFromGroup(groupId: string, productId: string) {
  await requirePermission("motivation.groups.manage")

  await db.motivationGroupProduct.delete({
    where: {
      groupId_productId: { groupId, productId },
    },
  })
}

// Search products for adding to group
export async function searchProductsForGroup(query: string, groupId?: string) {
  await requirePermission("motivation.groups.manage")

  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { name: true } },
      motivationGroup: {
        select: { group: { select: { id: true, name: true } } },
      },
    },
    take: 20,
    orderBy: { name: "asc" },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryName: p.category.name,
    currentGroupId: p.motivationGroup?.group.id ?? null,
    currentGroupName: p.motivationGroup?.group.name ?? null,
  }))
}
