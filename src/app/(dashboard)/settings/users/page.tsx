import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserTable } from "@/components/settings/user-table"
import { UserForm } from "@/components/settings/user-form"

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("settings.users")
  if (!canView) redirect("/settings/profile")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
          <p className="text-muted-foreground">
            Управление учётными записями и ролями
          </p>
        </div>
        <UserForm
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Добавить пользователя
            </Button>
          }
        />
      </div>

      <UserTable canManage={true} currentUserId={session.user.id} />
    </div>
  )
}
