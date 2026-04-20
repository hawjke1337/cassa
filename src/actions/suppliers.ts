"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { normalizePhoneOrThrow } from "@/lib/phone-utils"

// ---- Paginated list ----

export async function getSuppliers(
  params: {
    search?: string
    isActive?: boolean
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("suppliers.view")

  const { search, isActive, page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}

  if (typeof isActive === "boolean") {
    where.isActive = isActive
  }

  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { inn: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ]
  }

  const [items, total] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    db.supplier.count({ where }),
  ])

  return {
    suppliers: items.map((s) => ({
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      email: s.email,
      city: s.city,
      inn: s.inn,
      isActive: s.isActive,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

// ---- Single supplier with stats ----

export async function getSupplier(id: string) {
  await requirePermission("suppliers.view")

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      stockReceives: {
        select: {
          id: true,
          number: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          store: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      debts: {
        include: {
          payments: {
            orderBy: { paidAt: "desc" },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          order: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { stockReceives: true, customOrders: true },
      },
    },
  })

  if (!supplier) throw new Error("Поставщик не найден")

  // Calculate total amount from confirmed receives
  const totalAmountResult = await db.stockReceive.aggregate({
    where: { supplierId: id, status: "CONFIRMED" },
    _sum: { totalAmount: true },
  })

  const unpaidDebts = await db.supplierDebt.aggregate({
    where: { supplierId: id, isPaid: false },
    _sum: { amount: true },
    _count: true,
  })

  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    website: supplier.website,
    city: supplier.city,
    address: supplier.address,
    inn: supplier.inn,
    comment: supplier.comment,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    stats: {
      receivesCount: supplier._count.stockReceives,
      ordersCount: supplier._count.customOrders,
      totalAmount: Number(totalAmountResult._sum.totalAmount ?? 0),
    },
    unpaidDebtTotal: Number(unpaidDebts._sum.amount ?? 0),
    unpaidDebtsCount: unpaidDebts._count,
    recentReceives: supplier.stockReceives.map((r) => ({
      id: r.id,
      number: r.number,
      totalAmount: Number(r.totalAmount),
      status: r.status,
      storeName: r.store.name,
      createdAt: r.createdAt.toISOString(),
    })),
    debts: supplier.debts.map((d) => ({
      id: d.id,
      orderId: d.order.id,
      orderNumber: d.order.number,
      amount: String(d.amount),
      isPaid: d.isPaid,
      paidAt: d.paidAt?.toISOString() ?? null,
      totalPaid: String(d.payments.reduce((acc, p) => acc + Number(p.amount), 0)),
      payments: d.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        comment: p.comment,
        paidAt: p.paidAt.toISOString(),
        userName: `${p.user.firstName} ${p.user.lastName}`,
      })),
    })),
  }
}

// ---- Create ----

export async function createSupplier(data: {
  name: string
  contactName?: string
  phone?: string
  email?: string
  website?: string
  city?: string
  address?: string
  inn?: string
  comment?: string
}) {
  await requirePermission("suppliers.edit")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!data.name.trim()) throw new Error("Укажите название поставщика")

  // DATA2-05: Normalize phone before storage
  const normalizedPhone = data.phone?.trim()
    ? normalizePhoneOrThrow(data.phone.trim(), "Телефон поставщика")
    : null

  const supplier = await db.supplier.create({
    data: {
      name: data.name.trim(),
      contactName: data.contactName?.trim() || null,
      phone: normalizedPhone,
      email: data.email?.trim() || null,
      website: data.website?.trim() || null,
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      inn: data.inn?.trim() || null,
      comment: data.comment?.trim() || null,
    },
  })

  revalidatePath("/dashboard/suppliers")
  return { id: supplier.id }
}

// ---- Update ----

export async function updateSupplier(
  id: string,
  data: {
    name?: string
    contactName?: string
    phone?: string
    email?: string
    website?: string
    city?: string
    address?: string
    inn?: string
    comment?: string
    isActive?: boolean
  },
) {
  await requirePermission("suppliers.edit")

  const existing = await db.supplier.findUnique({ where: { id } })
  if (!existing) throw new Error("Поставщик не найден")

  if (data.name !== undefined && !data.name.trim()) {
    throw new Error("Название не может быть пустым")
  }

  const supplier = await db.supplier.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.contactName !== undefined && { contactName: data.contactName.trim() || null }),
      ...(data.phone !== undefined && {
        phone: data.phone.trim()
          ? normalizePhoneOrThrow(data.phone.trim(), "Телефон поставщика")
          : null,
      }),
      ...(data.email !== undefined && { email: data.email.trim() || null }),
      ...(data.website !== undefined && { website: data.website.trim() || null }),
      ...(data.city !== undefined && { city: data.city.trim() || null }),
      ...(data.address !== undefined && { address: data.address.trim() || null }),
      ...(data.inn !== undefined && { inn: data.inn.trim() || null }),
      ...(data.comment !== undefined && { comment: data.comment.trim() || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })

  revalidatePath("/dashboard/suppliers")
  return { id: supplier.id }
}

// ---- Delete / Deactivate ----

export async function deleteSupplier(id: string) {
  await requirePermission("suppliers.edit")

  const existing = await db.supplier.findUnique({
    where: { id },
    include: {
      _count: { select: { stockReceives: true, customOrders: true } },
    },
  })
  if (!existing) throw new Error("Поставщик не найден")

  const hasRelations = existing._count.stockReceives > 0 || existing._count.customOrders > 0

  if (hasRelations) {
    // Soft delete — deactivate
    await db.supplier.update({
      where: { id },
      data: { isActive: false },
    })
    revalidatePath("/dashboard/suppliers")
    return { deleted: false, deactivated: true }
  }

  // Hard delete — no linked records
  await db.supplier.delete({ where: { id } })
  revalidatePath("/dashboard/suppliers")
  return { deleted: true, deactivated: false }
}

// ---- Simple list for dropdowns ----

export async function getSuppliersList() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return suppliers
}
