import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { EditProductClient } from "./edit-product-client"

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("catalog.view")
  if (!canView) redirect("/")

  const canSeePrices = await checkPermission("catalog.prices")
  const canEdit = await checkPermission("catalog.edit")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {canEdit ? "Редактирование товара" : "Просмотр товара"}
        </h1>
        <p className="text-muted-foreground">
          {canEdit
            ? "Измените информацию о товаре"
            : "Информация о товаре (только чтение)"}
        </p>
      </div>

      <EditProductClient
        productId={id}
        canSeePrices={canSeePrices}
        canEdit={canEdit}
      />
    </div>
  )
}
