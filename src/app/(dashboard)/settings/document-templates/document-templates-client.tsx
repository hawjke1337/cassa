"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { DocumentTemplateTable } from "@/components/documents/template-table"

export function DocumentTemplatesClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для управления шаблонами документов
      </div>
    )
  }

  return <DocumentTemplateTable storeId={currentStoreId} />
}
