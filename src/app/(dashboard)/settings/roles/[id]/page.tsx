import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getRoleById, getPermissionsByModule } from "@/actions/roles"
import { RoleForm } from "@/components/settings/role-form"
import { InlineAuditHistory } from "@/components/settings/inline-audit-history"
import { PermissionMatrix } from "@/components/settings/permission-matrix"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoleDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("settings.roles")
  if (!canView) redirect("/settings/profile")

  const [role, modules] = await Promise.all([getRoleById(id), getPermissionsByModule()])

  if (!role) redirect("/settings/roles")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings/roles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            Назад
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
            {role.isSystem && <Badge variant="outline">Системная</Badge>}
          </div>
          <p className="text-muted-foreground">{role.description || "Без описания"}</p>
        </div>
        <RoleForm
          trigger={
            <Button size="sm" variant="outline">
              <Pencil className="mr-1 size-4" />
              Редактировать
            </Button>
          }
          role={{ ...role, isSystem: role.isSystem }}
          modules={modules}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Права доступа ({role.permissionCodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionMatrix
            modules={modules}
            selectedCodes={role.permissionCodes}
            onChange={() => {}}
            disabled
          />
        </CardContent>
      </Card>

      <InlineAuditHistory entity="Role" entityId={id} />
    </div>
  )
}
