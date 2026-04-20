import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mock setup ---

const mockTx = {
  shift: {
    findFirst: vi.fn(),
  },
  sale: {
    create: vi.fn(),
  },
  storeProduct: {
    update: vi.fn(),
  },
  serialUnit: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  serialUnitHistory: {
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
}

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "u1", storeId: "s1", name: "Test User" },
  }),
}))

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn().mockResolvedValue(undefined),
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock("@/lib/counters", () => ({
  getNextNumber: vi.fn().mockResolvedValue("S-0001"),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Helper to build a standard sale input
function makeSaleInput(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "s1",
    items: [{ productId: "p1", quantity: 1, discount: 0 }],
    payments: [{ method: "CASH" as const, amount: 1000 }],
    ...overrides,
  }
}

// Helper for the locked stock row returned by $queryRaw
function makeStockRow(overrides: Record<string, unknown> = {}) {
  return {
    productId: "p1",
    quantity: 10,
    sellPrice: 1000,
    costPrice: 500,
    productName: "Test Product",
    ...overrides,
  }
}

// Standard sale.create return value
function makeSaleResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "sale-1",
    number: "S-0001",
    totalAmount: 1000,
    discountAmount: 0,
    finalAmount: 1000,
    comment: null,
    createdAt: new Date("2026-01-01"),
    seller: { firstName: "Test", lastName: "User" },
    store: { name: "Store 1", address: "Addr", phone: "+7" },
    items: [
      {
        id: "si-1",
        productId: "p1",
        product: { id: "p1", name: "Test Product", sku: "SKU1" },
        name: "Test Product",
        quantity: 1,
        price: 1000,
        costPrice: 500,
        discount: 0,
        total: 1000,
        serialUnit: null,
      },
    ],
    payments: [{ id: "pay-1", method: "CASH", amount: 1000 }],
    ...overrides,
  }
}

describe("createSale integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: open shift exists
    mockTx.shift.findFirst.mockResolvedValue({ id: "shift-1" })

    // Default: stock query returns one product with plenty of stock
    mockTx.$queryRaw.mockResolvedValue([makeStockRow()])

    // Default: sale.create returns a full sale object
    mockTx.sale.create.mockResolvedValue(makeSaleResult())

    // Default: storeProduct.update succeeds
    mockTx.storeProduct.update.mockResolvedValue({})
  })

  it("happy path: single item sale calls $transaction and decrements stock", async () => {
    const { createSale } = await import("@/actions/sales")

    const result = await createSale(makeSaleInput())

    // $transaction was called
    const { db } = await import("@/lib/db")
    expect(db.$transaction).toHaveBeenCalledTimes(1)

    // Stock was decremented for non-serial product
    expect(mockTx.storeProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_productId: { storeId: "s1", productId: "p1" } },
        data: { quantity: { decrement: 1 } },
      }),
    )

    // Sale result is returned
    expect(result.id).toBe("sale-1")
    expect(result.number).toBe("S-0001")
    expect(result.totalAmount).toBe(1000)
  })

  it("happy path: two items sale decrements stock for both products", async () => {
    const input = makeSaleInput({
      items: [
        { productId: "p1", quantity: 1, discount: 0 },
        { productId: "p2", quantity: 2, discount: 50 },
      ],
      payments: [{ method: "CASH" as const, amount: 2900 }],
    })

    mockTx.$queryRaw.mockResolvedValue([
      makeStockRow({ productId: "p1", sellPrice: 1000, costPrice: 500 }),
      makeStockRow({ productId: "p2", sellPrice: 1000, costPrice: 400, productName: "Product 2" }),
    ])

    mockTx.sale.create.mockResolvedValue(
      makeSaleResult({
        totalAmount: 3000,
        discountAmount: 100,
        finalAmount: 2900,
        items: [
          {
            id: "si-1",
            productId: "p1",
            product: { id: "p1", name: "Test Product", sku: "SKU1" },
            name: "Test Product",
            quantity: 1,
            price: 1000,
            costPrice: 500,
            discount: 0,
            total: 1000,
            serialUnit: null,
          },
          {
            id: "si-2",
            productId: "p2",
            product: { id: "p2", name: "Product 2", sku: "SKU2" },
            name: "Product 2",
            quantity: 2,
            price: 1000,
            costPrice: 400,
            discount: 50,
            total: 1900,
            serialUnit: null,
          },
        ],
        payments: [{ id: "pay-1", method: "CASH", amount: 2900 }],
      }),
    )

    const { createSale } = await import("@/actions/sales")
    const result = await createSale(input)

    // Both products updated
    expect(mockTx.storeProduct.update).toHaveBeenCalledTimes(2)
    expect(mockTx.storeProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_productId: { storeId: "s1", productId: "p1" } },
        data: { quantity: { decrement: 1 } },
      }),
    )
    expect(mockTx.storeProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_productId: { storeId: "s1", productId: "p2" } },
        data: { quantity: { decrement: 2 } },
      }),
    )

    expect(result.totalAmount).toBe(3000)
  })

  it("edge case: product with insufficient stock throws error", async () => {
    mockTx.$queryRaw.mockResolvedValue([makeStockRow({ quantity: 0 })])

    const input = makeSaleInput({
      items: [{ productId: "p1", quantity: 1, discount: 0 }],
    })

    const { createSale } = await import("@/actions/sales")
    await expect(createSale(input)).rejects.toThrow("Недостаточно товара")
  })

  it("edge case: serialized product updates serialUnit status to SOLD", async () => {
    const input = makeSaleInput({
      items: [{ productId: "p1", quantity: 1, discount: 0, serialUnitId: "su-1" }],
      payments: [{ method: "CASH" as const, amount: 1200 }],
    })

    mockTx.serialUnit.findUnique.mockResolvedValue({
      id: "su-1",
      status: "IN_STOCK",
      storeId: "s1",
      productId: "p1",
      costPrice: 600,
      product: { name: "Serial Product" },
    })

    mockTx.$queryRaw.mockResolvedValue([makeStockRow({ productId: "p1", sellPrice: 1200 })])

    mockTx.sale.create.mockResolvedValue(
      makeSaleResult({
        items: [
          {
            id: "si-1",
            productId: "p1",
            product: { id: "p1", name: "Serial Product", sku: "SKU1" },
            name: "Serial Product",
            quantity: 1,
            price: 1200,
            costPrice: 600,
            discount: 0,
            total: 1200,
            serialUnit: { id: "su-1", imei: "123456789012345", imei2: null, serialNumber: null },
          },
        ],
      }),
    )

    const { createSale } = await import("@/actions/sales")
    const result = await createSale(input)

    // Serial unit status updated to SOLD
    expect(mockTx.serialUnit.update).toHaveBeenCalledWith({
      where: { id: "su-1" },
      data: { status: "SOLD" },
    })

    // History entry created
    expect(mockTx.serialUnitHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serialUnitId: "su-1",
        event: "SOLD",
        storeId: "s1",
      }),
    })

    // Stock NOT decremented for serialized (only for regular)
    expect(mockTx.storeProduct.update).not.toHaveBeenCalled()
  })

  it("sale.create called with correct totals (totalAmount, discountAmount, finalAmount)", async () => {
    const input = makeSaleInput({
      items: [{ productId: "p1", quantity: 3, discount: 100 }],
      payments: [{ method: "CASH" as const, amount: 2700 }],
    })

    mockTx.$queryRaw.mockResolvedValue([makeStockRow({ quantity: 10, sellPrice: 1000 })])

    mockTx.sale.create.mockResolvedValue(
      makeSaleResult({
        totalAmount: 3000,
        discountAmount: 300,
        finalAmount: 2700,
      }),
    )

    const { createSale } = await import("@/actions/sales")
    await createSale(input)

    expect(mockTx.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 3000, // 1000 * 3
          discountAmount: 300, // 100 * 3
          finalAmount: 2700, // 3000 - 300
        }),
      }),
    )
  })

  it("throws error when no open shift", async () => {
    mockTx.shift.findFirst.mockResolvedValue(null)

    const { createSale } = await import("@/actions/sales")
    await expect(createSale(makeSaleInput())).rejects.toThrow("Откройте кассовую смену")
  })
})
