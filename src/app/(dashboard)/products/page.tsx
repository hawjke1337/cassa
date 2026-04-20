import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus, FolderTree, Package, ArrowRightLeft, ClipboardCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductsTabs } from "./products-tabs"

/**
 * UX2-16: Объединённая страница "Товары" = Каталог + Склад с tabs.
 *
 * /products?tab=catalog — текущий каталог (товары, категории, цены)
 * /products?tab=warehouse — склад (остатки, приход, перемещения, аудит)
 *
 * /catalog и /inventory → redirect на соответствующий tab (для закладок).
 */
interface ProductsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [canViewCatalog, canViewInventory] = await Promise.all([
    checkPermission("catalog.view"),
    checkPermission("inventory.view"),
  ])
  if (!canViewCatalog && !canViewInventory) redirect("/")

  const [canEditCatalog, canSeePrices, canReceive, canTransfer, canAudit, canWriteOff] =
    await Promise.all([
      checkPermission("catalog.edit"),
      checkPermission("catalog.prices"),
      checkPermission("inventory.receive"),
      checkPermission("inventory.transfer"),
      checkPermission("inventory.audit"),
      checkPermission("inventory.writeoff"),
    ])

  const sp = await searchParams
  const initialTab =
    sp.tab === "warehouse" && canViewInventory
      ? "warehouse"
      : canViewCatalog
        ? "catalog"
        : "warehouse"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Товары</h1>
          <p className="text-muted-foreground">Каталог, остатки и операции склада</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditCatalog && (
            <Link href="/catalog/categories">
              <Button variant="outline" size="sm">
                <FolderTree className="size-4" />
                Категории
              </Button>
            </Link>
          )}
          {canEditCatalog && (
            <Link href="/catalog/new">
              <Button size="sm">
                <Plus className="size-4" />
                Добавить товар
              </Button>
            </Link>
          )}
          {canReceive && (
            <Link href="/inventory/receive">
              <Button size="sm" variant="outline">
                <Package className="size-4" />
                Приход
              </Button>
            </Link>
          )}
          {canTransfer && (
            <Link href="/inventory/transfer">
              <Button size="sm" variant="outline">
                <ArrowRightLeft className="size-4" />
                Перемещение
              </Button>
            </Link>
          )}
          {canAudit && (
            <Link href="/inventory/audit">
              <Button size="sm" variant="outline">
                <ClipboardCheck className="size-4" />
                Инвентаризация
              </Button>
            </Link>
          )}
          {canWriteOff && (
            <Link href="/inventory/write-off">
              <Button size="sm" variant="outline">
                <Trash2 className="size-4" />
                Списание
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ProductsTabs
        initialTab={initialTab}
        canViewCatalog={canViewCatalog}
        canViewInventory={canViewInventory}
        canSeePrices={canSeePrices}
      />
    </div>
  )
}
