import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const srcDir = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(srcDir, relativePath), "utf-8")
}

describe("Auto-close shift with expectedCash calculation (DATA-08)", () => {
  const source = readSource("actions/shifts.ts")

  it("exports calculateExpectedCash function", () => {
    expect(source).toContain("calculateExpectedCash")
    // Must be a reusable function, not just inline
    expect(source).toMatch(/(?:export\s+)?async function calculateExpectedCash/)
  })

  it("auto-close sets expectedCash via calculateExpectedCash", () => {
    // In the openShift auto-close block, expectedCash must be computed
    const autoCloseIdx = source.indexOf("AUTO_CLOSED")
    expect(autoCloseIdx).toBeGreaterThan(-1)
    // expectedCash should appear near AUTO_CLOSED
    const autoCloseBlock = source.slice(Math.max(0, autoCloseIdx - 500), autoCloseIdx + 500)
    expect(autoCloseBlock).toContain("expectedCash")
  })

  it("auto-close sets discrepancy to null (no actualCash)", () => {
    // When auto-closing, there's no closingCash so discrepancy must be null
    expect(source).toContain("discrepancy: null")
  })

  it("closeShift uses calculateExpectedCash for DRY", () => {
    // closeShift should call calculateExpectedCash instead of inline calculation
    const closeShiftStart = source.indexOf("async function closeShift")
    expect(closeShiftStart).toBeGreaterThan(-1)
    const closeShiftBlock = source.slice(closeShiftStart, closeShiftStart + 2000)
    expect(closeShiftBlock).toContain("calculateExpectedCash")
  })

  it("calculateExpectedCash takes shiftId, openingCash, and tx params", () => {
    expect(source).toMatch(/calculateExpectedCash\s*\(\s*\n?\s*shiftId/)
  })

  it("calculateExpectedCash aggregates cash income, expenses, deposits, withdrawals, refunds", () => {
    // The function must use payment.aggregate for cash flow components
    const fnStart = source.indexOf("function calculateExpectedCash")
    expect(fnStart).toBeGreaterThan(-1)
    const fnBlock = source.slice(fnStart, fnStart + 1500)
    expect(fnBlock).toContain("CASH")
    expect(fnBlock).toMatch(/aggregate/)
  })
})
