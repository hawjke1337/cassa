import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { NewProductClient } from "./new-product-client"

export default async function NewProductPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canEdit = await checkPermission("catalog.edit")
  if (!canEdit) redirect("/catalog")

  const canSeePrices = await checkPermission("catalog.prices")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Новый товар</h1>
        <p className="text-muted-foreground">
          Заполните информацию о товаре
        </p>
      </div>

      <NewProductClient canSeePrices={canSeePrices} />
    </div>
  )
}
