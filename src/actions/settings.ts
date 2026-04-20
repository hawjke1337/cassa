"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { hash, compare } from "bcryptjs"
import { seedDefaultDocumentTemplates } from "@/actions/document-templates"
import { createAuditEntry } from "@/lib/audit"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"
import { normalizePhoneOrThrow } from "@/lib/phone-utils"

// =============================================
// STORES
// =============================================

export async function getStores() {
  await requirePermission("settings.stores")

  // Use raw query to bypass soft delete extension and include archived stores
  const stores = await db.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      address: string
      phone: string | null
      isActive: boolean
      deletedAt: Date | null
      createdAt: Date
    }>
  >(
    `SELECT s."id", s."name", s."address", s."phone", s."isActive", s."deletedAt", s."createdAt"
     FROM "Store" s
     ORDER BY s."deletedAt" ASC NULLS FIRST, s."name" ASC`,
  )

  // Get user counts per store
  const storeIds = stores.map((s) => s.id)
  const userCounts =
    storeIds.length > 0
      ? await db.userStore.groupBy({
          by: ["storeId"],
          where: { storeId: { in: storeIds } },
          _count: true,
        })
      : []
  const userCountMap = new Map(userCounts.map((uc) => [uc.storeId, uc._count]))

  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    isActive: s.isActive,
    isDeleted: s.deletedAt !== null,
    userCount: userCountMap.get(s.id) ?? 0,
    createdAt: new Date(s.createdAt).toISOString(),
  }))
}

export async function createStore(data: { name: string; address: string; phone?: string }) {
  await requirePermission("settings.stores")

  if (!data.name.trim()) throw new Error("Укажите название магазина")
  if (!data.address.trim()) throw new Error("Укажите адрес магазина")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const store = await db.store.create({
    data: {
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone?.trim()
        ? normalizePhoneOrThrow(data.phone.trim(), "Телефон магазина")
        : null,
    },
  })

  await seedDefaultDocumentTemplates(store.id, session.user.id)

  revalidatePath("/dashboard/settings")
  return { id: store.id }
}

export async function updateStore(
  id: string,
  data: { name?: string; address?: string; phone?: string },
) {
  await requirePermission("settings.stores")

  const existing = await db.store.findUnique({ where: { id } })
  if (!existing) throw new Error("Магазин не найден")

  if (data.name !== undefined && !data.name.trim()) {
    throw new Error("Название не может быть пустым")
  }
  if (data.address !== undefined && !data.address.trim()) {
    throw new Error("Адрес не может быть пустым")
  }

  await db.store.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.address !== undefined && { address: data.address.trim() }),
      ...(data.phone !== undefined && {
        phone: data.phone.trim()
          ? normalizePhoneOrThrow(data.phone.trim(), "Телефон магазина")
          : null,
      }),
    },
  })

  revalidatePath("/dashboard/settings")
  return { id }
}

export async function toggleStoreActive(id: string) {
  await requirePermission("settings.stores")

  const store = await db.store.findUnique({ where: { id } })
  if (!store) throw new Error("Магазин не найден")

  await db.store.update({
    where: { id },
    data: { isActive: !store.isActive },
  })

  revalidatePath("/dashboard/settings")
  return { id, isActive: !store.isActive }
}

export async function softDeleteStore(storeId: string) {
  await requirePermission("settings.stores")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const rateCheck = checkWriteRateLimit(session.user.id, "settings.stores")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "settings.stores")

  // Bypass soft delete extension for store lookup
  const stores = await db.$queryRawUnsafe<
    Array<{ id: string; name: string; deletedAt: Date | null }>
  >(`SELECT "id", "name", "deletedAt" FROM "Store" WHERE "id" = $1`, storeId)
  const store = stores[0]
  if (!store) throw new Error("Магазин не найден")
  if (store.deletedAt !== null) throw new Error("Магазин уже удалён")

  // Check stock > 0
  const stockResult = await db.storeProduct.aggregate({
    where: { storeId, quantity: { gt: 0 } },
    _sum: { quantity: true },
  })
  const totalStock = stockResult._sum.quantity ?? 0
  if (totalStock > 0) {
    throw new Error(
      `Невозможно удалить магазин с остатками на складе (${totalStock} единиц). Сначала переместите или спишите товар.`,
    )
  }

  // Check open shifts
  const openShift = await db.shift.findFirst({
    where: { storeId, closedAt: null },
  })
  if (openShift) {
    throw new Error("Невозможно удалить магазин с открытой сменой. Сначала закройте смену.")
  }

  // Check active orders
  const activeOrders = await db.customOrder.count({
    where: {
      storeId,
      status: { in: ["NEW", "PREPAID", "ORDERED", "IN_TRANSIT", "ARRIVED", "READY_FOR_PICKUP"] },
    },
  })
  if (activeOrders > 0) {
    throw new Error(`Невозможно удалить магазин с ${activeOrders} активными заказами.`)
  }

  await db.$executeRawUnsafe(
    `UPDATE "Store" SET "deletedAt" = NOW(), "isActive" = false, "updatedAt" = NOW() WHERE "id" = $1`,
    storeId,
  )

  await createAuditEntry({
    action: "DELETE",
    entity: "Store",
    entityId: storeId,
    userId: session.user.id,
    changes: {
      deletedAt: { old: null, new: new Date().toISOString() },
      isActive: { old: true, new: false },
    },
  })

  revalidatePath("/settings/stores")
}

export async function restoreStore(storeId: string) {
  await requirePermission("settings.stores")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await db.$executeRawUnsafe(
    `UPDATE "Store" SET "deletedAt" = NULL, "isActive" = true, "updatedAt" = NOW() WHERE "id" = $1`,
    storeId,
  )

  await createAuditEntry({
    action: "UPDATE",
    entity: "Store",
    entityId: storeId,
    userId: session.user.id,
    changes: {
      deletedAt: { old: "archived", new: null },
      isActive: { old: false, new: true },
    },
  })

  revalidatePath("/settings/stores")
}

// =============================================
// USERS
// =============================================

export async function getUsers(
  params: {
    search?: string
    isActive?: boolean
    page?: number
    perPage?: number
  } = {},
) {
  await requirePermission("settings.users")

  const { search, isActive, page = 1, perPage = 20 } = params
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}

  if (typeof isActive === "boolean") {
    where.isActive = isActive
  }

  if (search && search.trim()) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { login: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { lastName: "asc" },
      skip,
      take: perPage,
      select: {
        id: true,
        login: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        stores: {
          include: { store: { select: { id: true, name: true } } },
        },
        roles: {
          include: {
            role: { select: { id: true, name: true } },
            store: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.user.count({ where }),
  ])

  return {
    users: items.map((u) => ({
      id: u.id,
      login: u.login,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      stores: u.stores.map((us) => ({
        id: us.store.id,
        name: us.store.name,
      })),
      roles: u.roles.map((ur) => ({
        roleId: ur.role.id,
        roleName: ur.role.name,
        storeId: ur.store?.id ?? null,
        storeName: ur.store?.name ?? null,
      })),
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

export async function getUser(id: string) {
  await requirePermission("settings.users")

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      login: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      stores: {
        include: { store: { select: { id: true, name: true } } },
      },
      roles: {
        include: {
          role: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!user) throw new Error("Пользователь не найден")

  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    stores: user.stores.map((us) => ({
      id: us.store.id,
      name: us.store.name,
    })),
    roles: user.roles.map((ur) => ({
      roleId: ur.role.id,
      roleName: ur.role.name,
      storeId: ur.store?.id ?? null,
      storeName: ur.store?.name ?? null,
    })),
  }
}

export async function createUser(data: {
  login: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  storeIds: string[]
  roleAssignments: { roleId: string; storeId?: string }[]
}) {
  await requirePermission("settings.users")

  if (!data.login.trim()) throw new Error("Укажите логин")
  if (!data.password || data.password.length < 8)
    throw new Error("Пароль должен быть не менее 8 символов")
  if (!data.firstName.trim()) throw new Error("Укажите имя")
  if (!data.lastName.trim()) throw new Error("Укажите фамилию")

  const existing = await db.user.findUnique({
    where: { login: data.login.trim() },
  })
  if (existing) throw new Error("Пользователь с таким логином уже существует")

  const hashedPassword = await hash(data.password, 12)

  const user = await db.user.create({
    data: {
      login: data.login.trim(),
      password: hashedPassword,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim()
        ? normalizePhoneOrThrow(data.phone.trim(), "Телефон сотрудника")
        : null,
      stores: {
        create: data.storeIds.map((storeId) => ({ storeId })),
      },
      roles: {
        create: data.roleAssignments.map((ra) => ({
          roleId: ra.roleId,
          storeId: ra.storeId || null,
        })),
      },
    },
  })

  revalidatePath("/dashboard/settings")
  return { id: user.id }
}

export async function updateUser(
  id: string,
  data: {
    firstName?: string
    lastName?: string
    phone?: string
    login?: string
  },
) {
  await requirePermission("settings.users")

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) throw new Error("Пользователь не найден")

  if (data.firstName !== undefined && !data.firstName.trim()) {
    throw new Error("Имя не может быть пустым")
  }
  if (data.lastName !== undefined && !data.lastName.trim()) {
    throw new Error("Фамилия не может быть пустой")
  }
  if (data.login !== undefined) {
    if (!data.login.trim()) throw new Error("Логин не может быть пустым")
    const dup = await db.user.findUnique({
      where: { login: data.login.trim() },
    })
    if (dup && dup.id !== id) throw new Error("Пользователь с таким логином уже существует")
  }

  await db.user.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
      ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
      ...(data.phone !== undefined && {
        phone: data.phone.trim()
          ? normalizePhoneOrThrow(data.phone.trim(), "Телефон сотрудника")
          : null,
      }),
      ...(data.login !== undefined && { login: data.login.trim() }),
    },
  })

  revalidatePath("/dashboard/settings")
  return { id }
}

export async function toggleUserActive(id: string) {
  await requirePermission("settings.users")

  const session = await auth()
  if (session?.user?.id === id) {
    throw new Error("Нельзя деактивировать самого себя")
  }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) throw new Error("Пользователь не найден")

  await db.user.update({
    where: { id },
    data: {
      isActive: !user.isActive,
      permissionsVersion: { increment: 1 },
    },
  })

  revalidatePath("/dashboard/settings")
  return { id, isActive: !user.isActive }
}

export async function resetUserPassword(id: string, newPassword: string) {
  await requirePermission("settings.users")

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Пароль должен быть не менее 8 символов")
  }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) throw new Error("Пользователь не найден")

  const hashedPassword = await hash(newPassword, 12)

  await db.user.update({
    where: { id },
    data: { password: hashedPassword },
  })

  revalidatePath("/dashboard/settings")
  return { id }
}

export async function updateUserStores(userId: string, storeIds: string[]) {
  await requirePermission("settings.users")

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("Пользователь не найден")

  // Delete existing and recreate
  await db.userStore.deleteMany({ where: { userId } })

  if (storeIds.length > 0) {
    await db.userStore.createMany({
      data: storeIds.map((storeId) => ({ userId, storeId })),
    })
  }

  revalidatePath("/dashboard/settings")
  return { userId }
}

export async function updateUserRoles(
  userId: string,
  assignments: { roleId: string; storeId?: string }[],
) {
  await requirePermission("settings.users")

  // SEC2-08: Prevent self-role change
  const session = await auth()
  if (userId === session?.user?.id) {
    throw new Error("Нельзя изменять свои собственные роли")
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("Пользователь не найден")

  // Delete existing and recreate
  await db.userRole.deleteMany({ where: { userId } })

  if (assignments.length > 0) {
    await db.userRole.createMany({
      data: assignments.map((a) => ({
        userId,
        roleId: a.roleId,
        storeId: a.storeId || null,
      })),
    })
  }

  // Increment permissions version to invalidate JWT cache
  await db.user.update({
    where: { id: userId },
    data: { permissionsVersion: { increment: 1 } },
  })

  revalidatePath("/dashboard/settings")
  return { userId }
}

// =============================================
// ROLES (for selects)
// =============================================

export async function getRoles() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, isSystem: true },
  })

  return roles
}

// =============================================
// ALL STORES (for selects, no permission check beyond auth)
// =============================================

export async function getAllStores() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const stores = await db.store.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return stores
}

// =============================================
// PROFILE (self-service, no special permission)
// =============================================

export async function getProfile() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      login: true,
      firstName: true,
      lastName: true,
      phone: true,
      createdAt: true,
    },
  })

  if (!user) throw new Error("Пользователь не найден")

  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function updateProfile(data: { firstName: string; lastName: string; phone?: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!data.firstName.trim()) throw new Error("Укажите имя")
  if (!data.lastName.trim()) throw new Error("Укажите фамилию")

  await db.user.update({
    where: { id: session.user.id },
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() ? normalizePhoneOrThrow(data.phone.trim(), "Телефон") : null,
    },
  })

  return { success: true }
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  if (!data.currentPassword) throw new Error("Укажите текущий пароль")
  if (!data.newPassword || data.newPassword.length < 8) {
    throw new Error("Новый пароль должен быть не менее 8 символов")
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) throw new Error("Пользователь не найден")

  const isValid = await compare(data.currentPassword, user.password)
  if (!isValid) throw new Error("Неверный текущий пароль")

  const hashedPassword = await hash(data.newPassword, 12)

  await db.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  })

  return { success: true }
}
