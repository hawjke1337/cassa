import { describe, it, expect } from "vitest"
import { validateOrderCostsInput } from "@/lib/order-utils"

describe("validateOrderCostsInput (ORD-02)", () => {
  it("accepts valid costs input", () => {
    const result = validateOrderCostsInput({
      purchasePrice: 7000,
      deliveryCost: 500,
      orderStatus: "COMPLETED",
    })
    expect(result.valid).toBe(true)
  })

  it("rejects when order is not COMPLETED", () => {
    const result = validateOrderCostsInput({
      purchasePrice: 7000,
      deliveryCost: 500,
      orderStatus: "NEW",
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("завершения")
  })

  it("rejects purchasePrice <= 0", () => {
    const result = validateOrderCostsInput({
      purchasePrice: 0,
      deliveryCost: 500,
      orderStatus: "COMPLETED",
    })
    expect(result.valid).toBe(false)
  })

  it("rejects negative purchasePrice", () => {
    const result = validateOrderCostsInput({
      purchasePrice: -100,
      deliveryCost: 500,
      orderStatus: "COMPLETED",
    })
    expect(result.valid).toBe(false)
  })

  it("accepts without deliveryCost", () => {
    const result = validateOrderCostsInput({
      purchasePrice: 7000,
      orderStatus: "COMPLETED",
    })
    expect(result.valid).toBe(true)
  })

  it("rejects negative deliveryCost", () => {
    const result = validateOrderCostsInput({
      purchasePrice: 7000,
      deliveryCost: -100,
      orderStatus: "COMPLETED",
    })
    expect(result.valid).toBe(false)
  })
})
