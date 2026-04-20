"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { ProductTable } from "@/components/catalog/product-table"

interface CatalogPageClientProps {
  canSeePrices: boolean
}

export function CatalogPageClient({ canSeePrices }: CatalogPageClientProps) {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для просмотра каталога
      </div>
    )
  }

  return (
    <ProductTable storeId={currentStoreId} canSeePrices={canSeePrices} />
  )
}
