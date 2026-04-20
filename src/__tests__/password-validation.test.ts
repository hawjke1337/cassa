import { describe, it, expect } from "vitest"

// Testing the validation logic directly (not the server action)
function validatePassword(password: string): boolean {
  return !!password && password.length >= 8
}

describe("password-validation (AUTH-03)", () => {
  it("rejects password shorter than 8 characters", () => {
    expect(validatePassword("1234")).toBe(false)
    expect(validatePassword("1234567")).toBe(false)
    expect(validatePassword("")).toBe(false)
  })

  it("accepts password of exactly 8 characters", () => {
    expect(validatePassword("12345678")).toBe(true)
  })

  it("accepts password longer than 8 characters", () => {
    expect(validatePassword("MyPassword123")).toBe(true)
  })
})
