import { describe, it, expect } from "vitest"
import { weightedAvgCostPrice } from "@/lib/inventory-utils"

describe("weightedAvgCostPrice", () => {
  it("calculates weighted average for mixed batches (DATA-03)", () => {
    // 5 units at 80 + 10 units at 100 = (5*80 + 10*100) / 15 = 1400/15 = 93.33
    expect(weightedAvgCostPrice(5, 80, 10, 100)).toBe(93.33)
  })

  it("returns receiveCostPrice on first receive (oldQty=0)", () => {
    expect(weightedAvgCostPrice(0, 0, 10, 100)).toBe(100)
  })

  it("returns same price when both batches have equal cost", () => {
    expect(weightedAvgCostPrice(100, 50, 100, 50)).toBe(50)
  })

  it("rounds to 2 decimal places", () => {
    // (1*999.99 + 1*0.01) / 2 = 1000/2 = 500.00
    expect(weightedAvgCostPrice(1, 999.99, 1, 0.01)).toBe(500)
  })
})
