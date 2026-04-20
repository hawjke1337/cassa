import { describe, it, expect } from "vitest"
import { sellPriceFallback } from "@/lib/inventory-utils"

describe("sellPriceFallback", () => {
  it("returns costPrice * 1.3 when sellPrice is 0 (DATA-05)", () => {
    expect(sellPriceFallback(0, 1000)).toBe(1300)
  })

  it("keeps existing sellPrice when already set", () => {
    expect(sellPriceFallback(1500, 1000)).toBe(1500)
  })

  it("returns 0 when both sellPrice and costPrice are 0", () => {
    expect(sellPriceFallback(0, 0)).toBe(0)
  })
})
