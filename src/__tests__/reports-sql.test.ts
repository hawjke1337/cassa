import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mock setup ---

const mockAggregate = vi.fn()
const mockGroupBy = vi.fn()
const mockQueryRaw = vi.fn()
const mockFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    sale: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    payment: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    stockWriteOff: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user1" } }),
}))

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn().mockResolvedValue(undefined),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/stock-helpers", () => ({
  getSerializedCounts: vi.fn().mockResolvedValue({}),
}))

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

describe("getSalesReport -- SQL optimization", () => {
  it("uses aggregate instead of findMany for summary", async () => {
    // Setup mocks
    mockAggregate.mockResolvedValue({
      _count: 5,
      _sum: {
        totalAmount: 50000,
        discountAmount: 2000,
        finalAmount: 48000,
      },
    })
    mockQueryRaw.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    const { getSalesReport } = await import("@/actions/reports")

    const result = await getSalesReport({
      storeId: "store1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })

    // aggregate was called (not findMany)
    expect(mockAggregate).toHaveBeenCalledTimes(1)
    // findMany should NOT be called for sales
    expect(mockFindMany).not.toHaveBeenCalled()

    // Verify response format matches expected interface
    expect(result).toHaveProperty("salesCount")
    expect(result).toHaveProperty("totalRevenue")
    expect(result).toHaveProperty("totalDiscount")
    expect(result).toHaveProperty("netRevenue")
    expect(result).toHaveProperty("avgCheck")
    expect(result).toHaveProperty("chartData")
    expect(result).toHaveProperty("paymentData")
    expect(result).toHaveProperty("topByQty")
    expect(result).toHaveProperty("topByRevenue")

    // Verify numeric values
    expect(result.salesCount).toBe(5)
    expect(result.totalRevenue).toBe(50000)
    expect(result.totalDiscount).toBe(2000)
    expect(result.netRevenue).toBe(48000)
    expect(result.avgCheck).toBe(9600)
  })

  it("uses $queryRaw for chart data and top products", async () => {
    mockAggregate.mockResolvedValue({
      _count: 0,
      _sum: { totalAmount: null, discountAmount: null, finalAmount: null },
    })
    mockQueryRaw.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    const { getSalesReport } = await import("@/actions/reports")

    await getSalesReport({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })

    // $queryRaw called for: chart data, top by qty, top by revenue = 3 times
    expect(mockQueryRaw).toHaveBeenCalledTimes(3)
  })

  it("uses payment.groupBy for payment breakdown", async () => {
    mockAggregate.mockResolvedValue({
      _count: 0,
      _sum: { totalAmount: null, discountAmount: null, finalAmount: null },
    })
    mockQueryRaw.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([
      { method: "CASH", _sum: { amount: 30000 } },
      { method: "CARD", _sum: { amount: 18000 } },
    ])

    const { getSalesReport } = await import("@/actions/reports")

    const result = await getSalesReport({
      storeId: "store1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })

    expect(mockGroupBy).toHaveBeenCalledTimes(1)
    expect(result.paymentData).toHaveLength(2)
    expect(result.paymentData[0]).toEqual({ method: "CASH", amount: 30000 })
  })
})

describe("getProfitReport -- SQL optimization", () => {
  it("uses aggregate and $queryRaw instead of findMany with include", async () => {
    mockAggregate.mockResolvedValue({
      _sum: { finalAmount: 100000 },
    })
    mockQueryRaw.mockResolvedValue([{ cogs: 60000 }])
    // Second $queryRaw call for category breakdown
    mockQueryRaw
      .mockResolvedValueOnce([{ cogs: 60000 }])
      .mockResolvedValueOnce([
        { name: "Телефоны", revenue: 80000, cogs: 48000 },
        { name: "Аксессуары", revenue: 20000, cogs: 12000 },
      ])
      .mockResolvedValueOnce([{ total: 5000 }])

    const { getProfitReport } = await import("@/actions/reports")

    const result = await getProfitReport({
      storeId: "store1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })

    // aggregate called for revenue
    expect(mockAggregate).toHaveBeenCalledTimes(1)
    // $queryRaw called for: COGS, category breakdown, write-offs = 3 times
    expect(mockQueryRaw).toHaveBeenCalledTimes(3)
    // findMany should NOT be called
    expect(mockFindMany).not.toHaveBeenCalled()

    // Verify response format
    expect(result).toHaveProperty("revenue")
    expect(result).toHaveProperty("cogs")
    expect(result).toHaveProperty("grossProfit")
    expect(result).toHaveProperty("grossMargin")
    expect(result).toHaveProperty("writeOffsTotal")
    expect(result).toHaveProperty("netProfit")
    expect(result).toHaveProperty("categoryBreakdown")

    // Verify values
    expect(result.revenue).toBe(100000)
    expect(result.cogs).toBe(60000)
    expect(result.grossProfit).toBe(40000)
    expect(result.writeOffsTotal).toBe(5000)
    expect(result.netProfit).toBe(35000)
    expect(result.categoryBreakdown).toHaveLength(2)
  })

  it("returns correct format for category breakdown", async () => {
    mockAggregate.mockResolvedValue({
      _sum: { finalAmount: 50000 },
    })
    mockQueryRaw
      .mockResolvedValueOnce([{ cogs: 30000 }])
      .mockResolvedValueOnce([{ name: "Телефоны", revenue: 50000, cogs: 30000 }])
      .mockResolvedValueOnce([{ total: 0 }])

    const { getProfitReport } = await import("@/actions/reports")

    const result = await getProfitReport({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    })

    const cat = result.categoryBreakdown[0]
    expect(cat).toHaveProperty("name")
    expect(cat).toHaveProperty("revenue")
    expect(cat).toHaveProperty("cogs")
    expect(cat).toHaveProperty("profit")
    expect(cat).toHaveProperty("margin")
    expect(cat.profit).toBe(20000)
    expect(cat.margin).toBe(40)
  })
})
