import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { MotivationDashboardClient } from "./motivation-dashboard-client"

export default async function MotivationPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.payroll.view")
  if (!hasAccess) redirect("/my/motivation")

  return <MotivationDashboardClient />
}
