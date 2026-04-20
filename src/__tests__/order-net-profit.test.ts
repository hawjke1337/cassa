import { describe, it, expect } from "vitest"
import { calculateNetProfit } from "@/lib/order-utils"

describe("calculateNetProfit", () => {
  it("calculates standard profit (ORD-03)", () => {
    expect(calculateNetProfit(10000, 0, 7000, 500)).toBe(2500)
  })

  it("calculates profit with discount", () => {
    expect(calculateNetProfit(10000, 1000, 7000, 500)).toBe(1500)
  })

  it("returns null when purchasePrice is null", () => {
    expect(calculateNetProfit(10000, 0, null, null)).toBeNull()
  })

  it("calculates profit without delivery cost", () => {
    expect(calculateNetProfit(10000, 0, 7000, null)).toBe(3000)
  })

  it("returns negative for unprofitable order", () => {
    expect(calculateNetProfit(5000, 0, 6000, 500)).toBe(-1500)
  })
})
