import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit"

describe("rate-limit", () => {
  beforeEach(() => {
    clearAttempts("testuser")
  })

  it("allows first attempt", () => {
    const result = checkRateLimit("testuser")
    expect(result.allowed).toBe(true)
  })

  it("blocks after 5 failed attempts (AUTH-02)", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("testuser")
    }
    const result = checkRateLimit("testuser")
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("allows 4 failed attempts without blocking", () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt("testuser")
    }
    const result = checkRateLimit("testuser")
    expect(result.allowed).toBe(true)
  })

  it("resets counter on clearAttempts", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("testuser")
    }
    clearAttempts("testuser")
    const result = checkRateLimit("testuser")
    expect(result.allowed).toBe(true)
  })

  it("isolates different usernames", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("user-a")
    }
    const resultA = checkRateLimit("user-a")
    const resultB = checkRateLimit("user-b")
    expect(resultA.allowed).toBe(false)
    expect(resultB.allowed).toBe(true)
  })
})
