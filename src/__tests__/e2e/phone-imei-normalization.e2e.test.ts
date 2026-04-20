import { describe, it, expect } from "vitest"
import { normalizePhone, isValidPhone, normalizePhoneOrThrow } from "@/lib/phone-utils"
import { isValidImei, validateImeiOrThrow } from "@/lib/imei-utils"

describe("Phone & IMEI Normalization (E2E)", () => {
  describe("normalizePhone", () => {
    it("normalizes 89001234567 to +79001234567", () => {
      expect(normalizePhone("89001234567")).toBe("+79001234567")
    })

    it("normalizes +7(900)123-45-67 to +79001234567", () => {
      expect(normalizePhone("+7(900)123-45-67")).toBe("+79001234567")
    })

    it("normalizes 9001234567 (10 digits) to +79001234567", () => {
      expect(normalizePhone("9001234567")).toBe("+79001234567")
    })

    it("normalizes 79001234567 to +79001234567", () => {
      expect(normalizePhone("79001234567")).toBe("+79001234567")
    })

    it("normalizes 8 900 123 45 67 (with spaces) to +79001234567", () => {
      expect(normalizePhone("8 900 123 45 67")).toBe("+79001234567")
    })

    it("normalizes +7-900-123-45-67 (with dashes) to +79001234567", () => {
      expect(normalizePhone("+7-900-123-45-67")).toBe("+79001234567")
    })

    it("rejects empty string", () => {
      expect(normalizePhone("")).toBeNull()
    })

    it("rejects too short number (less than 10 digits)", () => {
      expect(normalizePhone("12345")).toBeNull()
    })

    it("rejects too long number", () => {
      expect(normalizePhone("890012345678")).toBeNull()
    })

    it("rejects non-numeric string", () => {
      expect(normalizePhone("abc")).toBeNull()
    })
  })

  describe("isValidPhone", () => {
    it("returns true for valid phone", () => {
      expect(isValidPhone("89001234567")).toBe(true)
    })

    it("returns false for invalid phone", () => {
      expect(isValidPhone("123")).toBe(false)
    })
  })

  describe("normalizePhoneOrThrow", () => {
    it("returns normalized phone for valid input", () => {
      expect(normalizePhoneOrThrow("89001234567")).toBe("+79001234567")
    })

    it("throws error with field name for invalid input", () => {
      expect(() => normalizePhoneOrThrow("123", "Телефон клиента")).toThrow(
        'Невалидный номер телефона в поле "Телефон клиента": 123',
      )
    })
  })

  describe("IMEI validation", () => {
    // Valid IMEI: 490154203237518 (passes Luhn)
    const VALID_IMEI = "490154203237518"
    // Invalid IMEI: change last digit to break Luhn
    const INVALID_IMEI = "490154203237519"

    it("accepts valid IMEI (passes Luhn check)", () => {
      expect(isValidImei(VALID_IMEI)).toBe(true)
    })

    it("rejects invalid IMEI (fails Luhn check)", () => {
      expect(isValidImei(INVALID_IMEI)).toBe(false)
    })

    it("rejects IMEI with wrong length", () => {
      expect(isValidImei("12345")).toBe(false)
    })

    it("rejects IMEI with non-digit characters", () => {
      expect(isValidImei("49015420323751A")).toBe(false)
    })
  })

  describe("validateImeiOrThrow", () => {
    const VALID_IMEI = "490154203237518"

    it("returns cleaned IMEI for valid input", () => {
      expect(validateImeiOrThrow(VALID_IMEI)).toBe(VALID_IMEI)
    })

    it("strips whitespace from IMEI", () => {
      expect(validateImeiOrThrow(" 490154203237518 ")).toBe(VALID_IMEI)
    })

    it("throws error with field name for invalid IMEI", () => {
      expect(() => validateImeiOrThrow("123456789012345", "IMEI устройства")).toThrow(
        "Невалидный IMEI устройства",
      )
    })
  })
})
