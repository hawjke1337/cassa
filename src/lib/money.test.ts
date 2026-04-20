/**
 * Тесты для Decimal-арифметики денежных операций.
 *
 * Главная цель: доказать, что сложение/умножение через helpers
 * НЕ теряет точность на 1000+ операциях (в отличие от float).
 *
 * Это фундамент phase 07 — без precision-proof нельзя мигрировать
 * hotspot-файлы на Decimal.
 */

import { describe, it, expect } from "vitest"
import Decimal from "decimal.js"
import {
  toMoney,
  sum,
  sub,
  mul,
  div,
  toClient,
  fromClient,
  isMoney,
  calcBankingFee,
  type Money,
} from "@/lib/money"

describe("money.ts — Decimal foundation", () => {
  describe("toMoney", () => {
    it("парсит строку '1499.99'", () => {
      expect(toMoney("1499.99").toString()).toBe("1499.99")
    })

    it("парсит число 0", () => {
      expect(toMoney(0).toString()).toBe("0")
    })

    it("принимает существующий Decimal", () => {
      const d = new Decimal("100.50")
      expect(toMoney(d).toString()).toBe("100.5")
    })

    it("кидает ошибку на невалидной строке", () => {
      expect(() => toMoney("not-a-number")).toThrow()
    })
  })

  describe("sum — precision proof", () => {
    it("0.1 + 0.2 === 0.3 (float-arithmetic сломалась бы)", () => {
      expect(sum("0.1", "0.2").equals(new Decimal("0.3"))).toBe(true)
    })

    it("1000 операций +0.01 === 10.00 (no float drift)", () => {
      const values = Array(1000).fill("0.01")
      expect(sum(...values).equals(new Decimal("10"))).toBe(true)
    })

    it("пустой sum() === 0", () => {
      expect(sum().equals(new Decimal(0))).toBe(true)
    })

    it("sum трёх чисел", () => {
      expect(sum("100.50", "200.25", "50.75").toString()).toBe("351.5")
    })

    it("1000 итераций motivation-формулы: 1499.99 * 0.005 накапливается до 7499.95", () => {
      let total: Decimal = toMoney("0")
      for (let i = 0; i < 1000; i++) {
        total = sum(total, mul("1499.99", "0.005"))
      }
      expect(total.equals(new Decimal("7499.95"))).toBe(true)
    })
  })

  describe("sub", () => {
    it("100.00 - 0.30 === 99.7", () => {
      expect(sub("100.00", "0.30").toString()).toBe("99.7")
    })

    it("1.00 - 0.10 === 0.9", () => {
      expect(sub("1.00", "0.10").equals(new Decimal("0.9"))).toBe(true)
    })
  })

  describe("mul — motivation formulas", () => {
    it("1499.99 * 0.005 === 7.49995 (0.5% commission)", () => {
      expect(mul("1499.99", "0.005").toString()).toBe("7.49995")
    })

    it("100 * 3 === 300", () => {
      expect(mul("100", 3).toString()).toBe("300")
    })
  })

  describe("div", () => {
    it("100 / 4 === 25", () => {
      expect(div("100", 4).toString()).toBe("25")
    })

    it("100.00 / 3 начинается с 33.33...", () => {
      expect(div("100.00", 3).toString().startsWith("33.33")).toBe(true)
    })
  })

  describe("branded type Money", () => {
    it("toClient возвращает строку 2 знака после запятой", () => {
      const money: Money = toClient(new Decimal("1499.99"))
      expect(money).toBe("1499.99")
    })

    it("toClient округляет до 2 знаков", () => {
      const money: Money = toClient(new Decimal("7.49995"))
      expect(money).toBe("7.50")
    })

    it("fromClient парсит Money обратно в Decimal", () => {
      expect(fromClient("1499.99" as Money).toString()).toBe("1499.99")
    })

    it("isMoney всегда false на raw строке (brand не существует в runtime)", () => {
      expect(isMoney("1499.99")).toBe(false)
    })
  })

  describe("calcBankingFee — обратный процент", () => {
    it("10000 при ставке 2% → fee=204.08, total=10204.08", () => {
      const result = calcBankingFee(10000, 0.02)
      expect(result.fee.toString()).toBe("204.08")
      expect(result.total.toString()).toBe("10204.08")
    })

    it("10000 при ставке 0% → fee=0, total=10000", () => {
      const result = calcBankingFee(10000, 0)
      expect(result.fee.toString()).toBe("0")
      expect(result.total.toString()).toBe("10000")
    })

    it("10000 при ставке 0.7% → fee=70.49, total=10070.49", () => {
      const result = calcBankingFee(10000, 0.007)
      expect(result.fee.toString()).toBe("70.49")
      expect(result.total.toString()).toBe("10070.49")
    })

    it("10000 при ставке 3% → fee=309.28, total=10309.28", () => {
      const result = calcBankingFee(10000, 0.03)
      expect(result.fee.toString()).toBe("309.28")
      expect(result.total.toString()).toBe("10309.28")
    })

    it("0 при ставке 2% → fee=0, total=0", () => {
      const result = calcBankingFee(0, 0.02)
      expect(result.fee.toString()).toBe("0")
      expect(result.total.toString()).toBe("0")
    })

    it("rate >= 1 → throws", () => {
      expect(() => calcBankingFee(100, 1)).toThrow("rate must be less than 1")
    })

    it("rate > 1 → throws", () => {
      expect(() => calcBankingFee(100, 1.5)).toThrow("rate must be less than 1")
    })
  })

  describe("custom matcher toEqualDecimal", () => {
    it("matches '0.30' и '0.3' как равные", () => {
      expect(new Decimal("0.30")).toEqualDecimal("0.3")
    })

    it("matches через Decimal инстанс", () => {
      expect(new Decimal("0.30")).toEqualDecimal(new Decimal("0.3"))
    })

    it("sum precision через matcher", () => {
      expect(sum("0.1", "0.2")).toEqualDecimal("0.3")
    })
  })
})
