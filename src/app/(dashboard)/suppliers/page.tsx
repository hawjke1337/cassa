import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SupplierTable } from "@/components/suppliers/supplier-table"
import { SupplierForm } from "@/components/suppliers/supplier-form"

export default async function SuppliersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("suppliers.view")
  if (!canView) redirect("/")

  const canEdit = await checkPermission("suppliers.edit")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Поставщики</h1>
          <p className="text-muted-foreground">
            Управление поставщиками товаров
          </p>
        </div>
        {canEdit && (
          <SupplierForm
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Добавить поставщика
              </Button>
            }
          />
        )}
      </div>

      <SupplierTable canEdit={canEdit} />
    </div>
  )
}
