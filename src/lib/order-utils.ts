/** Calculate net profit for a custom order */
export function calculateNetProfit(
  totalAmount: number,
  discountAmount: number,
  purchasePrice: number | null,
  deliveryCost: number | null,
): number | null {
  if (purchasePrice === null) return null
  return totalAmount - discountAmount - purchasePrice - (deliveryCost ?? 0)
}

/** Calculate total amount from order items */
export function calculateOrderTotalAmount(
  items: Array<{ price: number; quantity: number }>,
): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

/** Validate discount amount */
export function validateDiscountAmount(
  discountAmount: number,
  totalAmount: number,
): { valid: boolean; error?: string } {
  if (discountAmount < 0) return { valid: false, error: "Скидка не может быть отрицательной" }
  if (discountAmount > totalAmount) return { valid: false, error: "Скидка не может превышать сумму заказа" }
  return { valid: true }
}

/** Validate order costs input for updateOrderCosts action */
export function validateOrderCostsInput(data: {
  purchasePrice: number
  deliveryCost?: number
  orderStatus: string
}): { valid: boolean; error?: string } {
  if (data.orderStatus !== "COMPLETED") {
    return { valid: false, error: "Закупочные данные можно ввести только после завершения заказа" }
  }
  if (data.purchasePrice <= 0) {
    return { valid: false, error: "Закупочная цена должна быть больше 0" }
  }
  if (data.deliveryCost !== undefined && data.deliveryCost < 0) {
    return { valid: false, error: "Стоимость доставки не может быть отрицательной" }
  }
  return { valid: true }
}
