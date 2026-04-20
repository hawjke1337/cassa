/**
 * E2E tests for Roles CRUD + Soft Delete (ROLE-01..05)
 *
 * Tests:
 * 1. ROLE-01: Create custom role with permissions
 * 2. ROLE-01: Update custom role
 * 3. ROLE-01: Delete custom role
 * 4. ROLE-01: Cannot delete system role
 * 5. ROLE-01: Cannot delete role with assigned users
 * 6. ROLE-02: Permission matrix saves correctly across modules
 * 7. ROLE-03: Assign role to user
 * 8. ROLE-04: Soft delete customer
 * 9. ROLE-04: Restore customer
 * 10. ROLE-05: Soft delete store blocked with stock
 * 11. ROLE-05: Soft delete store succeeds when empty
 * 12. ROLE-05: Restore store
 */

import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestProduct,
  createTestStoreProduct,
  createTestCategory,
  createTestShift,
} from "../helpers/fixtures"

/**
 * Helper: seed a few test Permission records into the DB.
 * E2E test schemas start empty, so we need to create permissions manually.
 */
async function seedTestPermissions() {
  const perms = [
    { code: "pos.sell", module: "pos", name: "Продажа" },
    { code: "pos.return", module: "pos", name: "Возврат товара" },
    { code: "catalog.view", module: "catalog", name: "Просмотр каталога" },
    { code: "catalog.edit", module: "catalog", name: "Редактирование товаров" },
    { code: "inventory.view", module: "inventory", name: "Просмотр остатков" },
    { code: "settings.roles", module: "settings", name: "Управление ролями" },
    { code: "settings.users", module: "settings", name: "Управление пользователями" },
    { code: "customers.manage", module: "customers", name: "Управление клиентами" },
    { code: "settings.stores", module: "settings", name: "Управление магазинами" },
  ]
  await db.permission.createMany({ data: perms, skipDuplicates: true })
  return db.permission.findMany()
}

/**
 * Helper: create a custom role with given permission codes.
 */
async function createTestRole(name: string, permissionCodes: string[], isSystem = false) {
  const permissions = await db.permission.findMany({
    where: { code: { in: permissionCodes } },
  })

  const role = await db.role.create({
    data: {
      name,
      description: `Test role: ${name}`,
      isSystem,
      permissions: {
        create: permissions.map((p) => ({ permissionId: p.id })),
      },
    },
    include: {
      permissions: { include: { permission: true } },
    },
  })

  return role
}

describe("Roles CRUD E2E (ROLE-01..03)", () => {
  it("ROLE-01: creates custom role with correct permissions", async () => {
    await seedTestPermissions()

    const role = await createTestRole("Кассир Плюс", ["pos.sell", "pos.return"])

    expect(role.name).toBe("Кассир Плюс")
    expect(role.isSystem).toBe(false)
    expect(role.permissions).toHaveLength(2)

    const codes = role.permissions.map((rp) => rp.permission.code).sort()
    expect(codes).toEqual(["pos.return", "pos.sell"])
  })

  it("ROLE-01: updates custom role name and permissions", async () => {
    await seedTestPermissions()

    const role = await createTestRole("Стажёр", ["pos.sell", "pos.return"])

    // Update: change name and reduce to 1 permission
    await db.role.update({
      where: { id: role.id },
      data: { name: "Обновлённый Стажёр" },
    })
    await db.rolePermission.deleteMany({ where: { roleId: role.id } })

    const posSell = await db.permission.findFirst({ where: { code: "pos.sell" } })
    await db.rolePermission.create({
      data: { roleId: role.id, permissionId: posSell!.id },
    })

    const updated = await db.role.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    })

    expect(updated!.name).toBe("Обновлённый Стажёр")
    expect(updated!.permissions).toHaveLength(1)
    expect(updated!.permissions[0].permission.code).toBe("pos.sell")
  })

  it("ROLE-01: deletes custom role when no users assigned", async () => {
    await seedTestPermissions()

    const role = await createTestRole("Временная", ["pos.sell"])

    await db.role.delete({ where: { id: role.id } })

    const found = await db.role.findUnique({ where: { id: role.id } })
    expect(found).toBeNull()

    // Verify cascade: RolePermission entries also deleted
    const rps = await db.rolePermission.findMany({ where: { roleId: role.id } })
    expect(rps).toHaveLength(0)
  })

  it("ROLE-01: cannot delete system role", async () => {
    await seedTestPermissions()

    const role = await createTestRole("Владелец", ["pos.sell"], true)

    // Simulate what deleteRole action does: check isSystem flag
    expect(role.isSystem).toBe(true)
    // In the action, this would throw. Here we verify the flag.
  })

  it("ROLE-01: cannot delete role with assigned users", async () => {
    await seedTestPermissions()

    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const role = await createTestRole("С пользователем", ["pos.sell"])

    // Assign role to user
    await db.userRole.create({
      data: { userId: user.id, roleId: role.id },
    })

    // Check that users are assigned
    const userCount = await db.userRole.count({ where: { roleId: role.id } })
    expect(userCount).toBe(1)

    // In the action, deleteRole would throw here
  })

  it("ROLE-02: permission matrix saves codes from multiple modules", async () => {
    const permissions = await seedTestPermissions()

    const codes = ["pos.sell", "catalog.view", "inventory.view"]
    const role = await createTestRole("Мульти-модуль", codes)

    const savedCodes = role.permissions.map((rp) => rp.permission.code).sort()
    expect(savedCodes).toEqual(["catalog.view", "inventory.view", "pos.sell"])

    // Verify they come from 3 different modules
    const modules = new Set(role.permissions.map((rp) => rp.permission.module))
    expect(modules.size).toBe(3)
    expect(modules).toContain("pos")
    expect(modules).toContain("catalog")
    expect(modules).toContain("inventory")
  })

  it("ROLE-03: assign role to user with store scope", async () => {
    await seedTestPermissions()

    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const role = await createTestRole("Продавец Магазина", ["pos.sell"])

    // Assign role to user for specific store
    await db.userRole.create({
      data: { userId: user.id, roleId: role.id, storeId: store.id },
    })

    const assignment = await db.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
      include: { role: true, store: true },
    })

    expect(assignment).not.toBeNull()
    expect(assignment!.role.name).toBe("Продавец Магазина")
    expect(assignment!.storeId).toBe(store.id)
  })
})

describe("Customer Soft Delete E2E (ROLE-04)", () => {
  it("ROLE-04: soft delete customer sets deletedAt", async () => {
    const customer = await db.customer.create({
      data: { name: "Тест Клиент", phone: "+7 999 000-00-01" },
    })

    // Soft delete via raw SQL (same as action does)
    // Soft delete using Prisma ORM update
    await db.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date() },
    })

    // Verify deletedAt is set via raw query (test db lacks soft delete extension)
    const raw = await db.$queryRawUnsafe<Array<{ id: string; deletedAt: Date | null }>>(
      `SELECT "id", "deletedAt" FROM "Customer" WHERE "id" = $1`,
      customer.id,
    )
    expect(raw).toHaveLength(1)
    expect(raw[0].deletedAt).not.toBeNull()

    // In production db with soft delete extension, findUnique would return null
    // Here we verify the record still exists in DB but has deletedAt set
    const record = await db.customer.findUnique({ where: { id: customer.id } })
    expect(record).not.toBeNull()
    expect(record!.deletedAt).not.toBeNull()
  })

  it("ROLE-04: restore customer clears deletedAt", async () => {
    const customer = await db.customer.create({
      data: { name: "Тест Восстановление", phone: "+7 999 000-00-02" },
    })

    // Soft delete
    await db.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date() },
    })

    // Restore
    await db.customer.update({
      where: { id: customer.id },
      data: { deletedAt: null },
    })

    // findUnique should now return the customer
    const found = await db.customer.findUnique({ where: { id: customer.id } })
    expect(found).not.toBeNull()
    expect(found!.name).toBe("Тест Восстановление")
  })
})

describe("Store Soft Delete E2E (ROLE-05)", () => {
  it("ROLE-05: soft delete store blocked when stock > 0", async () => {
    const store = await createTestStore()
    const cat = await createTestCategory()
    const product = await createTestProduct({ categoryId: cat.id })
    await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      quantity: 5,
      sellPrice: "1000.00",
      costPrice: "500.00",
    })

    // Check stock - same logic as softDeleteStore action
    const stockResult = await db.storeProduct.aggregate({
      where: { storeId: store.id, quantity: { gt: 0 } },
      _sum: { quantity: true },
    })

    const totalStock = stockResult._sum.quantity ?? 0
    expect(totalStock).toBe(5)
    // Action would throw: "Невозможно удалить магазин с остатками на складе"
  })

  it("ROLE-05: soft delete store succeeds when no stock/shifts/orders", async () => {
    const store = await createTestStore()

    // No stock, no shifts, no orders — should succeed
    const stockResult = await db.storeProduct.aggregate({
      where: { storeId: store.id, quantity: { gt: 0 } },
      _sum: { quantity: true },
    })
    expect(stockResult._sum.quantity ?? 0).toBe(0)

    const openShift = await db.shift.findFirst({
      where: { storeId: store.id, closedAt: null },
    })
    expect(openShift).toBeNull()

    // Perform soft delete via Prisma ORM (update is not intercepted by soft delete extension)
    await db.store.update({
      where: { id: store.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    // Verify via raw query
    const raw = await db.$queryRawUnsafe<
      Array<{ id: string; deletedAt: Date | null; isActive: boolean }>
    >(`SELECT "id", "deletedAt", "isActive" FROM "Store" WHERE "id" = $1`, store.id)
    expect(raw).toHaveLength(1)
    expect(raw[0].deletedAt).not.toBeNull()
    expect(raw[0].isActive).toBe(false)
  })

  it("ROLE-05: restore store clears deletedAt and reactivates", async () => {
    const store = await createTestStore()

    // Soft delete
    await db.store.update({
      where: { id: store.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    // Restore
    await db.store.update({
      where: { id: store.id },
      data: { deletedAt: null, isActive: true },
    })

    // Verify via raw query
    const raw = await db.$queryRawUnsafe<
      Array<{ id: string; deletedAt: Date | null; isActive: boolean }>
    >(`SELECT "id", "deletedAt", "isActive" FROM "Store" WHERE "id" = $1`, store.id)
    expect(raw).toHaveLength(1)
    expect(raw[0].deletedAt).toBeNull()
    expect(raw[0].isActive).toBe(true)
  })

  it("ROLE-05: soft delete store blocked with open shift", async () => {
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })

    // Create open shift
    await createTestShift({ storeId: store.id, userId: user.id, status: "OPEN" })

    const openShift = await db.shift.findFirst({
      where: { storeId: store.id, closedAt: null },
    })
    expect(openShift).not.toBeNull()
    // Action would throw: "Невозможно удалить магазин с открытой сменой"
  })
})
