import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { RepairsPageClient } from "./repairs-page-client"

export default async function RepairsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("repairs.view")
  if (!canView) redirect("/")

  const canCreate = await checkPermission("repairs.create")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ремонт</h1>
          <p className="text-muted-foreground">
            Приём и обслуживание устройств
          </p>
        </div>
      </div>

      <RepairsPageClient canCreate={canCreate} />
    </div>
  )
}
