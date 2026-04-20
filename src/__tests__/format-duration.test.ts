import { describe, it, expect } from "vitest"
import { formatDuration } from "@/lib/format"

describe("formatDuration", () => {
  it("returns 0м for 0 minutes", () => {
    expect(formatDuration(0)).toBe("0м")
  })

  it("returns 45м for 45 minutes", () => {
    expect(formatDuration(45)).toBe("45м")
  })

  it("returns 1ч for exactly 60 minutes", () => {
    expect(formatDuration(60)).toBe("1ч")
  })

  it("returns 1ч 30м for 90 minutes", () => {
    expect(formatDuration(90)).toBe("1ч 30м")
  })

  it("returns 2ч 5м for 125 minutes", () => {
    expect(formatDuration(125)).toBe("2ч 5м")
  })
})
