/**
 * Phase 13 Plan 03: E2E Supplier Debts Tests
 *
 * Tests on real DB verifying supplier debt workflows:
 * - SUP-01: Debt created from costPrice*qty at ORDERED
 * - SUP-04: Payment creates SupplierPayment + CashOperation(WITHDRAW, shiftId=null)
 * - SUP-05: Partial payments close debt when sum >= amount
 * - SUP-06: Amount update after partial payment recalculates remaining
 *
 * Also covers: ORDERED without purchasePrice, cancel with partial payments,
 * payment exceeding remaining rejection, supplier city accessibility.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestSupplier,
  createTestOrderWithSupplier,
  createTestShift,
} from "../helpers/fixtures"
import type { Store, User, Supplier, Shift } from "@/generated/prisma/client"

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))

const authMock = vi.fn(async () => ({
  user: { id: "placeholder", storeId: "placeholder" },
}))
vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(async () => undefined),
  checkPermission: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { paySupplierDebt, updateOrderCosts, cancelOrderWithDecision, updateOrderStatus } =
  await import("@/actions/orders")

// --- Shared test data (re-created each test due to TRUNCATE CASCADE in beforeEach) ---
let store: Store
let user: User
let supplier: Supplier
let shift: Shift

async function setupTestData() {
  store = await createTestStore()
  user = await createTestUser({ storeId: store.id })
  supplier = await createTestSupplier({ city: "Краснодар" })
  shift = await createTestShift({ storeId: store.id, userId: user.id })
  authMock.mockImplementation(async () => ({
    user: { id: user.id, storeId: store.id },
  }))
}

describe("E2E SUP-01/04/05/06: Supplier Debt Workflows", () => {
  beforeEach(async () => {
    await setupTestData()
  })

  it("SUP-01: debt created from costPrice*qty at ORDERED transition", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [
        { name: "iPhone 15", quantity: 2, price: "80000.00", costPrice: "65000.00" },
        { name: "Чехол", quantity: 3, price: "2000.00", costPrice: "800.00" },
      ],
      status: "PREPAID",
      createDebt: false,
    })

    // Add a payment so PREPAID is valid
    await db.payment.create({
      data: {
        orderId: order.id,
        method: "CASH",
        amount: "1000.00",
        storeId: store.id,
        shiftId: shift.id,
        isExpense: false,
      },
    })

    // Transition to ORDERED
    await updateOrderStatus(order.id, "ORDERED" as any)

    // Verify debt created with costPrice-based amount
    const debt = await db.supplierDebt.findFirst({
      where: { orderId: order.id },
    })

    expect(debt).not.toBeNull()
    // Expected: 65000*2 + 800*3 = 130000 + 2400 = 132400
    expect(Number(debt!.amount)).toBe(132400)
    expect(debt!.isPaid).toBe(false)
  })

  it("SUP-01: ORDERED allowed without purchasePrice (costPrice used as fallback to price)", async () => {
    // Items without costPrice — should use price for debt calculation
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Товар без закупочной", quantity: 1, price: "5000.00" }],
      status: "PREPAID",
      createDebt: false,
    })

    // Add payment for PREPAID validity
    await db.payment.create({
      data: {
        orderId: order.id,
        method: "CASH",
        amount: "500.00",
        storeId: store.id,
        shiftId: shift.id,
        isExpense: false,
      },
    })

    // Should NOT throw — ORDERED works without purchasePrice
    await expect(updateOrderStatus(order.id, "ORDERED" as any)).resolves.not.toThrow()

    const debt = await db.supplierDebt.findFirst({
      where: { orderId: order.id },
    })
    expect(debt).not.toBeNull()
    // Falls back to price: 5000*1 = 5000
    expect(Number(debt!.amount)).toBe(5000)
  })

  it("SUP-04: payment creates SupplierPayment + CashOperation(WITHDRAW, shiftId=null)", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Аксессуар", quantity: 1, price: "3000.00", costPrice: "2000.00" }],
      status: "ORDERED",
      createDebt: true,
    })

    // Pay full amount
    const result = await paySupplierDebt(order.debt!.id, "2000.00")

    expect(result.fullyPaid).toBe(true)
    expect(result.remaining).toBe("0")

    // Verify SupplierPayment created
    const payment = await db.supplierPayment.findFirst({
      where: { debtId: order.debt!.id },
    })
    expect(payment).not.toBeNull()
    expect(Number(payment!.amount)).toBe(2000)

    // Verify CashOperation with WITHDRAW and shiftId=null
    const cashOp = await db.cashOperation.findUnique({
      where: { id: payment!.cashOperationId! },
    })
    expect(cashOp).not.toBeNull()
    expect(cashOp!.type).toBe("WITHDRAW")
    expect(cashOp!.shiftId).toBeNull()

    // Verify debt marked as paid
    const updatedDebt = await db.supplierDebt.findUnique({
      where: { id: order.debt!.id },
    })
    expect(updatedDebt!.isPaid).toBe(true)
    expect(updatedDebt!.paidAt).not.toBeNull()
  })

  it("SUP-05: two partial payments close debt when sum >= amount", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Планшет", quantity: 1, price: "50000.00", costPrice: "30000.00" }],
      status: "ORDERED",
      createDebt: true,
    })

    // First payment: 60% = 18000
    const result1 = await paySupplierDebt(order.debt!.id, "18000.00")
    expect(result1.fullyPaid).toBe(false)
    expect(Number(result1.remaining)).toBe(12000)

    // Verify debt NOT paid yet
    const debtAfterFirst = await db.supplierDebt.findUnique({
      where: { id: order.debt!.id },
    })
    expect(debtAfterFirst!.isPaid).toBe(false)
    expect(debtAfterFirst!.paidAt).toBeNull()

    // Second payment: remaining 40% = 12000
    const result2 = await paySupplierDebt(order.debt!.id, "12000.00")
    expect(result2.fullyPaid).toBe(true)
    expect(result2.remaining).toBe("0")

    // Verify debt IS paid
    const debtAfterSecond = await db.supplierDebt.findUnique({
      where: { id: order.debt!.id },
    })
    expect(debtAfterSecond!.isPaid).toBe(true)
    expect(debtAfterSecond!.paidAt).not.toBeNull()

    // Verify two SupplierPayments exist
    const payments = await db.supplierPayment.findMany({
      where: { debtId: order.debt!.id },
    })
    expect(payments).toHaveLength(2)
  })

  it("SUP-06: amount update after partial payment recalculates remaining + auto-closes", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Ноутбук", quantity: 1, price: "100000.00", costPrice: "70000.00" }],
      status: "ORDERED",
      createDebt: true,
    })

    // Transition through: ORDERED -> IN_TRANSIT -> ARRIVED -> READY_FOR_PICKUP -> COMPLETED
    await updateOrderStatus(order.id, "IN_TRANSIT" as any)
    await updateOrderStatus(order.id, "ARRIVED" as any)
    await updateOrderStatus(order.id, "READY_FOR_PICKUP" as any)

    // Add full payment so COMPLETED transition is allowed (totalPaid >= totalAmount)
    await db.payment.create({
      data: {
        orderId: order.id,
        method: "CASH",
        amount: "100000.00",
        storeId: store.id,
        shiftId: shift.id,
        isExpense: false,
      },
    })

    await updateOrderStatus(order.id, "COMPLETED" as any)

    // Pay 50000 (partial, less than 70000 debt)
    await paySupplierDebt(order.debt!.id, "50000.00")

    // Now update costs to lower amount (50000 total = purchasePrice + deliveryCost)
    // This should auto-close the debt since totalPaid (50000) >= newAmount (50000)
    await updateOrderCosts(order.id, { purchasePrice: 48000, deliveryCost: 2000 })

    const updatedDebt = await db.supplierDebt.findUnique({
      where: { id: order.debt!.id },
    })
    expect(Number(updatedDebt!.amount)).toBe(50000)
    expect(updatedDebt!.isPaid).toBe(true)
    expect(updatedDebt!.paidAt).not.toBeNull()
  })

  it("SUP-05: cancel order with partially paid debt cleans up correctly", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Наушники", quantity: 2, price: "15000.00", costPrice: "10000.00" }],
      status: "ORDERED",
      createDebt: true,
    })

    // Make partial payment
    await paySupplierDebt(order.debt!.id, "8000.00")

    // Get cashOperationId before cancel (for verification after)
    const paymentBeforeCancel = await db.supplierPayment.findFirst({
      where: { debtId: order.debt!.id },
    })
    const cashOpId = paymentBeforeCancel!.cashOperationId!

    // Cancel order
    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "HOLD",
      reason: "Клиент отказался",
    })

    // SupplierDebt should be deleted
    const deletedDebt = await db.supplierDebt.findFirst({
      where: { orderId: order.id },
    })
    expect(deletedDebt).toBeNull()

    // SupplierPayments should be cascade-deleted
    const deletedPayments = await db.supplierPayment.findMany({
      where: { debtId: order.debt!.id },
    })
    expect(deletedPayments).toHaveLength(0)

    // CashOperations should remain (audit trail)
    const cashOp = await db.cashOperation.findUnique({
      where: { id: cashOpId },
    })
    expect(cashOp).not.toBeNull()
  })

  it("SUP-04: payment exceeding remaining is rejected", async () => {
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Зарядка", quantity: 1, price: "3000.00", costPrice: "1500.00" }],
      status: "ORDERED",
      createDebt: true,
    })

    // Try paying more than the debt amount
    await expect(paySupplierDebt(order.debt!.id, "2000.00")).rejects.toThrow(/превышает остаток/)
  })

  it("SUP-01: supplier city accessible via order relation", async () => {
    // Verify the supplier has the city
    const supplierFromDb = await db.supplier.findUnique({
      where: { id: supplier.id },
    })
    expect(supplierFromDb).not.toBeNull()
    expect(supplierFromDb!.city).toBe("Краснодар")

    // Verify order -> supplier -> city relation
    const order = await createTestOrderWithSupplier({
      storeId: store.id,
      sellerId: user.id,
      supplierId: supplier.id,
      items: [{ name: "Тест город", quantity: 1, price: "1000.00" }],
      status: "NEW",
      createDebt: false,
    })

    const orderWithSupplier = await db.customOrder.findUnique({
      where: { id: order.id },
      include: { supplier: { select: { city: true } } },
    })
    expect(orderWithSupplier!.supplier!.city).toBe("Краснодар")
  })
})
