/** Calculate commission for a single sale item */
export function calculateItemCommission(
  sellPrice: number,
  costPrice: number,
  quantity: number,
  rate: number,
  basis: "PROFIT" | "RETAIL_PRICE",
  type: "PERCENT" | "FIXED" = "PERCENT",
): number {
  if (type === "FIXED") {
    return rate * quantity
  }
  if (basis === "PROFIT") {
    return (sellPrice - costPrice) * quantity * rate
  }
  return sellPrice * quantity * rate
}

/** Calculate commission for an order-based sale item.
 *  Uses netProfit (total order profit) instead of per-item sellPrice-costPrice.
 *  Returns 0 if netProfit is null (purchasePrice not entered). */
export function calculateOrderItemCommission(
  netProfit: number | null,
  sellPrice: number,
  quantity: number,
  rate: number,
  basis: "PROFIT" | "RETAIL_PRICE",
  type: "PERCENT" | "FIXED" = "PERCENT",
): number {
  if (netProfit === null) return 0
  if (type === "FIXED") return rate * quantity
  if (basis === "PROFIT") return netProfit * rate
  return sellPrice * quantity * rate
}
