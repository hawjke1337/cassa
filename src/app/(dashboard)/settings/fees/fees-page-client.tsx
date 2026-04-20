"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { FeeSettingsForm } from "@/components/settings/fee-settings-form"

export function FeesPageClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Выберите магазин для настройки комиссий
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Комиссии банка</h2>
        <p className="text-muted-foreground">
          Настройка ставок банковских комиссий по методам оплаты
        </p>
      </div>
      <FeeSettingsForm storeId={currentStoreId} />
    </div>
  )
}
