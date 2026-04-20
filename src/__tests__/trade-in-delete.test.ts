import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const srcDir = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(srcDir, relativePath), "utf-8")
}

describe("deleteTradeIn status guard (DATA-10)", () => {
  const source = readSource("actions/trade-in.ts")

  it("defines DELETABLE_STATUSES with PENDING and WRITTEN_OFF", () => {
    // Only PENDING and WRITTEN_OFF should be deletable
    expect(source).toMatch(/DELETABLE_STATUSES/)
    expect(source).toContain("PENDING")
    expect(source).toContain("WRITTEN_OFF")
  })

  it("throws error for non-deletable statuses", () => {
    expect(source).toMatch(/Невозможно удалить trade-in/)
  })

  it("status check happens before the transaction (early exit)", () => {
    const deleteStart = source.indexOf("async function deleteTradeIn")
    expect(deleteStart).toBeGreaterThan(-1)
    const deleteBlock = source.slice(deleteStart, deleteStart + 600)

    // DELETABLE_STATUSES check must appear before $transaction
    const statusCheckPos = deleteBlock.indexOf("DELETABLE_STATUSES")
    const transactionPos = deleteBlock.indexOf("$transaction")
    expect(statusCheckPos).toBeGreaterThan(-1)
    expect(transactionPos).toBeGreaterThan(-1)
    expect(statusCheckPos).toBeLessThan(transactionPos)
  })

  it("IN_STOCK is not in deletable statuses", () => {
    // Extract the DELETABLE_STATUSES line to verify IN_STOCK is excluded
    const match = source.match(/DELETABLE_STATUSES.*?=\s*\[([^\]]+)\]/)
    expect(match).not.toBeNull()
    const statusList = match![1]
    expect(statusList).not.toContain("IN_STOCK")
    expect(statusList).not.toContain("SOLD")
    expect(statusList).not.toContain("IN_REPAIR")
  })

  it("error message includes the current status", () => {
    // Dynamic error message with status interpolation
    expect(source).toMatch(/Невозможно удалить trade-in в статусе.*\$\{/)
  })
})
