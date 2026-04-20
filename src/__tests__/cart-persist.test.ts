import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const cartSource = readFileSync(join(__dirname, "..", "hooks", "use-cart.ts"), "utf-8")

describe("Cart persist configuration", () => {
  it("uses zustand persist middleware", () => {
    expect(cartSource).toMatch(
      /import\s*\{[^}]*persist[^}]*\}\s*from\s*["']zustand\/middleware["']/,
    )
  })

  it("wraps store with persist middleware", () => {
    expect(cartSource).toMatch(/create\s*<\s*CartState\s*>\(\)\(\s*persist\(/)
  })

  it("has persist name 'astore-pos-cart'", () => {
    expect(cartSource).toContain('name: "astore-pos-cart"')
  })

  it("has persist version 1", () => {
    expect(cartSource).toContain("version: 1")
  })
})
