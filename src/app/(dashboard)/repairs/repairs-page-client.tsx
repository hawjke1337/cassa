"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { RepairForm } from "@/components/repairs/repair-form"
import { RepairTable } from "@/components/repairs/repair-table"

interface RepairsPageClientProps {
  canCreate: boolean
}

export function RepairsPageClient({ canCreate }: RepairsPageClientProps) {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для просмотра ремонтов
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canCreate && <RepairForm storeId={currentStoreId} />}
      <RepairTable storeId={currentStoreId} />
    </div>
  )
}
