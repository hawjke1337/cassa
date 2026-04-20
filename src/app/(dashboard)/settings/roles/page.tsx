import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RoleTable } from "@/components/settings/role-table"
import { RoleForm } from "@/components/settings/role-form"
import { getRolesWithPermissions, getPermissionsByModule } from "@/actions/roles"

export default async function RolesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("settings.roles")
  if (!canView) redirect("/settings/profile")

  const [roles, modules] = await Promise.all([getRolesWithPermissions(), getPermissionsByModule()])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Роли</h1>
          <p className="text-muted-foreground">Управление ролями и правами доступа</p>
        </div>
        <RoleForm
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Добавить роль
            </Button>
          }
          modules={modules}
        />
      </div>
      <RoleTable roles={roles} modules={modules} />
    </div>
  )
}
