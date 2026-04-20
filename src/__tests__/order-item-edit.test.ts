import { describe, it, expect } from "vitest"
import { calculateOrderTotalAmount } from "@/lib/order-utils"

describe("calculateOrderTotalAmount (ORD-08)", () => {
  it("calculates total from items", () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 200, quantity: 1 },
    ]
    expect(calculateOrderTotalAmount(items)).toBe(400)
  })

  it("recalculates after price change", () => {
    const items = [
      { price: 150, quantity: 2 },
      { price: 200, quantity: 1 },
    ]
    expect(calculateOrderTotalAmount(items)).toBe(500)
  })

  it("returns 0 for empty items", () => {
    expect(calculateOrderTotalAmount([])).toBe(0)
  })
})
