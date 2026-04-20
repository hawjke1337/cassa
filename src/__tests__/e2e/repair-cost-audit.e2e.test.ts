/**
 * Phase 11 Plan 01: E2E для REPAIR-05 (cost history) и REPAIR-06 (cost freeze).
 *
 * Покрывает требования:
 *   REPAIR-05 — Изменение estimatedCost/agreedCost/finalCost записывается в RepairCostHistory
 *   REPAIR-06 — Попытка изменить стоимость после COMPLETED/DELIVERED отклоняется
 *
 * Тесты работают через test Prisma client (DB-level) + мокнутые server actions.
 */
import { describe, it, expect, vi } from "vitest"
import { db } from "../helpers/db"
import { createTestStore, createTestUser, createTestRepair } from "../helpers/fixtures"

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

const { updateRepair, updateRepairStatus } = await import("@/actions/repairs")
const { assertCostNotFrozen } = await import("@/lib/repair-guards")

describe("E2E REPAIR-05: RepairCostHistory audit trail", () => {
  it("updateRepair creates RepairCostHistory for agreedCost change", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    // Mock auth to return our test user
    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "RECEIVED",
    })

    // Update agreedCost from null to 5000
    await updateRepair(repair.id, { agreedCost: 5000 })

    const history = await db.repairCostHistory.findMany({
      where: { repairId: repair.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].field).toBe("agreedCost")
    expect(history[0].oldValue).toBeNull()
    expect(history[0].newValue!.toNumber()).toBe(5000)
    expect(history[0].userId).toBe(user.id)
  })

  it("multiple cost changes create multiple history records", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "RECEIVED",
    })

    // First change: estimatedCost null -> 3000
    await updateRepair(repair.id, { estimatedCost: 3000 })

    // Second change: agreedCost null -> 5000
    await updateRepair(repair.id, { agreedCost: 5000 })

    const history = await db.repairCostHistory.findMany({
      where: { repairId: repair.id },
      orderBy: { createdAt: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].field).toBe("estimatedCost")
    expect(history[0].oldValue).toBeNull()
    expect(history[0].newValue!.toNumber()).toBe(3000)
    expect(history[1].field).toBe("agreedCost")
    expect(history[1].oldValue).toBeNull()
    expect(history[1].newValue!.toNumber()).toBe(5000)
  })

  it("updateRepairStatus to COMPLETED with finalCost creates RepairCostHistory", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
      agreedCost: "4000.00",
    })

    await updateRepairStatus(repair.id, "COMPLETED" as any, "Работа выполнена", {
      finalCost: 4500,
    })

    const history = await db.repairCostHistory.findMany({
      where: { repairId: repair.id, field: "finalCost" },
    })

    expect(history).toHaveLength(1)
    expect(history[0].field).toBe("finalCost")
    expect(history[0].oldValue).toBeNull()
    expect(history[0].newValue!.toNumber()).toBe(4500)
    expect(history[0].userId).toBe(user.id)
  })
})

describe("E2E REPAIR-06: Cost freeze guard", () => {
  it("assertCostNotFrozen throws for COMPLETED status", () => {
    expect(() => assertCostNotFrozen("COMPLETED" as any)).toThrow(
      "Нельзя изменить стоимость после завершения ремонта",
    )
  })

  it("assertCostNotFrozen throws for DELIVERED status", () => {
    expect(() => assertCostNotFrozen("DELIVERED" as any)).toThrow(
      "Нельзя изменить стоимость после завершения ремонта",
    )
  })

  it("assertCostNotFrozen does NOT throw for IN_PROGRESS status", () => {
    expect(() => assertCostNotFrozen("IN_PROGRESS" as any)).not.toThrow()
  })

  it("updateRepair rejects agreedCost change on COMPLETED repair", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "COMPLETED",
      agreedCost: "5000.00",
      finalCost: "5000.00",
      completedAt: new Date(),
    })

    await expect(updateRepair(repair.id, { agreedCost: 6000 })).rejects.toThrow(
      "Нельзя изменить стоимость после завершения ремонта",
    )
  })

  it("updateRepair rejects estimatedCost change on DELIVERED repair", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "DELIVERED",
      agreedCost: "5000.00",
      finalCost: "5000.00",
      completedAt: new Date(),
    })

    await expect(updateRepair(repair.id, { estimatedCost: 3000 })).rejects.toThrow(
      "Нельзя изменить стоимость после завершения ремонта",
    )
  })

  it("updateRepair allows cost change on IN_PROGRESS repair (positive case)", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: { id: user.id, storeId: store.id } })

    const repair = await createTestRepair({
      storeId: store.id,
      createdById: user.id,
      status: "IN_PROGRESS",
    })

    await expect(updateRepair(repair.id, { agreedCost: 5000 })).resolves.toEqual({
      success: true,
    })
  })
})
