/**
 * Phase 8 Wave 0 RED: E2E для отмены заказа с явным выбором действия с предоплатой.
 *
 * Покрывает требования:
 *   FIN-04 — явный выбор оператора HOLD/REFUND (no default silent behavior)
 *   FIN-05 — REFUND создаёт compensating Payment (isExpense=true) + CashOperation WITHDRAW (CASH)
 *   FIN-06 — HOLD сохраняет payments, cancellationType='HOLD', status=CANCELLED
 *
 * **Wave 0 RED:** позитивные Wave 2 assertions; cancelOrderWithDecision — throwing stub,
 * поэтому все тесты падают с "not implemented — Wave 2" до Plan 08-03.
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
  createTestOrderWithPrepayment,
} from "../helpers/fixtures"
import {
  assertMoneyConservation,
  assertShiftConsistency,
  assertOrderSaleLink,
  assertStockConservation,
} from "../helpers/invariants"

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

const { cancelOrderWithDecision } = await import("@/actions/orders")

async function seedOrderFixture(opts: {
  prepaidAmount?: string
  prepaymentMethod?: "CASH" | "CARD"
  openShift?: boolean
}) {
  const store = await createTestStore()
  const user = await createTestUser({ storeId: store.id })
  const category = await createTestCategory({ isSerialized: false })
  const product = await createTestProduct({ categoryId: category.id })
  await createTestStoreProduct({
    productId: product.id,
    storeId: store.id,
    sellPrice: "1000.00",
    quantity: 10,
  })
  const shift = opts.openShift
    ? await createTestShift({ storeId: store.id, userId: user.id, status: "OPEN" })
    : null

  const fixtureShiftId =
    shift?.id ?? (await createTestShift({ storeId: store.id, userId: user.id })).id

  const order = await createTestOrderWithPrepayment({
    storeId: store.id,
    sellerId: user.id,
    shiftId: fixtureShiftId,
    items: [{ productId: product.id, quantity: 1, price: "1000.00", name: "Test Product" }],
    prepaidAmount: opts.prepaidAmount ?? "500.00",
    prepaymentMethod: opts.prepaymentMethod ?? "CASH",
    status: "PREPAID",
  })

  return { store, user, product, shift, order }
}

describe("E2E FIN-04/05/06: cancelOrderWithDecision (Wave 0 RED)", () => {
  it("FIN-06 HOLD-CASH: prepayment удерживается, cancellationType='HOLD'", async () => {
    const { store, order } = await seedOrderFixture({ openShift: true })

    // Wave 2 ACT — сейчас падает RED на stub
    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "HOLD",
      reason: "Клиент передумал",
    })

    // Wave 2 positive expectations:
    const refreshed = await db.customOrder.findUnique({ where: { id: order.id } })
    expect(refreshed!.status).toBe("CANCELLED")
    // cancellationType колонка добавляется в Wave 1 migration (pre-condition для Wave 2)
    expect((refreshed as { cancellationType?: string }).cancellationType).toBe("HOLD")
    expect(refreshed!.prepaidAmount.toString()).toBe("500") // НЕ обнулён

    // Payments НЕ удалены
    const payments = await db.payment.findMany({ where: { orderId: order.id } })
    expect(payments.length).toBe(1)
    expect(payments[0].isExpense).toBe(false)

    // Нет compensating CashOperation
    const cashOps = await db.cashOperation.count({
      where: { reason: { contains: order.number } },
    })
    expect(cashOps).toBe(0)

    await assertMoneyConservation(db, { storeId: store.id })
    await assertOrderSaleLink(db, { storeId: store.id })
  })

  it("FIN-05 REFUND-CASH: compensating Payment + CashOperation WITHDRAW", async () => {
    const { store, order, shift } = await seedOrderFixture({ openShift: true })
    expect(shift).not.toBeNull()

    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "REFUND",
      reason: "Клиент попросил вернуть",
    })

    // Wave 2 expectations:
    const refreshed = await db.customOrder.findUnique({ where: { id: order.id } })
    expect(refreshed!.status).toBe("CANCELLED")
    expect((refreshed as { cancellationType?: string }).cancellationType).toBe("REFUND")
    expect(refreshed!.prepaidAmount.toString()).toBe("0")

    // Compensating Payment создан
    const payments = await db.payment.findMany({ where: { orderId: order.id } })
    const expensePayments = payments.filter((p) => p.isExpense)
    expect(expensePayments.length).toBe(1)
    expect(expensePayments[0].method).toBe("CASH")
    expect(expensePayments[0].amount.toString()).toBe("500")
    expect(expensePayments[0].shiftId).toBe(shift!.id)

    // CashOperation WITHDRAW
    const cashOps = await db.cashOperation.findMany({ where: { shiftId: shift!.id } })
    const withdraw = cashOps.find((op) => op.type === "WITHDRAW")
    expect(withdraw).toBeDefined()
    expect(withdraw!.amount.toString()).toBe("500")

    await assertShiftConsistency(db)
    await assertMoneyConservation(db, { storeId: store.id })
    await assertOrderSaleLink(db, { storeId: store.id })
  })

  it("FIN-05 REFUND-CARD: compensating Payment по CARD без CashOperation", async () => {
    const { store, order, shift } = await seedOrderFixture({
      openShift: true,
      prepaymentMethod: "CARD",
    })

    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "REFUND",
      reason: "Возврат на карту",
    })

    const payments = await db.payment.findMany({ where: { orderId: order.id } })
    const expensePayments = payments.filter((p) => p.isExpense)
    expect(expensePayments.length).toBe(1)
    expect(expensePayments[0].method).toBe("CARD")

    // НЕТ compensating CashOperation для CARD
    const withdraws = await db.cashOperation.findMany({
      where: { shiftId: shift!.id, type: "WITHDRAW" },
    })
    expect(withdraws.length).toBe(0)

    await assertMoneyConservation(db, { storeId: store.id })
    await assertOrderSaleLink(db, { storeId: store.id })
  })

  it("FIN-04 REFUND без OPEN shift → throw 'Для возврата предоплаты откройте смену'", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const category = await createTestCategory({ isSerialized: false })
    const product = await createTestProduct({ categoryId: category.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1000.00",
    })
    const closedShift = await createTestShift({
      storeId: store.id,
      userId: user.id,
      status: "CLOSED",
    })
    const order = await createTestOrderWithPrepayment({
      storeId: store.id,
      sellerId: user.id,
      shiftId: closedShift.id,
      items: [{ productId: product.id, quantity: 1, price: "1000.00", name: "Test Product" }],
      prepaidAmount: "500.00",
      status: "PREPAID",
    })

    // Wave 2 expectation: specific error message
    await expect(
      cancelOrderWithDecision(order.id, { prepaymentAction: "REFUND", reason: "Возврат" }),
    ).rejects.toThrow(/Для возврата предоплаты откройте смену/)
  })

  it("FIN-04 HOLD без OPEN shift — допустимо (нет денежных операций)", async () => {
    const { store, order } = await seedOrderFixture({ openShift: false })

    // Должен завершиться успешно даже без OPEN shift
    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "HOLD",
      reason: "Клиент пропал",
    })

    const refreshed = await db.customOrder.findUnique({ where: { id: order.id } })
    expect(refreshed!.status).toBe("CANCELLED")

    await assertOrderSaleLink(db, { storeId: store.id })
  })

  it("FIN-04: повторная отмена → throw 'Нельзя из {status}'", async () => {
    const { order } = await seedOrderFixture({ openShift: true })

    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "HOLD",
      reason: "Первая отмена",
    })

    // Wave 2 expectation: повторная попытка даёт FSM ошибку
    await expect(
      cancelOrderWithDecision(order.id, { prepaymentAction: "HOLD", reason: "Повтор" }),
    ).rejects.toThrow(/Нельзя.*CANCELLED/)
  })

  it("FIN-04: stock не меняется при cancel (только при completion)", async () => {
    const { store, product, order } = await seedOrderFixture({ openShift: true })

    await cancelOrderWithDecision(order.id, {
      prepaymentAction: "HOLD",
      reason: "Отмена",
    })

    // Stock остаётся 10 — при создании заказа stock не списывается
    await assertStockConservation(db, {
      storeId: store.id,
      productId: product.id,
      initialStock: 10,
    })
  })
})
