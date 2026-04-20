import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { FundsPageClient } from "./funds-page-client"
import { getFunds } from "@/actions/funds"

export default async function FundsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("funds.manage")
  if (!canManage) redirect("/settings")

  const funds = await getFunds()

  return (
    <div className="space-y-6">
      <FundsPageClient initialFunds={funds} />
    </div>
  )
}
