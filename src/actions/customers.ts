"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validations/trade-in"
import { createAuditEntry } from "@/lib/audit"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"
import { normalizePhoneOrThrow } from "@/lib/phone-utils"

export async function getCustomers(search?: string) {
  await requirePermission("customers.view")

  const searchCondition = search
    ? `AND (c."name" ILIKE '%' || $1 || '%' OR c."phone" LIKE '%' || $1 || '%')`
    : ""

  // Use raw query to bypass soft delete extension and get ALL customers (including archived)
  const customers = search
    ? await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          phone: string
          passportSeries: string | null
          passportNumber: string | null
          passportIssuedBy: string | null
          passportIssuedAt: Date | null
          comment: string | null
          deletedAt: Date | null
          createdAt: Date
          updatedAt: Date
        }>
      >(
        `SELECT c."id", c."name", c."phone", c."passportSeries", c."passportNumber",
                c."passportIssuedBy", c."passportIssuedAt", c."comment", c."deletedAt",
                c."createdAt", c."updatedAt"
         FROM "Customer" c
         WHERE 1=1 ${searchCondition}
         ORDER BY c."deletedAt" ASC NULLS FIRST, c."createdAt" DESC
         LIMIT 100`,
        search,
      )
    : await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          phone: string
          passportSeries: string | null
          passportNumber: string | null
          passportIssuedBy: string | null
          passportIssuedAt: Date | null
          comment: string | null
          deletedAt: Date | null
          createdAt: Date
          updatedAt: Date
        }>
      >(
        `SELECT c."id", c."name", c."phone", c."passportSeries", c."passportNumber",
                c."passportIssuedBy", c."passportIssuedAt", c."comment", c."deletedAt",
                c."createdAt", c."updatedAt"
         FROM "Customer" c
         ORDER BY c."deletedAt" ASC NULLS FIRST, c."createdAt" DESC
         LIMIT 100`,
      )

  // Get trade-in counts
  const customerIds = customers.map((c) => c.id)
  const tradeInCounts =
    customerIds.length > 0
      ? await db.tradeIn.groupBy({
          by: ["customerId"],
          where: { customerId: { in: customerIds } },
          _count: true,
        })
      : []
  const tradeInCountMap = new Map(tradeInCounts.map((t) => [t.customerId, t._count]))

  // Get last trade-in date per customer
  const lastTradeIns =
    customerIds.length > 0
      ? await db.tradeIn.groupBy({
          by: ["customerId"],
          where: { customerId: { in: customerIds } },
          _max: { createdAt: true },
        })
      : []
  const lastTradeInMap = new Map(lastTradeIns.map((t) => [t.customerId, t._max.createdAt]))

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    passportSeries: c.passportSeries,
    passportNumber: c.passportNumber,
    passportIssuedBy: c.passportIssuedBy,
    passportIssuedAt: c.passportIssuedAt ? new Date(c.passportIssuedAt).toISOString() : null,
    comment: c.comment,
    isDeleted: c.deletedAt !== null,
    tradeInCount: tradeInCountMap.get(c.id) ?? 0,
    lastTradeInAt: lastTradeInMap.get(c.id)?.toISOString() ?? null,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: new Date(c.updatedAt).toISOString(),
  }))
}

export async function getCustomer(id: string) {
  await requirePermission("customers.view")

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      tradeIns: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          deviceType: true,
          deviceBrand: true,
          deviceModel: true,
          agreedPrice: true,
          createdAt: true,
        },
      },
    },
  })

  if (!customer) throw new Error("Клиент не найден")

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    passportSeries: customer.passportSeries,
    passportNumber: customer.passportNumber,
    passportIssuedBy: customer.passportIssuedBy,
    passportIssuedAt: customer.passportIssuedAt?.toISOString() ?? null,
    comment: customer.comment,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    tradeIns: customer.tradeIns.map((ti) => ({
      id: ti.id,
      number: ti.number,
      type: ti.type,
      status: ti.status,
      device: [ti.deviceType, ti.deviceBrand, ti.deviceModel].filter(Boolean).join(" "),
      agreedPrice: Number(ti.agreedPrice),
      createdAt: ti.createdAt.toISOString(),
    })),
  }
}

export async function createCustomer(data: unknown) {
  await requirePermission("customers.manage")
  const parsed = createCustomerSchema.parse(data)

  // DATA2-05: Normalize phone before storage
  parsed.phone = normalizePhoneOrThrow(parsed.phone, "Телефон клиента")

  const customer = await db.customer.create({
    data: {
      name: parsed.name,
      phone: parsed.phone,
      passportSeries: parsed.passportSeries || null,
      passportNumber: parsed.passportNumber || null,
      passportIssuedBy: parsed.passportIssuedBy || null,
      passportIssuedAt: parsed.passportIssuedAt || null,
      comment: parsed.comment || null,
    },
  })

  revalidatePath("/dashboard/customers")
  return { id: customer.id, name: customer.name, phone: customer.phone }
}

export async function updateCustomer(id: string, data: unknown) {
  await requirePermission("customers.manage")
  const parsed = updateCustomerSchema.parse(data)

  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) throw new Error("Клиент не найден")

  // DATA2-05: Normalize phone before storage
  if (parsed.phone && parsed.phone.trim()) {
    parsed.phone = normalizePhoneOrThrow(parsed.phone.trim(), "Телефон клиента")
  }

  const updated = await db.customer.update({
    where: { id },
    data: {
      ...parsed,
      passportSeries: parsed.passportSeries || null,
      passportNumber: parsed.passportNumber || null,
      passportIssuedBy: parsed.passportIssuedBy || null,
      passportIssuedAt: parsed.passportIssuedAt || null,
      comment: parsed.comment || null,
    },
  })

  revalidatePath("/dashboard/customers")
  return { id: updated.id, name: updated.name, phone: updated.phone }
}

export async function searchCustomers(query: string) {
  await requirePermission("customers.view")

  if (query.length < 2) return []

  const customers = await db.customer.findMany({
    where: {
      OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      passportSeries: true,
      passportNumber: true,
    },
    take: 10,
  })

  return customers
}

export async function softDeleteCustomer(customerId: string) {
  await requirePermission("customers.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const rateCheck = checkWriteRateLimit(session.user.id, "customers.manage")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "customers.manage")

  // Use raw query to bypass soft delete extension and find even already-deleted customers
  const customers = await db.$queryRawUnsafe<Array<{ id: string; deletedAt: Date | null }>>(
    `SELECT "id", "deletedAt" FROM "Customer" WHERE "id" = $1`,
    customerId,
  )
  const customer = customers[0]
  if (!customer) throw new Error("Клиент не найден")
  if (customer.deletedAt !== null) throw new Error("Клиент уже удалён")

  await db.$executeRawUnsafe(
    `UPDATE "Customer" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
    customerId,
  )

  await createAuditEntry({
    action: "DELETE",
    entity: "Customer",
    entityId: customerId,
    userId: session.user.id,
    changes: { deletedAt: { old: null, new: new Date().toISOString() } },
  })

  revalidatePath("/customers")
}

export async function restoreCustomer(customerId: string) {
  await requirePermission("customers.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await db.$executeRawUnsafe(
    `UPDATE "Customer" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
    customerId,
  )

  await createAuditEntry({
    action: "UPDATE",
    entity: "Customer",
    entityId: customerId,
    userId: session.user.id,
    changes: { deletedAt: { old: "archived", new: null } },
  })

  revalidatePath("/customers")
}
