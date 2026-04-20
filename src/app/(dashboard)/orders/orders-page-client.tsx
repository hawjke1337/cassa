"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { OrderTable } from "@/components/orders/order-table"

export function OrdersPageClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для просмотра заказов
      </div>
    )
  }

  return <OrderTable storeId={currentStoreId} />
}
