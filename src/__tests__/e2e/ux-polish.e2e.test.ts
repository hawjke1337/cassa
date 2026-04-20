/**
 * E2E: UX Polish (UX2-02, UX2-06, UX2-13)
 *
 * UX2-02: PaymentDialog double-click protection
 *   Client ref-lock + server idempotency-key together guarantee
 *   concurrent submits create exactly one Sale.
 *
 * UX2-06: Idempotency key
 *   Client generates fresh UUID on PaymentDialog open. createSale
 *   server action accepts `input.idempotencyKey`; if a Sale already
 *   exists with that key, returns the existing Sale instead of
 *   inserting a duplicate row. Uniqueness constraint on
 *   Sale.idempotencyKey (Plan 01) protects the race window.
 *
 * UX2-13: Order payment < remaining warning
 *   UI-surfaced warning when operator enters amount less than the
 *   remaining balance (non-blocking). Server-side contract remains:
 *   addOrderPayment accepts partial amounts.
 *
 * Tests run against real PostgreSQL, schema-per-worker isolation
 * (see src/__tests__/setup-db.ts).
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

// --- Mocks (hoisted) ---
vi.mock("@/lib/db", () => ({ db }))

const mockSession = { user: { id: "", storeId: "", name: "Test Seller" } }
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

// --- Lazy import AFTER mocks are registered ---
async function importCreateSale() {
  const { createSale } = await import("@/actions/sales")
  return createSale
}

// --- Helpers ---
let counter = 0
const uniq = () => `UX-${Date.now()}-${++counter}`

async function setupSellerAndStock(qty = 10) {
  const store = await createTestStore({ name: `Store ${uniq()}` })
  const seller = await createTestUser({ role: "SELLER" })
  const category = await createTestCategory({ isSerialized: false })
  const product = await createTestProduct({ categoryId: category.id })
  const sp = await createTestStoreProduct({
    storeId: store.id,
    productId: product.id,
    quantity: qty,
    sellPrice: "1000.00",
    costPrice: "500.00",
  })
  await createTestShift({ storeId: store.id, userId: seller.id, status: "OPEN" })

  mockSession.user.id = seller.id
  mockSession.user.storeId = store.id

  return { store, seller, product, sp }
}

function buildSaleInput(opts: {
  storeId: string
  productId: string
  idempotencyKey?: string
  amount?: number
}) {
  return {
    storeId: opts.storeId,
    items: [
      {
        productId: opts.productId,
        quantity: 1,
        discount: 0,
        serialUnitId: null,
      },
    ],
    payments: [
      {
        method: "CASH" as const,
        amount: opts.amount ?? 1000,
      },
    ],
    cashReceived: opts.amount ?? 1000,
    changeAmount: 0,
    idempotencyKey: opts.idempotencyKey,
  }
}

beforeEach(() => {
  counter = 0
  vi.clearAllMocks()
})

describe("UX2-06: Idempotency key", () => {
  it("createSale с новым idempotencyKey → создаёт Sale и запоминает ключ", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()
    const key = crypto.randomUUID()

    const result = await createSale(
      buildSaleInput({ storeId: ctx.store.id, productId: ctx.product.id, idempotencyKey: key }),
    )

    expect(result.number).toMatch(/^S-/)
    const stored = await db.sale.findUnique({ where: { id: result.id } })
    expect(stored?.idempotencyKey).toBe(key)
  })

  it("createSale повторно с тем же idempotencyKey → возвращает существующую Sale без дубля", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()
    const key = crypto.randomUUID()
    const input = buildSaleInput({
      storeId: ctx.store.id,
      productId: ctx.product.id,
      idempotencyKey: key,
    })

    const first = await createSale(input)
    const second = await createSale(input)

    expect(second.id).toBe(first.id)
    expect(second.number).toBe(first.number)
    const count = await db.sale.count({ where: { idempotencyKey: key } })
    expect(count).toBe(1)
    // Остаток не декрементировался повторно
    const sp = await db.storeProduct.findFirst({
      where: { storeId: ctx.store.id, productId: ctx.product.id },
    })
    expect(Number(sp?.quantity)).toBe(9)
  })

  it("createSale без idempotencyKey → создаёт Sale (fallback для legacy клиентов)", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()

    const result = await createSale(
      buildSaleInput({ storeId: ctx.store.id, productId: ctx.product.id }),
    )

    expect(result.number).toMatch(/^S-/)
    const stored = await db.sale.findUnique({ where: { id: result.id } })
    expect(stored?.idempotencyKey).toBeNull()
  })

  it("два createSale с разными idempotencyKey → создаёт две независимые Sale", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()

    const first = await createSale(
      buildSaleInput({
        storeId: ctx.store.id,
        productId: ctx.product.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    )
    const second = await createSale(
      buildSaleInput({
        storeId: ctx.store.id,
        productId: ctx.product.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    )

    expect(second.id).not.toBe(first.id)
    const sp = await db.storeProduct.findFirst({
      where: { storeId: ctx.store.id, productId: ctx.product.id },
    })
    expect(Number(sp?.quantity)).toBe(8)
  })
})

describe("UX2-02: PaymentDialog double-click protection", () => {
  it("два параллельных createSale с одним idempotencyKey → одна Sale (race condition)", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()
    const key = crypto.randomUUID()
    const input = buildSaleInput({
      storeId: ctx.store.id,
      productId: ctx.product.id,
      idempotencyKey: key,
    })

    // Promise.allSettled: оба ответа должны быть fulfilled, оба должны
    // указывать на один и тот же Sale. Уникальный индекс БД обеспечивает
    // атомарность; P2002 catch в createSale конвертирует race в graceful return.
    const results = await Promise.allSettled([createSale(input), createSale(input)])

    expect(results.every((r) => r.status === "fulfilled")).toBe(true)
    const ids = results.map((r) => (r.status === "fulfilled" ? r.value.id : null))
    expect(ids[0]).toBe(ids[1])
    const count = await db.sale.count({ where: { idempotencyKey: key } })
    expect(count).toBe(1)
    const sp = await db.storeProduct.findFirst({
      where: { storeId: ctx.store.id, productId: ctx.product.id },
    })
    // ровно один декремент
    expect(Number(sp?.quantity)).toBe(9)
  })

  it("последовательный повтор createSale с тем же idempotencyKey → возвращает ту же Sale", async () => {
    const createSale = await importCreateSale()
    const ctx = await setupSellerAndStock()
    const key = crypto.randomUUID()
    const input = buildSaleInput({
      storeId: ctx.store.id,
      productId: ctx.product.id,
      idempotencyKey: key,
    })

    const a = await createSale(input)
    const b = await createSale(input)
    const c = await createSale(input)

    expect(b.id).toBe(a.id)
    expect(c.id).toBe(a.id)
    const count = await db.sale.count({ where: { storeId: ctx.store.id } })
    expect(count).toBe(1)
  })
})

describe("UX2-13: Order payment < remaining warning", () => {
  // UX2-13 is primarily client-side (inline warning in order-detail
  // FinalPaymentDialog). The server doesn't block underpayment —
  // partial payments are legitimate business cases. See
  // 16-VALIDATION.md for manual visual tests.
  it.todo("addOrderPayment с amount < remaining не блокирует (warning — UI-only)")
  it.todo("addOrderPayment с amount === remaining — закрывает остаток без warning")
})
