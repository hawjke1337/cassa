import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { FundsReportClient } from "./funds-report-client"

export default async function FundsReportPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("shifts.view_all")
  if (!canView) redirect("/reports")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Отчёт по фондам</h1>
        <p className="text-muted-foreground">Движение средств по фондам</p>
      </div>
      <FundsReportClient />
    </div>
  )
}
