import { describe, it, expect } from "vitest"
import { createSaleSchema } from "@/lib/validations/sales"

describe("createSaleSchema", () => {
  it("does NOT accept price field from client (SEC-01)", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 1, discount: 0, price: 999 }],
      payments: [{ method: "CASH" as const, amount: 100 }],
    }
    const result = createSaleSchema.safeParse(input)
    // price field should be stripped (not in schema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data.items[0] as any).price).toBeUndefined()
    }
  })

  it("does NOT accept costPrice field from client (SEC-02)", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 1, discount: 0, costPrice: 50 }],
      payments: [{ method: "CASH" as const, amount: 100 }],
    }
    const result = createSaleSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data.items[0] as any).costPrice).toBeUndefined()
    }
  })

  it("rejects negative discount (SEC-03)", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 1, discount: -10 }],
      payments: [{ method: "CASH" as const, amount: 100 }],
    }
    const result = createSaleSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("rejects non-integer quantity (SEC-04)", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 1.5, discount: 0 }],
      payments: [{ method: "CASH" as const, amount: 100 }],
    }
    const result = createSaleSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("rejects quantity <= 0 (SEC-04)", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 0, discount: 0 }],
      payments: [{ method: "CASH" as const, amount: 100 }],
    }
    const result = createSaleSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("accepts valid sale input", () => {
    const input = {
      storeId: "store-1",
      items: [{ productId: "p1", quantity: 2, discount: 10 }],
      payments: [{ method: "CASH" as const, amount: 200 }],
    }
    const result = createSaleSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})
