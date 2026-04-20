import { describe, it, expect } from "vitest"
import { validateDiscountAmount } from "@/lib/order-utils"

describe("validateDiscountAmount (ORD-07)", () => {
  it("accepts zero discount", () => {
    expect(validateDiscountAmount(0, 10000)).toEqual({ valid: true })
  })

  it("accepts valid discount", () => {
    expect(validateDiscountAmount(5000, 10000)).toEqual({ valid: true })
  })

  it("rejects negative discount", () => {
    const result = validateDiscountAmount(-100, 10000)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("rejects discount exceeding total", () => {
    const result = validateDiscountAmount(15000, 10000)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })
})
