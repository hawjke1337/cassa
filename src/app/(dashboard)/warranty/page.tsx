import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { WarrantyListClient } from "@/components/warranty/warranty-list-client"

export default async function WarrantyPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("warranty.view")
  if (!canView) redirect("/")

  const canCreate = await checkPermission("warranty.create")
  const canManage = await checkPermission("warranty.manage")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Гарантия</h1>
          <p className="text-muted-foreground">Гарантийные обращения</p>
        </div>
      </div>
      <WarrantyListClient canCreate={canCreate} canManage={canManage} />
    </div>
  )
}
