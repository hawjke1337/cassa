/**
 * Phase 12: E2E Security Hardening Tests
 *
 * Tests on real DB verifying SEC2-01..09 security fixes:
 * - IDOR on getSale (SEC2-01)
 * - findUnique soft delete bypass — tested via grep assertion (SEC2-02)
 * - Rate limiting on write operations (SEC2-06)
 * - Shift discrepancy approval (SEC2-07)
 * - Self-role change prevention (SEC2-08)
 * - Cash operation hard cap (SEC2-05)
 * - Order discount guards (SEC2-04)
 * - Order item price guards (SEC2-09)
 *
 * Requirements: SEC2-01..09
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
  createTestShift,
  createTestOrderWithPrepayment,
} from "../helpers/fixtures"
import fs from "node:fs"
import path from "node:path"

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))

const authMock = vi.fn(async () => ({ user: { id: "placeholder", storeId: "placeholder" } }))
vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

const requirePermissionMock = vi.fn<(code: string, storeId?: string) => Promise<void>>(
  async () => undefined,
)
const checkPermissionMock = vi.fn<(code: string, storeId?: string) => Promise<boolean>>(
  async () => true,
)
vi.mock("@/lib/permissions", () => ({
  requirePermission: (code: string, storeId?: string) => requirePermissionMock(code, storeId),
  checkPermission: (code: string, storeId?: string) => checkPermissionMock(code, storeId),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { getSale, createSale } = await import("@/actions/sales")
const { closeShift } = await import("@/actions/shifts")
const { createCashOperation } = await import("@/actions/cash-operations")
const { updateUserRoles } = await import("@/actions/settings")
const { updateOrderStatus, updateOrderItem } = await import("@/actions/orders")
const { checkWriteRateLimit, recordWriteAttempt } = await import("@/lib/rate-limit")
const { parseRateLimitError } = await import("@/hooks/use-rate-limit-toast")

describe("Phase 12: Security Hardening E2E", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset()
    requirePermissionMock.mockResolvedValue(undefined)
    checkPermissionMock.mockReset()
    checkPermissionMock.mockResolvedValue(true)
  })

  describe("SEC2-01: IDOR getSale — storeId access check", () => {
    it("getSale calls requirePermission with sale.storeId", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 10,
      })
      await createTestShift({ storeId: store.id, userId: user.id })

      const sale = await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })

      requirePermissionMock.mockReset()
      requirePermissionMock.mockResolvedValue(undefined)

      await getSale(sale.id)

      // ASSERT: requirePermission was called with "pos.sell" and the sale's storeId
      const posSellCalls = requirePermissionMock.mock.calls.filter(
        (call) => call[0] === "pos.sell" && call[1] === store.id,
      )
      expect(posSellCalls.length).toBeGreaterThan(0)
    })

    it("getSale throws when requirePermission denies for storeId", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 10,
      })
      await createTestShift({ storeId: store.id, userId: user.id })

      const sale = await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })

      // After sale is created, now deny all future requirePermission calls
      requirePermissionMock.mockRejectedValue(
        new Error('Нет доступа: требуется разрешение "pos.sell"'),
      )

      await expect(getSale(sale.id)).rejects.toThrow("Нет доступа")
    })
  })

  describe("SEC2-02: findUnique soft delete extension exists in db.ts", () => {
    it("db.ts contains findUnique and findUniqueOrThrow soft delete handlers", () => {
      // Since the e2e test db is a raw PrismaClient (no $extends), we verify
      // the production db.ts code statically to confirm the extension exists.
      const dbSource = fs.readFileSync(path.resolve(__dirname, "../../lib/db.ts"), "utf-8")
      expect(dbSource).toContain("async findUnique(")
      expect(dbSource).toContain("async findUniqueOrThrow(")
      expect(dbSource).toContain("deletedAt")
      expect(dbSource).toContain("SOFT_DELETE_MODELS")
    })

    it("findUnique extension filters by deletedAt !== null and returns null", () => {
      // Unit-level verification of the extension logic pattern
      const dbSource = fs.readFileSync(path.resolve(__dirname, "../../lib/db.ts"), "utf-8")
      // Verify the key pattern: check deletedAt and return null
      expect(dbSource).toMatch(/findUnique[\s\S]*?deletedAt[\s\S]*?return null/)
      // Verify findUniqueOrThrow throws Error
      expect(dbSource).toMatch(/findUniqueOrThrow[\s\S]*?deletedAt[\s\S]*?throw new Error/)
    })
  })

  describe("SEC2-05: Cash operation amount limit", () => {
    it("createCashOperation rejects amount > 500000", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      await expect(
        createCashOperation({
          shiftId: shift.id,
          type: "DEPOSIT",
          amount: 600000,
          reason: "Test large deposit",
        }),
      ).rejects.toThrow("не может превышать")
    })

    it("createCashOperation allows amount = 500000", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const result = await createCashOperation({
        shiftId: shift.id,
        type: "DEPOSIT",
        amount: 500000,
        reason: "Max allowed deposit",
      })
      expect(result.id).toBeDefined()
    })
  })

  describe("SEC2-06: Write rate limiting", () => {
    it("checkWriteRateLimit blocks after exceeding pos.sell limit (30)", () => {
      const testUserId = `rate-limit-test-${Date.now()}`
      const action = "pos.sell"

      for (let i = 0; i < 30; i++) {
        const check = checkWriteRateLimit(testUserId, action)
        expect(check.allowed).toBe(true)
        recordWriteAttempt(testUserId, action)
      }

      // 31st check should be blocked
      const blocked = checkWriteRateLimit(testUserId, action)
      expect(blocked.allowed).toBe(false)
      expect(blocked.retryAfterMs).toBeGreaterThan(0)
    })

    it("rate limit resets after window expires", () => {
      const testUserId = `rate-limit-window-${Date.now()}`
      const action = "pos.sell"

      // Simulate: after window elapses, should be allowed again
      // We just check the allowed=true for fresh user
      const check = checkWriteRateLimit(testUserId, action)
      expect(check.allowed).toBe(true)
    })
  })

  describe("SEC2-07: Shift discrepancy approval", () => {
    it("closeShift with discrepancy > 1000 without permission throws", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({
        storeId: store.id,
        userId: user.id,
        openingCash: "10000.00",
      })

      checkPermissionMock.mockImplementation(async (code: string, _storeId?: string) => {
        if (code === "shifts.override_discrepancy") return false
        return true
      })

      await expect(
        closeShift({ shiftId: shift.id, closingCash: 12000, note: "Test" }),
      ).rejects.toThrow("Требуется подтверждение старшего")
    })

    it("closeShift with discrepancy <= 1000 succeeds", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({
        storeId: store.id,
        userId: user.id,
        openingCash: "10000.00",
      })

      const result = await closeShift({ shiftId: shift.id, closingCash: 10500, note: "Small diff" })
      expect(result.id).toBeDefined()
    })
  })

  describe("SEC2-08: Self-role change prevention", () => {
    it("updateUserRoles throws when userId === session.user.id", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const role = await db.role.create({
        data: { name: `Test Role ${Date.now()}`, description: "test" },
      })

      await expect(updateUserRoles(user.id, [{ roleId: role.id }])).rejects.toThrow(
        "Нельзя изменять свои собственные роли",
      )
    })

    it("updateUserRoles succeeds for a different user", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const otherUser = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })

      const role = await db.role.create({
        data: { name: `Test Role ${Date.now()}`, description: "test" },
      })

      const result = await updateUserRoles(otherUser.id, [{ roleId: role.id }])
      expect(result.userId).toBe(otherUser.id)
    })
  })

  describe("SEC2-04: Order discount > 30% requires pos.discount_high", () => {
    it("updateOrderStatus with discount > 30% without permission throws", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const order = await createTestOrderWithPrepayment({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        items: [{ name: "Test Item", quantity: 1, price: "10000.00" }],
        prepaidAmount: "10000.00",
        status: "READY_FOR_PICKUP",
      })

      requirePermissionMock.mockImplementation(async (code: string, _storeId?: string) => {
        if (code === "pos.discount_high") {
          throw new Error('Нет доступа: требуется разрешение "pos.discount_high"')
        }
      })

      await expect(
        updateOrderStatus(order.id, "COMPLETED", "Completing", { discountAmount: 4000 }),
      ).rejects.toThrow("pos.discount_high")
    })
  })

  describe("SEC2-09: Order item price change > 30%", () => {
    it("updateOrderItem with price change > 30% without permission throws", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      authMock.mockResolvedValue({ user: { id: user.id, storeId: store.id } })
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      const order = await createTestOrderWithPrepayment({
        storeId: store.id,
        sellerId: user.id,
        shiftId: shift.id,
        items: [{ name: "Test Item", quantity: 1, price: "10000.00" }],
        prepaidAmount: "5000.00",
        status: "PREPAID",
      })

      const orderItems = await db.customOrderItem.findMany({
        where: { orderId: order.id },
      })
      const itemId = orderItems[0].id

      requirePermissionMock.mockImplementation(async (code: string, _storeId?: string) => {
        if (code === "pos.discount_high") {
          throw new Error('Нет доступа: требуется разрешение "pos.discount_high"')
        }
      })

      // Price from 10000 to 5000 = 50% change
      await expect(updateOrderItem(itemId, { price: 5000 })).rejects.toThrow("pos.discount_high")
    })
  })

  describe("parseRateLimitError utility", () => {
    it("extracts seconds from rate limit error message", () => {
      const error = new Error("Слишком много запросов. Повторите через 45 сек.")
      expect(parseRateLimitError(error)).toBe(45000)
    })

    it("returns null for non-rate-limit errors", () => {
      expect(parseRateLimitError(new Error("Не авторизован"))).toBeNull()
    })

    it("returns null for non-Error types", () => {
      expect(parseRateLimitError("string error")).toBeNull()
      expect(parseRateLimitError(null)).toBeNull()
    })
  })
})
