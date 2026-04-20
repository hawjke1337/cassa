import { describe, it, expect } from "vitest"
import { calculateItemCommission } from "@/lib/motivation-utils"

describe("calculateItemCommission — partial return per-item deduction (DATA-06)", () => {
  // sellPrice=1000, costPrice=500, rate=0.1, PERCENT, PROFIT
  // commission = (sellPrice - costPrice) * quantity * rate

  it("calculates full commission for 3 items", () => {
    // (1000 - 500) * 3 * 0.1 = 150
    expect(calculateItemCommission(1000, 500, 3, 0.1, "PROFIT", "PERCENT")).toBe(150)
  })

  it("calculates commission for 2 items after partial return of 1", () => {
    // (1000 - 500) * 2 * 0.1 = 100
    expect(calculateItemCommission(1000, 500, 2, 0.1, "PROFIT", "PERCENT")).toBe(100)
  })

  it("returns 0 commission when quantity is 0 (full return)", () => {
    expect(calculateItemCommission(1000, 500, 0, 0.1, "PROFIT", "PERCENT")).toBe(0)
  })

  it("calculates FIXED commission per item", () => {
    // rate * quantity = 200 * 3 = 600
    expect(calculateItemCommission(1000, 500, 3, 200, "PROFIT", "FIXED")).toBe(600)
  })

  it("calculates RETAIL_PRICE basis commission", () => {
    // sellPrice * quantity * rate = 1000 * 3 * 0.05 = 150
    expect(calculateItemCommission(1000, 500, 3, 0.05, "RETAIL_PRICE", "PERCENT")).toBe(150)
  })
})
