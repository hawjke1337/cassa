import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { NewOrderClient } from "./new-order-client"

export default async function NewOrderPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canCreate = await checkPermission("orders.create")
  if (!canCreate) redirect("/orders")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Новый заказ</h1>
        <p className="text-muted-foreground">
          Оформление индивидуального заказа для клиента
        </p>
      </div>

      <NewOrderClient />
    </div>
  )
}
