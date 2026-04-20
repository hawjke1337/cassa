import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const srcDir = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(srcDir, relativePath), "utf-8")
}

describe("Stock locking: SELECT FOR UPDATE in actions", () => {
  describe("sales.ts - createSale", () => {
    const source = readSource("actions/sales.ts")

    it("uses FOR UPDATE when reading stock in createSale", () => {
      expect(source).toContain("FOR UPDATE")
    })

    it("calls getNextNumber with tx inside transaction", () => {
      // getNextNumber("S", tx) should be inside $transaction
      expect(source).toMatch(/getNextNumber\("S",\s*tx\)/)
    })

    it("does NOT call getNextNumber before $transaction for sales", () => {
      // The old pattern: getNextNumber("S") on its own line before $transaction
      // Should NOT exist anymore
      const lines = source.split("\n")
      const saleNumberLine = lines.findIndex(
        (l) => l.includes('getNextNumber("S")') && !l.includes("tx")
      )
      // Should be -1 (not found) or only inside comments
      if (saleNumberLine !== -1) {
        const line = lines[saleNumberLine].trim()
        expect(line.startsWith("//") || line.startsWith("*")).toBe(true)
      }
    })
  })

  describe("sales.ts - createReturn", () => {
    const source = readSource("actions/sales.ts")

    it("calls getNextNumber with tx for returns", () => {
      expect(source).toMatch(/getNextNumber\("R",\s*tx\)/)
    })

    it("uses FOR UPDATE before incrementing stock on return", () => {
      // FOR UPDATE should appear in createReturn context
      // We verify at least 2 FOR UPDATE occurrences (createSale + createReturn)
      const matches = source.match(/FOR UPDATE/g) || []
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("inventory.ts - confirmReceive", () => {
    const source = readSource("actions/inventory.ts")

    it("uses FOR UPDATE in confirmReceive for non-serialized products", () => {
      expect(source).toContain("FOR UPDATE")
    })

    it("passes tx to getNextNumber calls inside transactions", () => {
      // At least some getNextNumber calls should pass tx
      expect(source).toMatch(/getNextNumber\([^)]+,\s*tx\)/)
    })
  })

  describe("shifts.ts", () => {
    const source = readSource("actions/shifts.ts")

    it("passes tx to getNextNumber", () => {
      expect(source).toMatch(/getNextNumber\("SH",\s*tx\)/)
    })
  })

  describe("orders.ts", () => {
    const source = readSource("actions/orders.ts")

    it("passes tx to getNextNumber for custom orders", () => {
      expect(source).toMatch(/getNextNumber\("CO",\s*tx\)/)
    })
  })
})

describe("Stock validation logic", () => {
  it("validates that stock check happens before decrement", () => {
    const source = readSource("actions/sales.ts")
    const forUpdatePos = source.indexOf("FOR UPDATE")
    const decrementPos = source.indexOf("decrement: ri.quantity")

    // FOR UPDATE must appear before decrement in createSale
    expect(forUpdatePos).toBeGreaterThan(-1)
    expect(decrementPos).toBeGreaterThan(-1)
    expect(forUpdatePos).toBeLessThan(decrementPos)
  })

  it("validates stockMap pattern exists for batch locking", () => {
    const source = readSource("actions/sales.ts")
    expect(source).toContain("stockMap")
  })
})
