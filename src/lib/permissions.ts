import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import type { PermissionCode } from "@/lib/permissions-list"

export async function getUserPermissions(userId: string, storeId?: string): Promise<string[]> {
  const userRoles = await db.userRole.findMany({
    where: {
      userId,
      OR: [
        { storeId: null },
        ...(storeId ? [{ storeId }] : []),
      ],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  })

  const permissions = new Set<string>()
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.code)
    }
  }
  return Array.from(permissions)
}

export async function checkPermission(permissionCode: PermissionCode, storeId?: string): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const permissions = await getUserPermissions(session.user.id, storeId)
  return permissions.includes(permissionCode)
}

export async function requirePermission(permissionCode: PermissionCode, storeId?: string): Promise<void> {
  const hasPermission = await checkPermission(permissionCode, storeId)
  if (!hasPermission) {
    throw new Error(`Нет доступа: требуется разрешение "${permissionCode}"`)
  }
}
