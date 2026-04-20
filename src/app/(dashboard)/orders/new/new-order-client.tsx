"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { OrderForm } from "@/components/orders/order-form"

export function NewOrderClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для создания заказа
      </div>
    )
  }

  return <OrderForm storeId={currentStoreId} />
}
