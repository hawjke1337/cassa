"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { ProductForm } from "@/components/catalog/product-form"

interface NewProductClientProps {
  canSeePrices: boolean
}

export function NewProductClient({ canSeePrices }: NewProductClientProps) {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для создания товара
      </div>
    )
  }

  return <ProductForm storeId={currentStoreId} canSeePrices={canSeePrices} />
}
