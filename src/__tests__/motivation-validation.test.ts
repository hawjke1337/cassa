import { describe, it, expect } from "vitest"
import { commissionRuleSchema } from "@/lib/validations/motivation"

describe("commissionRuleSchema — rate validation (DATA-07)", () => {
  it("rejects PERCENT rate > 1", () => {
    const result = commissionRuleSchema.safeParse({
      type: "PERCENT",
      rate: 1.5,
      basis: "PROFIT",
    })
    expect(result.success).toBe(false)
  })

  it("accepts PERCENT rate = 0.1", () => {
    const result = commissionRuleSchema.safeParse({
      type: "PERCENT",
      rate: 0.1,
      basis: "PROFIT",
    })
    expect(result.success).toBe(true)
  })

  it("accepts PERCENT rate = 1 (100%)", () => {
    const result = commissionRuleSchema.safeParse({
      type: "PERCENT",
      rate: 1,
      basis: "PROFIT",
    })
    expect(result.success).toBe(true)
  })

  it("rejects FIXED rate > 100000", () => {
    const result = commissionRuleSchema.safeParse({
      type: "FIXED",
      rate: 200000,
      basis: "PROFIT",
    })
    expect(result.success).toBe(false)
  })

  it("accepts FIXED rate = 500", () => {
    const result = commissionRuleSchema.safeParse({
      type: "FIXED",
      rate: 500,
      basis: "RETAIL_PRICE",
    })
    expect(result.success).toBe(true)
  })

  it("rejects negative rate", () => {
    const result = commissionRuleSchema.safeParse({
      type: "PERCENT",
      rate: -0.1,
      basis: "PROFIT",
    })
    expect(result.success).toBe(false)
  })
})
