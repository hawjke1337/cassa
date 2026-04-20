import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ShiftsPageClient } from "./shifts-page-client"

export default async function ShiftsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("shifts.view")
  const canViewAll = await checkPermission("shifts.view_all")
  if (!canView && !canViewAll) redirect("/")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Смены</h1>
        <p className="text-muted-foreground">История смен и кассовых операций</p>
      </div>
      <ShiftsPageClient />
    </div>
  )
}
