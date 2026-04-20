import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock must use inline factory (hoisted)
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}))

// Import after mock setup
import { getNextNumber } from "@/lib/counters"
import { db } from "@/lib/db"

const mockQueryRaw = db.$queryRaw as ReturnType<typeof vi.fn>

describe("getNextNumber", () => {
  const year = new Date().getFullYear()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: INSERT ON CONFLICT returns nothing, UPDATE RETURNING returns { current: 1 }
    mockQueryRaw
      .mockResolvedValueOnce([]) // INSERT ON CONFLICT DO NOTHING
      .mockResolvedValueOnce([{ current: 1 }]) // UPDATE ... RETURNING current
  })

  it("returns string in format prefix-year-000001 without tx (backward compat)", async () => {
    const result = await getNextNumber("S")
    expect(result).toBe(`S-${year}-000001`)
    // Should use db.$queryRaw (not a passed tx)
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it("returns different numbers on sequential calls", async () => {
    const result1 = await getNextNumber("S")

    // Reset for second call
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ current: 2 }])

    const result2 = await getNextNumber("S")
    expect(result1).toBe(`S-${year}-000001`)
    expect(result2).toBe(`S-${year}-000002`)
  })

  it("accepts optional tx parameter and uses it for queries", async () => {
    const mockTxQueryRaw = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ current: 5 }])

    const fakeTx = { $queryRaw: mockTxQueryRaw } as any

    const result = await getNextNumber("S", fakeTx)
    expect(result).toBe(`S-${year}-000005`)
    // Should use tx.$queryRaw, NOT db.$queryRaw
    expect(mockTxQueryRaw).toHaveBeenCalledTimes(2)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it("formats number with 6-digit zero-padded counter", async () => {
    mockQueryRaw.mockReset()
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ current: 42 }])

    const result = await getNextNumber("PR")
    expect(result).toBe(`PR-${year}-000042`)
  })
})
