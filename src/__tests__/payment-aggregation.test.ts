/**
 * Unit tests for UX2-15: Payment aggregation by method.
 *
 * Verifies that aggregatePaymentsByMethod correctly groups payments,
 * preserves canonical method order, isolates TRADE_IN, and handles
 * floating-point edge cases.
 */
import { describe, it, expect } from "vitest"
import { aggregatePaymentsByMethod, formatSerialCode } from "@/lib/receipts"

describe("UX2-15: aggregatePaymentsByMethod", () => {
  it("группирует 3 CASH-платежа в одну запись", () => {
    const result = aggregatePaymentsByMethod([
      { method: "CASH", amount: 25000 },
      { method: "CASH", amount: 30000 },
      { method: "CASH", amount: 20000 },
    ])
    expect(result).toEqual([{ method: "CASH", amount: 75000 }])
  })

  it("разделяет TRADE_IN от обычных методов, но оставляет оба в ответе", () => {
    const result = aggregatePaymentsByMethod([
      { method: "CASH", amount: 10000 },
      { method: "TRADE_IN", amount: 5000 },
      { method: "CASH", amount: 5000 },
    ])
    expect(result).toEqual([
      { method: "CASH", amount: 15000 },
      { method: "TRADE_IN", amount: 5000 },
    ])
  })

  it("соблюдает фиксированный порядок: CASH, CARD, SBP, TRANSFER, CREDIT, TRADE_IN", () => {
    const result = aggregatePaymentsByMethod([
      { method: "CREDIT", amount: 100 },
      { method: "TRADE_IN", amount: 50 },
      { method: "CARD", amount: 200 },
      { method: "SBP", amount: 300 },
      { method: "TRANSFER", amount: 400 },
      { method: "CASH", amount: 500 },
    ])
    expect(result.map((r) => r.method)).toEqual([
      "CASH",
      "CARD",
      "SBP",
      "TRANSFER",
      "CREDIT",
      "TRADE_IN",
    ])
  })

  it("возвращает пустой массив для пустого input", () => {
    expect(aggregatePaymentsByMethod([])).toEqual([])
  })

  it("пропускает методы, которых нет в массиве (не создаёт нули)", () => {
    const result = aggregatePaymentsByMethod([{ method: "CARD", amount: 1000 }])
    expect(result).toEqual([{ method: "CARD", amount: 1000 }])
  })

  it("игнорирует неизвестные методы (fail-safe для будущих enum-расширений)", () => {
    const result = aggregatePaymentsByMethod([
      { method: "CASH", amount: 100 },
      { method: "UNKNOWN_METHOD", amount: 999 },
    ])
    expect(result).toEqual([{ method: "CASH", amount: 100 }])
  })

  it("округляет итог до 2 знаков (против float drift)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 в JS
    const result = aggregatePaymentsByMethod([
      { method: "CASH", amount: 0.1 },
      { method: "CASH", amount: 0.2 },
    ])
    expect(result).toEqual([{ method: "CASH", amount: 0.3 }])
  })

  it("игнорирует NaN / Infinity amounts", () => {
    const result = aggregatePaymentsByMethod([
      { method: "CASH", amount: 100 },
      { method: "CASH", amount: Number.NaN },
      { method: "CASH", amount: Number.POSITIVE_INFINITY },
    ])
    expect(result).toEqual([{ method: "CASH", amount: 100 }])
  })
})

describe("UX2-14: formatSerialCode", () => {
  it("dual-SIM: объединяет IMEI через запятую", () => {
    expect(formatSerialCode({ imei: "111", imei2: "222" })).toBe("111, 222")
  })

  it("single IMEI без IMEI2", () => {
    expect(formatSerialCode({ imei: "123", imei2: null })).toBe("123")
  })

  it("serialNumber если нет IMEI", () => {
    expect(formatSerialCode({ imei: null, serialNumber: "SN-42" })).toBe("SN-42")
  })

  it("прочерк для товара без серийного кода", () => {
    expect(formatSerialCode({})).toBe("—")
    expect(formatSerialCode({ imei: null, imei2: null, serialNumber: null })).toBe("—")
  })

  it("IMEI имеет приоритет над serialNumber", () => {
    expect(formatSerialCode({ imei: "IMEI1", serialNumber: "SN" })).toBe("IMEI1")
  })
})
