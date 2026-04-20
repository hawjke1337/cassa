/**
 * E2E: payroll employee dashboard — scope security + shift data.
 *
 * PAYROLL-03: SaleCommission includes shiftId, shiftDate, shiftNumber
 * PAYROLL-05: getMyPayrolls returns only current user's payrolls
 * PAYROLL-06: Employee cannot see other employees' payroll data
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
} from "../helpers/fixtures"
import type { MotivationFormula } from "@/lib/validations/motivation"

vi.mock("@/lib/db", () => ({ db }))

const mockSession = {
  user: { id: "", storeId: "", name: "Test Seller", permissions: [] as string[] },
}
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession),
}))

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

function makeFormula(rate: number): MotivationFormula {
  return {
    dailyRate: 500,
    commissionRules: [],
    defaultCommission: { type: "PERCENT", rate, basis: "RETAIL_PRICE" },
    crossSellBonuses: [],
    repairBonus: 0,
  }
}

describe("E2E: payroll employee dashboard", () => {
  beforeEach(() => {
    mockSession.user.id = ""
    mockSession.user.storeId = ""
    mockSession.user.permissions = []
  })

  describe("PAYROLL-05/06: getMyPayrolls scope security", () => {
    it("returns payroll records for current user only", async () => {
      const storeX = await createTestStore()
      const userA = await createTestUser({ storeId: storeX.id })
      const userB = await createTestUser({ storeId: storeX.id })

      // Create motivation scheme for payroll FK
      const scheme = await db.motivationScheme.create({
        data: {
          name: "Test Scheme",
          status: "ACTIVE",
          formula: makeFormula(0.05) as any,
          createdById: userA.id,
        },
      })

      // 2 payrolls for userA in storeX
      await db.payroll.create({
        data: {
          userId: userA.id,
          storeId: storeX.id,
          schemeId: scheme.id,
          periodStart: new Date("2026-03-01"),
          periodEnd: new Date("2026-03-15"),
          shiftsCount: 5,
          dailyTotal: "2500.00",
          commissions: "1000.00",
          crossBonuses: "0.00",
          repairBonuses: "0.00",
          returns: "0.00",
          totalAmount: "3500.00",
          isAdvance: true,
          status: "CONFIRMED",
          breakdown: {},
        },
      })
      await db.payroll.create({
        data: {
          userId: userA.id,
          storeId: storeX.id,
          schemeId: scheme.id,
          periodStart: new Date("2026-03-01"),
          periodEnd: new Date("2026-03-31"),
          shiftsCount: 10,
          dailyTotal: "5000.00",
          commissions: "2000.00",
          crossBonuses: "100.00",
          repairBonuses: "200.00",
          returns: "-50.00",
          totalAmount: "7250.00",
          isAdvance: false,
          status: "DRAFT",
          breakdown: {},
        },
      })

      // 1 payroll for userB in storeX
      await db.payroll.create({
        data: {
          userId: userB.id,
          storeId: storeX.id,
          schemeId: scheme.id,
          periodStart: new Date("2026-03-01"),
          periodEnd: new Date("2026-03-15"),
          shiftsCount: 4,
          dailyTotal: "2000.00",
          commissions: "800.00",
          crossBonuses: "0.00",
          repairBonuses: "0.00",
          returns: "0.00",
          totalAmount: "2800.00",
          isAdvance: true,
          status: "CONFIRMED",
          breakdown: {},
        },
      })

      // Set session to userA
      mockSession.user.id = userA.id
      mockSession.user.storeId = storeX.id

      const { getMyPayrolls } = await import("@/actions/motivation-payroll")
      const result = await getMyPayrolls(storeX.id)

      // Should return exactly 2 records (only userA's)
      expect(result).toHaveLength(2)
      expect(result.every((p) => p.id)).toBe(true)
    })

    it("does NOT return payroll records of another user in the same store", async () => {
      const storeX = await createTestStore()
      const userA = await createTestUser({ storeId: storeX.id })
      const userB = await createTestUser({ storeId: storeX.id })

      const scheme = await db.motivationScheme.create({
        data: {
          name: "Test Scheme 2",
          status: "ACTIVE",
          formula: makeFormula(0.05) as any,
          createdById: userA.id,
        },
      })

      // Payroll for userB
      const userBPayroll = await db.payroll.create({
        data: {
          userId: userB.id,
          storeId: storeX.id,
          schemeId: scheme.id,
          periodStart: new Date("2026-03-01"),
          periodEnd: new Date("2026-03-15"),
          shiftsCount: 4,
          dailyTotal: "2000.00",
          commissions: "800.00",
          crossBonuses: "0.00",
          repairBonuses: "0.00",
          returns: "0.00",
          totalAmount: "2800.00",
          isAdvance: true,
          status: "CONFIRMED",
          breakdown: {},
        },
      })

      // Set session to userA — should NOT see userB's payroll
      mockSession.user.id = userA.id
      mockSession.user.storeId = storeX.id

      const { getMyPayrolls } = await import("@/actions/motivation-payroll")
      const result = await getMyPayrolls(storeX.id)

      // userA has no payrolls → empty
      expect(result).toHaveLength(0)
      // Verify userB's payroll ID is not present
      expect(result.map((p) => p.id)).not.toContain(userBPayroll.id)
    })

    it("returns correct fields: id, periodStart, periodEnd, isAdvance, totalAmount, status, schemeName", async () => {
      const storeX = await createTestStore()
      const userA = await createTestUser({ storeId: storeX.id })

      const scheme = await db.motivationScheme.create({
        data: {
          name: "Premium Plan",
          status: "ACTIVE",
          formula: makeFormula(0.05) as any,
          createdById: userA.id,
        },
      })

      await db.payroll.create({
        data: {
          userId: userA.id,
          storeId: storeX.id,
          schemeId: scheme.id,
          periodStart: new Date("2026-04-01"),
          periodEnd: new Date("2026-04-15"),
          shiftsCount: 6,
          dailyTotal: "3000.00",
          commissions: "1500.00",
          crossBonuses: "50.00",
          repairBonuses: "100.00",
          returns: "-25.00",
          totalAmount: "4625.00",
          isAdvance: true,
          status: "CONFIRMED",
          breakdown: {},
        },
      })

      mockSession.user.id = userA.id
      mockSession.user.storeId = storeX.id

      const { getMyPayrolls } = await import("@/actions/motivation-payroll")
      const result = await getMyPayrolls(storeX.id)

      expect(result).toHaveLength(1)
      const p = result[0]
      expect(p.id).toBeDefined()
      expect(p.periodStart).toBeDefined()
      expect(p.periodEnd).toBeDefined()
      expect(p.isAdvance).toBe(true)
      expect(p.totalAmount).toBe(4625)
      expect(p.status).toBe("CONFIRMED")
      expect(p.schemeName).toBe("Premium Plan")
    })
  })

  describe("PAYROLL-03: SaleCommission shift data", () => {
    it("calculateEarnings returns commissions with shiftId, shiftDate, shiftNumber", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 100,
      })

      // Create shift
      const shift = await createTestShift({ storeId: store.id, userId: user.id })

      // Create a sale linked to this shift
      const { createSale } = await import("@/actions/sales")
      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })

      const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
      const periodStart = new Date(Date.now() - 86_400_000)
      const periodEnd = new Date(Date.now() + 86_400_000)

      const result = await calculateEarningsWithFormula(
        user.id,
        store.id,
        periodStart,
        periodEnd,
        0,
        makeFormula(0.05),
      )

      expect(result.commissions.length).toBeGreaterThan(0)
      const comm = result.commissions[0]
      expect(comm.shiftId).toBe(shift.id)
      expect(comm.shiftDate).toBeDefined()
      expect(comm.shiftNumber).toBe(shift.number)
    })

    it("sales without a shift have shiftId=null, shiftDate=null, shiftNumber=null", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })
      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })
      await createTestStoreProduct({
        productId: product.id,
        storeId: store.id,
        sellPrice: "1000.00",
        costPrice: "500.00",
        quantity: 100,
      })

      // Create a shift (required for createSale) then nullify shiftId on the sale
      const shift = await createTestShift({ storeId: store.id, userId: user.id })
      mockSession.user.id = user.id
      mockSession.user.storeId = store.id

      const { createSale } = await import("@/actions/sales")
      await createSale({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 1000 }],
      })

      // Remove shift link from the sale to simulate a sale without shift
      const sales = await db.sale.findMany({
        where: { sellerId: user.id, storeId: store.id },
      })
      await db.sale.update({
        where: { id: sales[0].id },
        data: { shiftId: null },
      })

      const { calculateEarningsWithFormula } = await import("@/actions/motivation-calculation")
      const periodStart = new Date(Date.now() - 86_400_000)
      const periodEnd = new Date(Date.now() + 86_400_000)

      const result = await calculateEarningsWithFormula(
        user.id,
        store.id,
        periodStart,
        periodEnd,
        0,
        makeFormula(0.05),
      )

      expect(result.commissions.length).toBeGreaterThan(0)
      const comm = result.commissions[0]
      expect(comm.shiftId).toBeNull()
      expect(comm.shiftDate).toBeNull()
      expect(comm.shiftNumber).toBeNull()
    })
  })
})
