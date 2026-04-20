/**
 * Phase 11 Plan 02: E2E для REPAIR-01..04.
 *
 * Покрывает требования:
 *   REPAIR-01 — DELIVERED создаёт Sale(REPAIR) + re-parent payments + saleId
 *   REPAIR-02 — Dashboard revenue включает repair Sale
 *   REPAIR-03 — addRepairPart decrements stock, removeRepairPart restores
 *   REPAIR-04 — SaleItems создаются из RepairParts при DELIVERED
 */
import { describe, it, expect, vi } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestStoreProduct,
  createTestShift,
  createTestRepair,
} from "../helpers/fixtures"

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user", storeId: "test-store" } })),
}))
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { addRepairPart, removeRepairPart, updateRepairStatus } = await import("@/actions/repairs")

/** Helper: create common test fixtures (store, user, shift, product, storeProduct) */
async function setupFixtures(opts?: { quantity?: number; costPrice?: string }) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const shift = await createTestShift({ storeId: store.id, userId: user.id })
  const category = await createTestCategory()
  const product = await createTestProduct({ categoryId: category.id })
  const storeProduct = await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    quantity: opts?.quantity ?? 50,
    costPrice: opts?.costPrice ?? "200.00",
  })

  // Mock auth with real user ID so FK constraints work
  const { auth } = await import("@/lib/auth")
  ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

  return { store, user, shift, category, product, storeProduct }
}

describe("Repair as Sale (REPAIR-01..04)", () => {
  it("REPAIR-03: addRepairPart decrements StoreProduct.quantity", async () => {
    const { store, user, product, storeProduct } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
    })
    const spBefore = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })

    await addRepairPart(repair.id, {
      productId: product.id,
      quantity: 2,
    })

    const spAfter = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })
    expect(Number(spAfter!.quantity)).toBe(Number(spBefore!.quantity) - 2)
  })

  it("REPAIR-03: insufficient stock throws", async () => {
    const { store, user, category } = await setupFixtures()
    const lowProduct = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: lowProduct.id,
      storeId: store.id,
      quantity: 1,
      costPrice: "100.00",
    })
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
    })

    await expect(
      addRepairPart(repair.id, { productId: lowProduct.id, quantity: 5 }),
    ).rejects.toThrow("Недостаточно запчастей")
  })

  it("REPAIR-03: removeRepairPart restores StoreProduct.quantity", async () => {
    const { store, user, product, storeProduct } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
    })
    const spBefore = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })

    // Add part via action (decrements stock)
    await addRepairPart(repair.id, {
      productId: product.id,
      quantity: 3,
    })

    const spMid = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })
    expect(Number(spMid!.quantity)).toBe(Number(spBefore!.quantity) - 3)

    // Find the created part
    const parts = await db.repairPart.findMany({
      where: { repairId: repair.id },
    })
    expect(parts.length).toBe(1)

    // Remove part via action (restores stock)
    await removeRepairPart(parts[0].id)

    const spAfter = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })
    expect(Number(spAfter!.quantity)).toBe(Number(spBefore!.quantity))
  })

  it("REPAIR-01: DELIVERED creates Sale with type=REPAIR", async () => {
    const { store, user } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      finalCost: "5000.00",
    })

    await updateRepairStatus(repair.id, "DELIVERED")

    const updatedRepair = await db.repair.findUnique({
      where: { id: repair.id },
    })
    expect(updatedRepair!.saleId).toBeTruthy()

    const sale = await db.sale.findUnique({
      where: { id: updatedRepair!.saleId! },
    })
    expect(sale).toBeTruthy()
    expect(sale!.type).toBe("REPAIR")
    expect(sale!.status).toBe("COMPLETED")
    expect(Number(sale!.finalAmount)).toBe(5000)
  })

  it("REPAIR-01: DELIVERED sets repair.saleId to created Sale.id", async () => {
    const { store, user } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      finalCost: "3500.00",
    })

    await updateRepairStatus(repair.id, "DELIVERED")

    const updatedRepair = await db.repair.findUnique({
      where: { id: repair.id },
    })
    expect(updatedRepair!.saleId).toBeTruthy()

    const sale = await db.sale.findUnique({
      where: { id: updatedRepair!.saleId! },
    })
    expect(sale).toBeTruthy()
    expect(sale!.id).toBe(updatedRepair!.saleId)
  })

  it("REPAIR-01: payments re-parented from repair to sale", async () => {
    const { store, user, shift } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      finalCost: "3000.00",
    })

    // Create payment linked to repair
    const payment = await db.payment.create({
      data: {
        repairId: repair.id,
        amount: "3000.00",
        method: "CASH",
        storeId: store.id,
        shiftId: shift.id,
      },
    })

    await updateRepairStatus(repair.id, "DELIVERED")

    const updatedPayment = await db.payment.findUnique({
      where: { id: payment.id },
    })
    expect(updatedPayment!.saleId).toBeTruthy()
    expect(updatedPayment!.repairId).toBeNull()
  })

  it("REPAIR-04: SaleItems created from RepairParts with COGS", async () => {
    const { store, user, category, product } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
      agreedCost: "7000.00",
    })

    // Add 2 different parts
    await addRepairPart(repair.id, {
      productId: product.id,
      quantity: 1,
    })
    const product2 = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product2.id,
      storeId: store.id,
      quantity: 10,
      costPrice: "150.00",
    })
    await addRepairPart(repair.id, {
      productId: product2.id,
      quantity: 2,
    })

    // Advance to DELIVERED via valid transitions
    // COMPLETED sets finalCost from agreedCost
    await updateRepairStatus(repair.id, "COMPLETED")
    await updateRepairStatus(repair.id, "READY_FOR_PICKUP")
    await updateRepairStatus(repair.id, "DELIVERED")

    const updatedRepair = await db.repair.findUnique({
      where: { id: repair.id },
    })
    const saleItems = await db.saleItem.findMany({
      where: { saleId: updatedRepair!.saleId! },
    })
    expect(saleItems.length).toBe(1)
    // COGS = 200*1 + 150*2 = 500
    expect(Number(saleItems[0].costPrice)).toBe(500)
    expect(saleItems[0].name).toContain("Ремонт:")
  })

  it("REPAIR-01: DELIVERED without open shift throws", async () => {
    const noShiftStore = await createTestStore()
    const noShiftUser = await createTestUser({ storeId: noShiftStore.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({
      user: { id: noShiftUser.id, storeId: noShiftStore.id },
    })

    const repair = await createTestRepair({
      storeId: noShiftStore.id,
      createdById: noShiftUser.id,
      status: "READY_FOR_PICKUP",
      finalCost: "1000.00",
    })

    await expect(updateRepairStatus(repair.id, "DELIVERED")).rejects.toThrow(
      "Откройте кассовую смену",
    )
  })

  it("REPAIR-01: DELIVERED without finalCost throws", async () => {
    const { store, user } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      // No cost fields
    })

    await expect(updateRepairStatus(repair.id, "DELIVERED")).rejects.toThrow(
      "Укажите итоговую стоимость ремонта",
    )
  })

  it("REPAIR-04: labor-only repair has SaleItem with costPrice=0", async () => {
    const { store, user } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      finalCost: "2000.00",
    })
    // No RepairParts added

    await updateRepairStatus(repair.id, "DELIVERED")

    const updatedRepair = await db.repair.findUnique({
      where: { id: repair.id },
    })
    const saleItems = await db.saleItem.findMany({
      where: { saleId: updatedRepair!.saleId! },
    })
    expect(saleItems.length).toBe(1)
    expect(Number(saleItems[0].costPrice)).toBe(0)
  })

  it("REPAIR-01: CANCELLED restores parts stock", async () => {
    const { store, user, product, storeProduct } = await setupFixtures()
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
    })
    const spBefore = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })

    // Add part (decrement stock by 4)
    await addRepairPart(repair.id, {
      productId: product.id,
      quantity: 4,
    })

    const spMid = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })
    expect(Number(spMid!.quantity)).toBe(Number(spBefore!.quantity) - 4)

    // Cancel repair (should restore stock)
    await updateRepairStatus(repair.id, "CANCELLED")

    const spAfter = await db.storeProduct.findUnique({
      where: { id: storeProduct.id },
    })
    expect(Number(spAfter!.quantity)).toBe(Number(spBefore!.quantity))
  })

  it("REPAIR-02: dashboard revenue query includes repair Sale", async () => {
    const { store, user } = await setupFixtures()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    // Create a repair Sale via DELIVERED transition
    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "READY_FOR_PICKUP",
      finalCost: "4500.00",
    })
    await updateRepairStatus(repair.id, "DELIVERED")

    // Reproduce the exact getDashboardData revenue query
    const todaySales = await db.sale.findMany({
      where: {
        storeId: store.id,
        createdAt: { gte: today, lte: endOfDay },
        status: "COMPLETED",
      },
      select: { finalAmount: true, type: true, id: true },
    })

    const updatedRepair = await db.repair.findUnique({
      where: { id: repair.id },
    })

    const todayRevenue = todaySales.reduce((s, sale) => s + Number(sale.finalAmount), 0)

    // Verify the repair sale is included in dashboard revenue
    const repairSaleInResults = todaySales.find((s) => s.id === updatedRepair!.saleId)
    expect(repairSaleInResults).toBeDefined()
    expect(todayRevenue).toBeGreaterThanOrEqual(4500)
  })
})
