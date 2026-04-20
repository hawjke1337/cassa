/**
 * Unit tests: Trade-In edge cases (INV-07, INV-09, UX2-11)
 *
 * - INV-07: agreedPrice=0 allowed without CashOperation payout
 * - INV-09: Trade-in can be created with status IN_STOCK or PENDING
 * - UX2-11: form schema has single agreedPrice field (no estimatedPrice)
 */
import { describe, it, expect } from "vitest"

describe("INV-07: Trade-in agreedPrice=0", () => {
  it.todo("agreedPrice=0 не блокирует создание")
  it.todo("agreedPrice=0 не создаёт CashOperation(WITHDRAW)")
  it.todo("помечается как 'Бесплатный приём' в UI/reports")
})

describe("INV-09: Trade-in status choice", () => {
  it.todo("создаётся с initialStatus=IN_STOCK")
  it.todo("создаётся с initialStatus=PENDING (default)")
})

describe("UX2-11: Single price field", () => {
  it.todo("form schema содержит только agreedPrice")
  it.todo("estimatedPrice не является обязательным полем input")
})
