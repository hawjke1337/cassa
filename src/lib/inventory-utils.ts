/** Средневзвешенная costPrice при приемке */
export function weightedAvgCostPrice(
  oldQty: number,
  oldCostPrice: number,
  receiveQty: number,
  receiveCostPrice: number,
): number {
  if (oldQty === 0) return +receiveCostPrice.toFixed(2)
  return +(
    (oldQty * oldCostPrice + receiveQty * receiveCostPrice) /
    (oldQty + receiveQty)
  ).toFixed(2)
}

/** Fallback sellPrice для серийных товаров: costPrice * 1.3 если sellPrice = 0 */
export function sellPriceFallback(
  currentSellPrice: number,
  costPrice: number,
): number {
  if (currentSellPrice > 0) return currentSellPrice
  return +(costPrice * 1.3).toFixed(2)
}
