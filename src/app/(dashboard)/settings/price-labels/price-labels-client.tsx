"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { TemplateTable } from "@/components/price-labels/template-table"

export function PriceLabelsClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для управления шаблонами ценников
      </div>
    )
  }

  return <TemplateTable storeId={currentStoreId} />
}
