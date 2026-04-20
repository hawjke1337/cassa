"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"

export async function getFunds(storeId?: string) {
  await requirePermission("funds.manage")

  const funds = await db.fund.findMany({
    where: storeId
      ? { OR: [{ storeId }, { storeId: null }] }
      : undefined,
    include: {
      store: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })

  return funds.map((f) => ({
    id: f.id,
    name: f.name,
    storeId: f.storeId,
    storeName: f.store?.name ?? null,
    isActive: f.isActive,
    createdAt: f.createdAt.toISOString(),
  }))
}

export async function createFund(data: { name: string; storeId?: string }) {
  await requirePermission("funds.manage")

  if (!data.name.trim()) throw new Error("Название обязательно")

  const existing = await db.fund.findFirst({
    where: { name: data.name.trim(), storeId: data.storeId ?? null },
  })
  if (existing) throw new Error("Фонд с таким названием уже существует")

  const fund = await db.fund.create({
    data: {
      name: data.name.trim(),
      storeId: data.storeId || null,
    },
  })

  return { id: fund.id }
}

export async function updateFund(
  id: string,
  data: { name?: string; storeId?: string }
) {
  await requirePermission("funds.manage")

  const fund = await db.fund.findUnique({ where: { id } })
  if (!fund) throw new Error("Фонд не найден")

  await db.fund.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.storeId !== undefined && { storeId: data.storeId || null }),
    },
  })
}

export async function toggleFundActive(id: string) {
  await requirePermission("funds.manage")

  const fund = await db.fund.findUnique({ where: { id } })
  if (!fund) throw new Error("Фонд не найден")

  await db.fund.update({
    where: { id },
    data: { isActive: !fund.isActive },
  })
}
