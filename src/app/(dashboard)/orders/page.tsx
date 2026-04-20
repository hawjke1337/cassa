import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrdersPageClient } from "./orders-page-client"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("orders.view")
  if (!canView) redirect("/")

  const canCreate = await checkPermission("orders.create")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Заказы клиентов</h1>
          <p className="text-muted-foreground">
            Индивидуальные заказы товаров под клиента
          </p>
        </div>
        {canCreate && (
          <Link href="/orders/new">
            <Button size="sm">
              <Plus className="size-4" />
              Новый заказ
            </Button>
          </Link>
        )}
      </div>

      <OrdersPageClient />
    </div>
  )
}
