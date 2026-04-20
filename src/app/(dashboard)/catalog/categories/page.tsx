import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CategoryManager } from "@/components/catalog/category-manager"

export default async function CategoriesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("catalog.view")
  if (!canView) redirect("/")

  const canEdit = await checkPermission("catalog.edit")
  const isAdmin = await checkPermission("settings.stores")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/catalog">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Категории</h1>
          <p className="text-muted-foreground">Управление категориями товаров</p>
        </div>
      </div>

      <CategoryManager canEdit={canEdit} isAdmin={isAdmin} />
    </div>
  )
}
