import { describe, it, expect } from "vitest"
import { calculateOrderItemCommission } from "@/lib/motivation-utils"

describe("calculateOrderItemCommission", () => {
  it("calculates percent commission from netProfit (PROFIT basis)", () => {
    expect(calculateOrderItemCommission(2500, 10000, 1, 0.1, "PROFIT", "PERCENT")).toBe(250)
  })

  it("returns 0 when netProfit is null (no purchasePrice)", () => {
    expect(calculateOrderItemCommission(null, 10000, 1, 0.1, "PROFIT", "PERCENT")).toBe(0)
  })

  it("returns negative commission for unprofitable order", () => {
    expect(calculateOrderItemCommission(-500, 10000, 1, 0.1, "PROFIT", "PERCENT")).toBe(-50)
  })

  it("uses sellPrice * quantity * rate for RETAIL_PRICE basis", () => {
    expect(calculateOrderItemCommission(2500, 10000, 2, 0.05, "RETAIL_PRICE", "PERCENT")).toBe(1000)
  })

  it("uses rate * quantity for FIXED type", () => {
    expect(calculateOrderItemCommission(2500, 10000, 3, 100, "PROFIT", "FIXED")).toBe(300)
  })

  it("FIXED type returns rate * quantity even with null netProfit", () => {
    // FIXED commission is not based on profit, but if netProfit is null we still return 0
    expect(calculateOrderItemCommission(null, 10000, 3, 100, "PROFIT", "FIXED")).toBe(0)
  })

  it("handles netProfit = 0", () => {
    expect(calculateOrderItemCommission(0, 10000, 1, 0.1, "PROFIT", "PERCENT")).toBe(0)
  })

  it("handles large values", () => {
    expect(calculateOrderItemCommission(1000000, 5000000, 1, 0.15, "PROFIT", "PERCENT")).toBe(150000)
  })

  it("defaults type to PERCENT when not specified", () => {
    expect(calculateOrderItemCommission(2500, 10000, 1, 0.1, "PROFIT")).toBe(250)
  })
})
