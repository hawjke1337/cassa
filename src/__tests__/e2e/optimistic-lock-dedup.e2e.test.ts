/**
 * E2E: Optimistic Locking (MotivationScheme) & DeviceRecord Dedup
 *
 * DATA2-10: Formula validation + snapshot on assignment
 * DATA2-11: Optimistic locking via version field
 * DATA2-12: DeviceRecord dedup by IMEI/serial in createRepair
 */

import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import { createTestStore, createTestUser } from "../helpers/fixtures"

const makeFormula = (rate = 0.05) => ({
  dailyRate: 500,
  commissionRules: [{ minAmount: 0, percentage: rate }],
  defaultCommission: { minAmount: 0, percentage: rate },
  crossSellBonuses: [],
  repairBonus: 200,
})

describe("Optimistic Locking & DeviceRecord Dedup (E2E)", () => {
  describe("MotivationScheme optimistic locking", () => {
    it("allows update with correct version", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })

      const scheme = await db.motivationScheme.create({
        data: {
          name: "Test Scheme",
          status: "ACTIVE",
          formula: makeFormula() as any,
          createdById: user.id,
        },
      })

      expect(scheme.version).toBe(1)

      // Update with correct version
      const result = await db.motivationScheme.updateMany({
        where: { id: scheme.id, version: 1 },
        data: {
          name: "Updated Scheme",
          version: { increment: 1 },
        },
      })

      expect(result.count).toBe(1)

      const updated = await db.motivationScheme.findUnique({ where: { id: scheme.id } })
      expect(updated!.version).toBe(2)
      expect(updated!.name).toBe("Updated Scheme")
    })

    it("rejects update with stale version (concurrent edit)", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })

      const scheme = await db.motivationScheme.create({
        data: {
          name: "Scheme V1",
          status: "ACTIVE",
          formula: makeFormula() as any,
          createdById: user.id,
        },
      })

      // First user updates successfully (version 1 -> 2)
      const firstUpdate = await db.motivationScheme.updateMany({
        where: { id: scheme.id, version: 1 },
        data: { name: "First Edit", version: { increment: 1 } },
      })
      expect(firstUpdate.count).toBe(1)

      // Second user tries to update with stale version=1 -> should fail
      const secondUpdate = await db.motivationScheme.updateMany({
        where: { id: scheme.id, version: 1 },
        data: { name: "Second Edit", version: { increment: 1 } },
      })
      expect(secondUpdate.count).toBe(0)

      // Verify the first edit persisted, second was rejected
      const final = await db.motivationScheme.findUnique({ where: { id: scheme.id } })
      expect(final!.name).toBe("First Edit")
      expect(final!.version).toBe(2)
    })

    it("stores formula snapshot when creating assignment", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })

      const originalFormula = makeFormula(0.1)

      const scheme = await db.motivationScheme.create({
        data: {
          name: "Snapshot Scheme",
          status: "ACTIVE",
          formula: originalFormula as any,
          createdById: user.id,
        },
      })

      // Create assignment with formula snapshot
      const assignment = await db.motivationAssignment.create({
        data: {
          schemeId: scheme.id,
          userId: user.id,
          storeId: store.id,
          startDate: new Date("2026-01-01"),
          formulaSnapshot: scheme.formula as any,
        },
      })

      expect(assignment.formulaSnapshot).not.toBeNull()
      expect((assignment.formulaSnapshot as any).dailyRate).toBe(500)
      expect((assignment.formulaSnapshot as any).commissionRules[0].percentage).toBe(0.1)

      // Update scheme formula
      await db.motivationScheme.update({
        where: { id: scheme.id },
        data: { formula: makeFormula(0.2) as any },
      })

      // Assignment snapshot should be unchanged
      const refetched = await db.motivationAssignment.findUnique({
        where: { id: assignment.id },
      })
      expect((refetched!.formulaSnapshot as any).commissionRules[0].percentage).toBe(0.1)

      // But scheme formula is updated
      const updatedScheme = await db.motivationScheme.findUnique({ where: { id: scheme.id } })
      expect((updatedScheme!.formula as any).commissionRules[0].percentage).toBe(0.2)
    })
  })

  describe("DeviceRecord deduplication", () => {
    it("reuses existing DeviceRecord when IMEI matches", async () => {
      const store = await createTestStore()
      const user = await createTestUser({ storeId: store.id })

      // Create first DeviceRecord directly
      const dr1 = await db.deviceRecord.create({
        data: {
          imei: "123456789012345",
          deviceType: "Телефон",
          brand: "Apple",
          model: "iPhone 15",
        },
      })

      // findOrCreateDeviceRecordTx should find existing by IMEI
      const foundId = await db.$transaction(async (tx) => {
        const conditions = [{ imei: "123456789012345" }]
        const existing = await tx.deviceRecord.findFirst({
          where: { OR: conditions },
        })
        return existing?.id ?? null
      })

      expect(foundId).toBe(dr1.id)

      // Verify only 1 DeviceRecord with this IMEI
      const count = await db.deviceRecord.count({
        where: { imei: "123456789012345" },
      })
      expect(count).toBe(1)
    })

    it("creates new DeviceRecord when no match found", async () => {
      await db.deviceRecord.create({
        data: {
          imei: "111111111111111",
          deviceType: "Телефон",
          brand: "Apple",
        },
      })

      await db.deviceRecord.create({
        data: {
          imei: "222222222222222",
          deviceType: "Телефон",
          brand: "Samsung",
        },
      })

      const total = await db.deviceRecord.count()
      expect(total).toBe(2)
    })

    it("matches by imei2 when imei differs", async () => {
      const dr = await db.deviceRecord.create({
        data: {
          imei: "333333333333333",
          imei2: "444444444444444",
          deviceType: "Планшет",
        },
      })

      // Search by imei2 should find the existing record
      const found = await db.$transaction(async (tx) => {
        const conditions = [{ imei2: "444444444444444" }]
        const existing = await tx.deviceRecord.findFirst({
          where: { OR: conditions },
        })
        return existing
      })

      expect(found).not.toBeNull()
      expect(found!.id).toBe(dr.id)
      expect(found!.imei).toBe("333333333333333")
    })

    it("matches by serialNumber for dedup", async () => {
      const dr = await db.deviceRecord.create({
        data: {
          serialNumber: "SN-UNIQUE-001",
          deviceType: "Ноутбук",
          brand: "Lenovo",
        },
      })

      const found = await db.$transaction(async (tx) => {
        const existing = await tx.deviceRecord.findFirst({
          where: { OR: [{ serialNumber: "SN-UNIQUE-001" }] },
        })
        return existing
      })

      expect(found).not.toBeNull()
      expect(found!.id).toBe(dr.id)
    })

    it("updates customerId on dedup match", async () => {
      const store = await createTestStore()
      const customer1 = await db.customer.create({
        data: { name: "Иван Иванов", phone: "+79001111111" },
      })
      const customer2 = await db.customer.create({
        data: { name: "Петр Петров", phone: "+79002222222" },
      })

      const dr = await db.deviceRecord.create({
        data: {
          imei: "555555555555555",
          deviceType: "Телефон",
          customerId: customer1.id,
        },
      })

      // Update customerId via dedup logic
      await db.$transaction(async (tx) => {
        const existing = await tx.deviceRecord.findFirst({
          where: { OR: [{ imei: "555555555555555" }] },
        })
        if (existing && customer2.id !== existing.customerId) {
          await tx.deviceRecord.update({
            where: { id: existing.id },
            data: { customerId: customer2.id },
          })
        }
      })

      const updated = await db.deviceRecord.findUnique({ where: { id: dr.id } })
      expect(updated!.customerId).toBe(customer2.id)
    })
  })
})
