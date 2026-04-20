import { describe, it, expect } from "vitest"
import { mskStartOfDay, mskEndOfDay, toMskDateRange, mskToday } from "../timezone"

describe("MSK timezone utilities", () => {
  it("mskStartOfDay converts April 14 MSK midnight to April 13 21:00 UTC", () => {
    const date = new Date(2026, 3, 14) // April 14, 2026
    const result = mskStartOfDay(date)
    expect(result.toISOString()).toBe("2026-04-13T21:00:00.000Z")
  })

  it("mskEndOfDay converts April 14 MSK 23:59:59 to April 14 20:59:59 UTC", () => {
    const date = new Date(2026, 3, 14)
    const result = mskEndOfDay(date)
    expect(result.toISOString()).toBe("2026-04-14T20:59:59.999Z")
  })

  it("handles year boundary: Jan 1 MSK midnight = Dec 31 21:00 UTC", () => {
    const date = new Date(2026, 0, 1) // Jan 1, 2026
    const result = mskStartOfDay(date)
    expect(result.toISOString()).toBe("2025-12-31T21:00:00.000Z")
  })

  it("handles month boundary: Mar 1 MSK midnight = Feb 28 21:00 UTC", () => {
    const date = new Date(2026, 2, 1) // Mar 1, 2026
    const result = mskStartOfDay(date)
    expect(result.toISOString()).toBe("2026-02-28T21:00:00.000Z")
  })

  it("mskEndOfDay at month boundary: Jan 31 MSK end = Jan 31 20:59 UTC", () => {
    const date = new Date(2026, 0, 31) // Jan 31, 2026
    const result = mskEndOfDay(date)
    expect(result.toISOString()).toBe("2026-01-31T20:59:59.999Z")
  })

  it("toMskDateRange returns correct gte/lte pair for single day", () => {
    const from = new Date(2026, 3, 14)
    const to = new Date(2026, 3, 14)
    const range = toMskDateRange(from, to)
    expect(range.gte.toISOString()).toBe("2026-04-13T21:00:00.000Z")
    expect(range.lte.toISOString()).toBe("2026-04-14T20:59:59.999Z")
  })

  it("toMskDateRange returns correct range for multi-day span", () => {
    const from = new Date(2026, 3, 14) // Apr 14
    const to = new Date(2026, 3, 16) // Apr 16
    const range = toMskDateRange(from, to)
    expect(range.gte.toISOString()).toBe("2026-04-13T21:00:00.000Z")
    expect(range.lte.toISOString()).toBe("2026-04-16T20:59:59.999Z")
  })

  it("mskToday returns a valid range for current day", () => {
    const today = mskToday()
    expect(today.gte).toBeInstanceOf(Date)
    expect(today.lte).toBeInstanceOf(Date)
    expect(today.gte < today.lte).toBe(true)
    // Range should be exactly 24h - 1ms
    const diffMs = today.lte.getTime() - today.gte.getTime()
    expect(diffMs).toBe(24 * 60 * 60 * 1000 - 1)
  })
})
