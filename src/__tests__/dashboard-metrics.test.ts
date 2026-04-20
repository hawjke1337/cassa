import { describe, it, expect } from "vitest"

/**
 * Helper: calculate margin from profit and revenue.
 * This mirrors the logic used in dashboard-content.tsx and dashboard.ts.
 */
export function calculateMargin(profit: number, revenue: number): number {
  if (revenue === 0) return 0
  return (profit / revenue) * 100
}

describe("dashboard metrics -- margin calculation", () => {
  it("calculates margin correctly for positive revenue", () => {
    // revenue=1000, cogs=600 => profit=400 => margin=40%
    const profit = 400
    const revenue = 1000
    expect(calculateMargin(profit, revenue)).toBe(40)
  })

  it("returns 0 margin when revenue is 0", () => {
    expect(calculateMargin(0, 0)).toBe(0)
  })

  it("handles negative profit", () => {
    // revenue=100, cogs=150 => profit=-50 => margin=-50%
    const profit = -50
    const revenue = 100
    expect(calculateMargin(profit, revenue)).toBe(-50)
  })

  it("calculates high margin correctly", () => {
    // revenue=500, cogs=50 => profit=450 => margin=90%
    expect(calculateMargin(450, 500)).toBe(90)
  })
})
