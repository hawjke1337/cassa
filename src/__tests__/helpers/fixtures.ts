/**
 * E2E test fixtures — идемпотентные фабрики для создания тестовых данных.
 *
 * Все денежные поля принимаются как string, чтобы избежать float-погрешности
 * (Prisma корректно парсит string → Decimal).
 *
 * Использование:
 *   const store = await createTestStore()
 *   const user = await createTestUser({ storeId: store.id })
 *   const cat = await createTestCategory()
 *   const prod = await createTestProduct({ categoryId: cat.id })
 *   const sp = await createTestStoreProduct({
 *     productId: prod.id,
 *     storeId: store.id,
 *     sellPrice: '1499.99',
 *   })
 */
import { hashSync } from "bcryptjs"
import type {
  Store,
  User,
  Category,
  IdentifierType,
  Product,
  StoreProduct,
  Shift,
  CustomOrder,
  PaymentMethod,
  Repair,
  RepairPart,
  RepairStatus,
  Supplier,
  SupplierDebt,
} from "@/generated/prisma/client"
import { db } from "./db"

let counter = 0
const uniq = () => `${Date.now()}-${++counter}`

export async function createTestStore(overrides: Partial<Store> = {}): Promise<Store> {
  const n = uniq()
  return db.store.create({
    data: {
      name: `Test Store ${n}`,
      address: `ул. Тестовая, ${n}`,
      phone: "+7 (000) 000-00-00",
      ...overrides,
    },
  })
}

export async function createTestUser(
  overrides: { storeId?: string; login?: string; password?: string; role?: string } = {},
): Promise<User> {
  const n = uniq()
  const login = overrides.login ?? `test-user-${n}`
  const password = hashSync(overrides.password ?? "test-password", 4)

  const user = await db.user.create({
    data: {
      login,
      password,
      firstName: "Test",
      lastName: `User-${n}`,
    },
  })

  if (overrides.storeId) {
    await db.userStore.create({
      data: { userId: user.id, storeId: overrides.storeId },
    })
  }

  // BUILD-01: schema drift fix — принимаем `role` для совместимости с e2e
  // тестами (ux-polish.e2e.test.ts:64). Если роль не существует в БД — создаём
  // её. UserRole линкует user↔role↔store (store=null допустим).
  if (overrides.role) {
    const role = await db.role.upsert({
      where: { name: overrides.role },
      update: {},
      create: { name: overrides.role },
    })
    await db.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        storeId: overrides.storeId ?? null,
      },
    })
  }

  return user
}

export async function createTestCategory(
  overrides: {
    name?: string
    isSerialized?: boolean
    // BUILD-01: schema drift fix — принимаем IdentifierType для совместимости
    // с inventory-edge-cases.e2e.test.ts:125 (IMEI/SN/BOTH).
    identifierType?: IdentifierType | "IMEI" | "SN" | "BOTH"
  } = {},
): Promise<Category> {
  const n = uniq()
  return db.category.create({
    data: {
      name: overrides.name ?? `Test Category ${n}`,
      isSerialized: overrides.isSerialized ?? false,
      identifierType: overrides.identifierType ?? null,
    },
  })
}

export async function createTestProduct(
  overrides: { categoryId?: string; name?: string; sku?: string } = {},
): Promise<Product> {
  const n = uniq()

  // Если categoryId не передан — создаём одноразовую категорию
  const categoryId = overrides.categoryId ?? (await createTestCategory()).id

  return db.product.create({
    data: {
      name: overrides.name ?? `Test Product ${n}`,
      sku: overrides.sku ?? `TEST-SKU-${n}`,
      categoryId,
    },
  })
}

export async function createTestStoreProduct(opts: {
  productId: string
  storeId: string
  quantity?: number
  sellPrice?: string
  costPrice?: string
  minQty?: number
}): Promise<StoreProduct> {
  return db.storeProduct.create({
    data: {
      productId: opts.productId,
      storeId: opts.storeId,
      quantity: opts.quantity ?? 10,
      minQty: opts.minQty ?? 0,
      sellPrice: opts.sellPrice ?? "999.99",
      costPrice: opts.costPrice ?? "500.00",
    },
  })
}

/**
 * Создаёт кассовую смену для магазина/пользователя.
 * По умолчанию статус OPEN. Денежные поля — string чтобы избежать float roundtrip.
 */
export async function createTestShift(opts: {
  storeId: string
  userId: string
  status?: "OPEN" | "CLOSED"
  openingCash?: string
}): Promise<Shift> {
  const n = uniq()
  return db.shift.create({
    data: {
      number: `SH-${n}`,
      storeId: opts.storeId,
      openedById: opts.userId,
      status: opts.status ?? "OPEN",
      openingCash: opts.openingCash ?? "0.00",
      openedAt: new Date(),
      closedAt: opts.status === "CLOSED" ? new Date() : null,
    },
  })
}

/**
 * Создаёт CustomOrder с одним или несколькими позициями + внесённую предоплату.
 *
 * Предоплата создаётся как `Payment` с `orderId` и привязкой к открытой смене.
 * CustomOrder.prepaidAmount выставляется в сумму предоплаты.
 *
 * Используется в Wave 0 E2E RED тестах — контракт для Wave 2 completeOrder.
 */
export async function createTestOrderWithPrepayment(opts: {
  storeId: string
  sellerId: string
  shiftId: string
  items: Array<{
    productId?: string
    name?: string
    quantity: number
    price: string
    costPrice?: string
    serialUnitId?: string
    requiresImei?: boolean
  }>
  prepaidAmount: string
  prepaymentMethod?: PaymentMethod
  status?: "NEW" | "PREPAID" | "ORDERED" | "IN_TRANSIT" | "ARRIVED" | "READY_FOR_PICKUP"
  clientName?: string
  clientPhone?: string
}): Promise<CustomOrder> {
  const n = uniq()

  // Суммируем totalAmount из items (price * quantity)
  const totalAmount = opts.items
    .reduce((acc, it) => acc + Number(it.price) * it.quantity, 0)
    .toFixed(2)

  const order = await db.customOrder.create({
    data: {
      number: `O-${n}`,
      storeId: opts.storeId,
      sellerId: opts.sellerId,
      status: opts.status ?? "PREPAID",
      clientName: opts.clientName ?? `Test Client ${n}`,
      clientPhone: opts.clientPhone ?? "+7 (999) 000-00-00",
      totalAmount,
      prepaidAmount: opts.prepaidAmount,
      items: {
        create: opts.items.map((it) => ({
          productId: it.productId,
          name: it.name ?? "Test Item",
          quantity: it.quantity,
          price: it.price,
          costPrice: it.costPrice ?? null,
          serialUnitId: it.serialUnitId,
          requiresImei: it.requiresImei ?? false,
        })),
      },
    },
  })

  // Создаём Payment-предоплату привязанную к order + смене
  if (Number(opts.prepaidAmount) > 0) {
    await db.payment.create({
      data: {
        orderId: order.id,
        method: opts.prepaymentMethod ?? "CASH",
        amount: opts.prepaidAmount,
        shiftId: opts.shiftId,
        storeId: opts.storeId,
        isExpense: false,
      },
    })
  }

  return order
}

/**
 * Создаёт ремонт для E2E тестов.
 * Денежные поля — string (Prisma парсит string → Decimal без потерь).
 */
export async function createTestRepair(opts: {
  storeId: string
  createdById: string
  status?: RepairStatus
  estimatedCost?: string
  agreedCost?: string
  finalCost?: string
  clientName?: string
  clientPhone?: string
  deviceType?: string
  deviceCondition?: string
  defectDescription?: string
  completedAt?: Date
}): Promise<Repair> {
  const n = uniq()
  return db.repair.create({
    data: {
      number: `R-${n}`,
      storeId: opts.storeId,
      createdById: opts.createdById,
      status: opts.status ?? "RECEIVED",
      estimatedCost: opts.estimatedCost ?? null,
      agreedCost: opts.agreedCost ?? null,
      finalCost: opts.finalCost ?? null,
      clientName: opts.clientName ?? "Test Client",
      clientPhone: opts.clientPhone ?? "+79001234567",
      deviceType: opts.deviceType ?? "Смартфон",
      deviceCondition: opts.deviceCondition ?? "Не включается",
      defectDescription: opts.defectDescription ?? "Не работает экран",
      completedAt: opts.completedAt ?? null,
    },
  })
}

/**
 * Создаёт запчасть ремонта для E2E тестов.
 * Денежные поля — string (Prisma парсит string → Decimal без потерь).
 */
export async function createTestRepairPart(opts: {
  repairId: string
  productId: string
  storeId: string
  quantity?: number
  costPrice?: string
}): Promise<RepairPart> {
  return db.repairPart.create({
    data: {
      repairId: opts.repairId,
      productId: opts.productId,
      storeId: opts.storeId,
      quantity: opts.quantity ?? 1,
      costPrice: opts.costPrice ?? "100.00",
    },
  })
}

/**
 * Создаёт поставщика для E2E тестов.
 */
export async function createTestSupplier(opts?: {
  name?: string
  city?: string
  phone?: string
  contactName?: string
}): Promise<Supplier> {
  const n = uniq()
  return db.supplier.create({
    data: {
      name: opts?.name ?? `Test Supplier ${n}`,
      city: opts?.city ?? "Москва",
      phone: opts?.phone ?? `+7 (900) ${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5, 7)}`,
      contactName: opts?.contactName ?? `Contact ${n}`,
    },
  })
}

/**
 * Создаёт CustomOrder с поставщиком + позиции, опционально создаёт SupplierDebt.
 * Используется в E2E тестах для supplier debt scenarios.
 * Денежные поля — string (Prisma парсит string → Decimal без потерь).
 */
export async function createTestOrderWithSupplier(opts: {
  storeId: string
  sellerId: string
  supplierId: string
  items: Array<{
    name?: string
    quantity: number
    price: string
    costPrice?: string
  }>
  status?: "NEW" | "PREPAID" | "ORDERED" | "COMPLETED"
  clientName?: string
  clientPhone?: string
  createDebt?: boolean
}): Promise<CustomOrder & { debt?: SupplierDebt }> {
  const n = uniq()
  const totalAmount = opts.items
    .reduce((acc, it) => acc + Number(it.price) * it.quantity, 0)
    .toFixed(2)

  const order = await db.customOrder.create({
    data: {
      number: `O-${n}`,
      storeId: opts.storeId,
      sellerId: opts.sellerId,
      supplierId: opts.supplierId,
      status: opts.status ?? "NEW",
      clientName: opts.clientName ?? `Client ${n}`,
      clientPhone: opts.clientPhone ?? "+7 (999) 000-00-00",
      totalAmount,
      prepaidAmount: "0",
      items: {
        create: opts.items.map((it) => ({
          name: it.name ?? "Test Item",
          quantity: it.quantity,
          price: it.price,
          costPrice: it.costPrice ?? null,
        })),
      },
    },
  })

  let debt: SupplierDebt | undefined
  if (opts.createDebt !== false && opts.status && ["ORDERED", "COMPLETED"].includes(opts.status)) {
    const debtAmount = opts.items
      .reduce((acc, it) => acc + Number(it.costPrice ?? it.price) * it.quantity, 0)
      .toFixed(2)

    debt = await db.supplierDebt.create({
      data: {
        supplierId: opts.supplierId,
        orderId: order.id,
        amount: debtAmount,
      },
    })
  }

  return { ...order, debt } as CustomOrder & { debt?: SupplierDebt }
}
