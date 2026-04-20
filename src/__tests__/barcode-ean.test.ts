import { describe, it, expect } from "vitest"
import { isValidEAN13 } from "@/lib/barcode"

describe("isValidEAN13", () => {
  it("returns true for valid EAN-13 (4006381333931)", () => {
    expect(isValidEAN13("4006381333931")).toBe(true)
  })

  it("returns false for wrong checksum (4006381333930)", () => {
    expect(isValidEAN13("4006381333930")).toBe(false)
  })

  it("returns false for 12 digits", () => {
    expect(isValidEAN13("123456789012")).toBe(false)
  })

  it("returns false for 14 digits", () => {
    expect(isValidEAN13("12345678901234")).toBe(false)
  })

  it("returns false for non-numeric string", () => {
    expect(isValidEAN13("abcdefghijklm")).toBe(false)
  })

  it("returns true for another valid EAN-13 (5901234123457)", () => {
    expect(isValidEAN13("5901234123457")).toBe(true)
  })
})
