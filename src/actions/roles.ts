"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { checkWriteRateLimit, recordWriteAttempt } from "@/lib/rate-limit"
import { createAuditEntry } from "@/lib/audit"
import { revalidatePath } from "next/cache"

const MODULE_NAMES: Record<string, string> = {
  catalog: "Каталог",
  pos: "Касса",
  inventory: "Склад",
  orders: "Заказы",
  repairs: "Ремонт",
  suppliers: "Поставщики",
  reports: "Отчёты",
  settings: "Настройки",
  motivation: "Мотивация",
  customers: "Клиенты",
  tradein: "Трейд-ин",
  shifts: "Смены",
  funds: "Фонды",
  warranty: "Гарантия",
  serial: "Серийные номера",
}

export async function getRolesWithPermissions() {
  await requirePermission("settings.roles")

  const roles = await db.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  })

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissionCodes: r.permissions.map((rp) => rp.permission.code),
    userCount: r._count.users,
  }))
}

export async function getRoleById(roleId: string) {
  await requirePermission("settings.roles")

  const role = await db.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: { include: { permission: true } },
    },
  })

  if (!role) return null

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionCodes: role.permissions.map((rp) => rp.permission.code),
  }
}

export async function createRole(data: {
  name: string
  description?: string
  permissionCodes: string[]
}) {
  await requirePermission("settings.roles")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const rateCheck = checkWriteRateLimit(session.user.id, "settings.roles")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "settings.roles")

  const trimmedName = data.name.trim()
  if (!trimmedName || trimmedName.length > 100) {
    throw new Error("Название роли должно быть от 1 до 100 символов")
  }

  const permissions = await db.permission.findMany({
    where: { code: { in: data.permissionCodes } },
  })

  try {
    await db.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: trimmedName,
          description: data.description?.trim() || null,
          isSystem: false,
        },
      })

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        })
      }

      await createAuditEntry({
        action: "CREATE",
        entity: "Role",
        entityId: role.id,
        userId: session.user.id,
        changes: {
          name: { old: null, new: trimmedName },
          permissions: { old: null, new: data.permissionCodes },
        },
        tx,
      })

      return role
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new Error("Роль с таким названием уже существует")
    }
    throw err
  }

  revalidatePath("/settings/roles")
}

export async function updateRole(
  roleId: string,
  data: { name: string; description?: string; permissionCodes: string[] },
) {
  await requirePermission("settings.roles")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const rateCheck = checkWriteRateLimit(session.user.id, "settings.roles")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "settings.roles")

  const trimmedName = data.name.trim()
  if (!trimmedName || trimmedName.length > 100) {
    throw new Error("Название роли должно быть от 1 до 100 символов")
  }

  const existing = await db.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  })

  if (!existing) throw new Error("Роль не найдена")

  // Системные роли: можно менять permissions, нельзя менять название/описание
  if (existing.isSystem) {
    data.name = existing.name
    data.description = existing.description ?? undefined
  }

  const oldCodes = existing.permissions.map((rp) => rp.permission.code)
  const newPermissions = await db.permission.findMany({
    where: { code: { in: data.permissionCodes } },
  })

  try {
    await db.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          name: trimmedName,
          description: data.description?.trim() || null,
        },
      })

      await tx.rolePermission.deleteMany({ where: { roleId } })

      if (newPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: newPermissions.map((p) => ({ roleId, permissionId: p.id })),
        })
      }

      await createAuditEntry({
        action: "UPDATE",
        entity: "Role",
        entityId: roleId,
        userId: session.user.id,
        changes: {
          name: { old: existing.name, new: trimmedName },
          permissions: { old: oldCodes, new: data.permissionCodes },
        },
        tx,
      })
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new Error("Роль с таким названием уже существует")
    }
    throw err
  }

  revalidatePath("/settings/roles")
}

export async function deleteRole(roleId: string) {
  await requirePermission("settings.roles")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const rateCheck = checkWriteRateLimit(session.user.id, "settings.roles")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "settings.roles")

  const role = await db.role.findUnique({ where: { id: roleId } })
  if (!role) throw new Error("Роль не найдена")
  if (role.isSystem) throw new Error("Системные роли нельзя удалить")

  const userCount = await db.userRole.count({ where: { roleId } })
  if (userCount > 0) {
    throw new Error(`Роль назначена ${userCount} пользователям. Сначала снимите роль.`)
  }

  await db.role.delete({ where: { id: roleId } })

  await createAuditEntry({
    action: "DELETE",
    entity: "Role",
    entityId: roleId,
    userId: session.user.id,
    changes: {
      name: { old: role.name, new: null },
    },
  })

  revalidatePath("/settings/roles")
}

export async function getPermissionsByModule() {
  const permissions = await db.permission.findMany({
    orderBy: [{ module: "asc" }, { name: "asc" }],
  })

  const grouped = new Map<string, { id: string; code: string; name: string }[]>()
  for (const p of permissions) {
    const existing = grouped.get(p.module) ?? []
    existing.push({ id: p.id, code: p.code, name: p.name })
    grouped.set(p.module, existing)
  }

  return Array.from(grouped.entries()).map(([module, perms]) => ({
    module,
    moduleName: MODULE_NAMES[module] ?? module,
    permissions: perms,
  }))
}
