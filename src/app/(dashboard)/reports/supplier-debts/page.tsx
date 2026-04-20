import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { SupplierDebtsClient } from "./supplier-debts-client"

export default async function SupplierDebtsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("orders.costs")
  if (!canView) redirect("/reports")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Долги поставщикам</h1>
        <p className="text-muted-foreground">
          Задолженности по заказам поставщикам
        </p>
      </div>
      <SupplierDebtsClient />
    </div>
  )
}
