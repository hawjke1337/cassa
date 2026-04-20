import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { hashSync } from "bcryptjs"
import { randomBytes } from "node:crypto"
import { PERMISSIONS, ROLE_PRESETS } from "../src/lib/permissions-list"
import { getDefaultLayouts } from "../src/lib/default-document-templates"
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "../src/lib/validations/document-templates"

/**
 * BUILD-02: prisma/seed.ts безопасен для production.
 *
 * Поведение:
 *  - NODE_ENV=production БЕЗ SEED_ALLOW_PROD=true → exit 1 с явным сообщением
 *    (отказ от seed'а без явного подтверждения — предотвращает случайное уничтожение прод-данных).
 *  - NODE_ENV=production + SEED_ALLOW_PROD=true → минимальный prod-bootstrap:
 *    только permissions + role presets + ОДИН admin user с mustChangePassword=true
 *    и сгенерированным одноразовым паролем (выводится в stdout ровно один раз).
 *  - NODE_ENV !== "production" → полный dev-seed: все фикстуры (магазины,
 *    категории, товары, demo-пользователи, мотивация, шаблоны документов).
 *  - --dry-run флаг: после проверки guard сразу exit 0 без подключения к БД
 *    (используется unit-тестами seed-guard).
 */
async function main() {
  // BUILD-02: Prod-safe guard. ДОЛЖЕН быть первым исполняемым кодом в main(),
  // до создания Pool/PrismaClient — иначе случайный запуск в production без
  // SEED_ALLOW_PROD попытается открыть коннекшн и потенциально залочит БД.
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "true") {
    console.error("\n❌ Refusing to seed in production without SEED_ALLOW_PROD=true")
    console.error("   To intentionally bootstrap production, run:")
    console.error("     SEED_ALLOW_PROD=true pnpm prisma db seed\n")
    process.exit(1)
  }

  // --dry-run: guard пройден, реальный seed не выполняем. Используется тестами
  // seed-guard.test.ts для проверки guard поведения без подключения к БД.
  if (process.argv.includes("--dry-run")) {
    console.log("[seed --dry-run] guard passed, exiting without DB connection")
    process.exit(0)
  }

  const isProd = process.env.NODE_ENV === "production"

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  console.log("Seeding database...\n")

  try {
    if (isProd) {
      await seedProduction(prisma)
    } else {
      await seedDevelopment(prisma)
    }
  } finally {
    await pool.end()
  }
}

/**
 * PROD-only bootstrap. Создаёт МИНИМАЛЬНЫЙ набор записей для первого входа
 * владельца в production:
 *   - Permissions (из PERMISSIONS)
 *   - Role presets (из ROLE_PRESETS)
 *   - ОДИН admin user с сгенерированным временным паролем и mustChangePassword=true
 *
 * НЕ создаёт: магазины, demo-пользователей, товары, категории, supplier'ы,
 * document templates, motivation groups/schemes. Все эти фикстуры — dev-only.
 *
 * Идемпотентность: если admin уже существует (login='admin'), seed НЕ
 * перезаписывает его — возвращает без изменений (NOT overwriting existing prod admin).
 */
async function seedProduction(prisma: PrismaClient) {
  console.log("PRODUCTION SEED — minimal bootstrap (permissions + roles + admin only)\n")

  // 1. Permissions (авторитативный список из src/lib/permissions-list.ts)
  console.log("Permissions...")
  const permissionRecords: Record<string, { id: string }> = {}
  for (const perm of Object.values(PERMISSIONS)) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, name: perm.name },
      create: { code: perm.code, module: perm.module, name: perm.name },
    })
    permissionRecords[perm.code] = record
  }
  console.log(`  ${Object.keys(permissionRecords).length} permissions`)

  // 2. Role presets (owner/director/seller/warehouseKeeper и т.д.) — БЕЗ
  // кастомных ролей вроде "Старший продавец" (это dev-only демо-роль).
  console.log("Roles...")
  const roleRecords: Record<string, { id: string }> = {}
  for (const [key, preset] of Object.entries(ROLE_PRESETS)) {
    const role = await prisma.role.upsert({
      where: { name: preset.name },
      update: { description: preset.description, isSystem: preset.isSystem },
      create: { name: preset.name, description: preset.description, isSystem: preset.isSystem },
    })
    roleRecords[key] = role

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    for (const permCode of preset.permissions) {
      const permRecord = permissionRecords[permCode]
      if (!permRecord) {
        console.warn(`  Warning: permission "${permCode}" not found for role "${preset.name}"`)
        continue
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permRecord.id },
      })
    }
    console.log(`  Role "${preset.name}" — ${preset.permissions.length} permissions`)
  }

  // 3. Admin bootstrap. Генерируем одноразовый temp-пароль (8 байт hex = 16 hex-chars),
  // хэшируем через bcryptjs (cost=10 — consistent с остальным кодом), создаём
  // user с mustChangePassword=true. Force-change-on-first-login UI —
  // deferred в Phase 18 (middleware + /settings/password).
  console.log("Admin user bootstrap...")
  const existingAdmin = await prisma.user.findUnique({ where: { login: "admin" } })
  if (existingAdmin) {
    console.log("  admin user already exists — skipping (NOT overwriting existing prod admin)")
    console.log("\n--- Prod seed complete (idempotent, no admin created) ---\n")
    return
  }

  const tempPassword = `admin-${randomBytes(8).toString("hex")}`
  const passwordHash = hashSync(tempPassword, 10)

  const admin = await prisma.user.create({
    data: {
      login: "admin",
      password: passwordHash,
      firstName: "Администратор",
      lastName: "Системный",
      mustChangePassword: true,
    },
  })

  // Назначаем owner role (глобально, storeId=null — доступ ко всем магазинам).
  const ownerRole = roleRecords["owner"]
  if (ownerRole) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: ownerRole.id, storeId: null },
    })
  } else {
    console.warn("  Warning: ROLE_PRESETS.owner missing — admin has NO role assigned")
  }

  // Temp-password: выводим один раз с явным предупреждением. НЕ логируется
  // в файл, НЕ попадает в structured logging — только stdout один раз.
  // Оператор ОБЯЗАН скопировать пароль при bootstrap'е, иначе потребуется
  // ручной password reset через БД.
  console.log("\n" + "=".repeat(70))
  console.log("⚠️  FIRST-RUN ADMIN CREATED — SAVE THIS PASSWORD NOW")
  console.log("=".repeat(70))
  console.log(`  Login:         admin`)
  console.log(`  Temp password: ${tempPassword}`)
  console.log(`  ⚠️  Password expires on first login — MUST be changed immediately.`)
  console.log(`  ⚠️  This message will NOT be shown again. Copy the password now.`)
  console.log("=".repeat(70) + "\n")
}

/**
 * DEV-only full seed. Создаёт все фикстуры для локальной разработки и
 * демонстрации: магазины, категории, товары, demo-пользователи с известными
 * паролями, motivation groups/schemes, document templates.
 *
 * ВАЖНО: Эта функция НЕ должна вызываться в production — guard в main()
 * гарантирует что сюда попадают только NODE_ENV !== "production" запуски.
 */
async function seedDevelopment(prisma: PrismaClient) {
  // =============================================
  // 1. Stores
  // =============================================
  console.log("Stores...")
  const storesData = [
    {
      id: "seed-store-central",
      name: "a:store Центральный",
      address: "ул. Ленина, 15",
      phone: "+7 (999) 111-11-11",
    },
    {
      id: "seed-store-mega",
      name: "a:store ТЦ Мега",
      address: "ТЦ Мега, 2 этаж",
      phone: "+7 (999) 222-22-22",
    },
    {
      id: "seed-store-south",
      name: "a:store Южный",
      address: "ул. Мира, 42",
      phone: "+7 (999) 333-33-33",
    },
  ]

  const stores = []
  for (const s of storesData) {
    const store = await prisma.store.upsert({
      where: { id: s.id },
      update: { name: s.name, address: s.address, phone: s.phone },
      create: s,
    })
    stores.push(store)
  }
  console.log(`  ${stores.length} stores`)

  // =============================================
  // 2. Permissions
  // =============================================
  console.log("Permissions...")
  const permissionRecords: Record<string, { id: string }> = {}
  for (const perm of Object.values(PERMISSIONS)) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, name: perm.name },
      create: {
        code: perm.code,
        module: perm.module,
        name: perm.name,
      },
    })
    permissionRecords[perm.code] = record
  }
  console.log(`  ${Object.keys(permissionRecords).length} permissions`)

  // =============================================
  // 3. Roles (from ROLE_PRESETS + custom)
  // =============================================
  console.log("Roles...")
  const roleRecords: Record<string, { id: string }> = {}
  for (const [key, preset] of Object.entries(ROLE_PRESETS)) {
    const role = await prisma.role.upsert({
      where: { name: preset.name },
      update: { description: preset.description, isSystem: preset.isSystem },
      create: {
        name: preset.name,
        description: preset.description,
        isSystem: preset.isSystem,
      },
    })
    roleRecords[key] = role

    // Clear existing and re-add permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    for (const permCode of preset.permissions) {
      const permRecord = permissionRecords[permCode]
      if (!permRecord) {
        console.warn(`  Warning: permission "${permCode}" not found for role "${preset.name}"`)
        continue
      }
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permRecord.id,
        },
      })
    }
    console.log(`  Role "${preset.name}" — ${preset.permissions.length} permissions`)
  }

  // Additional roles not in ROLE_PRESETS
  const seniorSellerPerms = [
    "catalog.view",
    "catalog.edit",
    "pos.sell",
    "pos.return",
    "pos.discount",
    "pos.reports",
    "inventory.view",
    "inventory.receive",
    "inventory.transfer",
    "orders.view",
    "orders.create",
    "orders.manage",
    "suppliers.view",
    "reports.sales",
  ]
  const seniorRole = await prisma.role.upsert({
    where: { name: "Старший продавец" },
    update: { description: "Расширенные права продавца", isSystem: true },
    create: { name: "Старший продавец", description: "Расширенные права продавца", isSystem: true },
  })
  roleRecords["senior_seller"] = seniorRole
  await prisma.rolePermission.deleteMany({ where: { roleId: seniorRole.id } })
  for (const permCode of seniorSellerPerms) {
    const permRecord = permissionRecords[permCode]
    if (permRecord) {
      await prisma.rolePermission.create({
        data: { roleId: seniorRole.id, permissionId: permRecord.id },
      })
    }
  }
  console.log(`  Role "Старший продавец" — ${seniorSellerPerms.length} permissions`)

  // =============================================
  // 4. Users
  // =============================================
  console.log("Users...")

  // Admin user
  const adminPassword = hashSync("admin123", 10)
  const admin = await prisma.user.upsert({
    where: { login: "admin" },
    update: {},
    create: {
      login: "admin",
      password: adminPassword,
      firstName: "Администратор",
      lastName: "Системный",
    },
  })

  // Assign admin to all stores
  for (const store of stores) {
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: admin.id, storeId: store.id } },
      update: {},
      create: { userId: admin.id, storeId: store.id },
    })
  }

  // Assign Owner role to admin (global, no storeId)
  const ownerRole = roleRecords["owner"]
  if (ownerRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: ownerRole.id, storeId: null },
    })
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: ownerRole.id, storeId: null },
      })
    }
  }
  console.log("  admin / admin123 (Владелец, все магазины)")

  // Seller user
  const sellerPassword = hashSync("seller123", 10)
  const seller = await prisma.user.upsert({
    where: { login: "seller" },
    update: {},
    create: {
      login: "seller",
      password: sellerPassword,
      firstName: "Иван",
      lastName: "Продавцов",
    },
  })

  // Assign seller to first store
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: seller.id, storeId: stores[0].id } },
    update: {},
    create: { userId: seller.id, storeId: stores[0].id },
  })

  // Assign Seller role for first store
  const sellerRoleRecord = roleRecords["seller"]
  if (sellerRoleRecord) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: seller.id, roleId: sellerRoleRecord.id, storeId: stores[0].id },
    })
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: seller.id, roleId: sellerRoleRecord.id, storeId: stores[0].id },
      })
    }
  }
  console.log("  seller / seller123 (Продавец, a:store Центральный)")

  // Senior seller user
  const seniorPassword = hashSync("senior123", 10)
  const senior = await prisma.user.upsert({
    where: { login: "senior" },
    update: {},
    create: {
      login: "senior",
      password: seniorPassword,
      firstName: "Мария",
      lastName: "Старшенко",
    },
  })

  // Assign senior to first two stores
  for (const store of stores.slice(0, 2)) {
    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: senior.id, storeId: store.id } },
      update: {},
      create: { userId: senior.id, storeId: store.id },
    })
  }

  // Assign Senior seller role for first store
  const existingSeniorRole = await prisma.userRole.findFirst({
    where: { userId: senior.id, roleId: seniorRole.id, storeId: stores[0].id },
  })
  if (!existingSeniorRole) {
    await prisma.userRole.create({
      data: { userId: senior.id, roleId: seniorRole.id, storeId: stores[0].id },
    })
  }
  console.log("  senior / senior123 (Старший продавец, Центральный + ТЦ Мега)")

  // =============================================
  // 5. Categories
  // =============================================
  console.log("Categories...")
  const categoryData: Array<{
    id: string
    name: string
    isSerialized?: boolean
    identifierType?: "IMEI" | "SN" | "BOTH"
  }> = [
    { id: "cat-smartphones", name: "Смартфоны", isSerialized: true, identifierType: "IMEI" },
    { id: "cat-tablets", name: "Планшеты", isSerialized: true, identifierType: "IMEI" },
    { id: "cat-headphones", name: "Наушники" },
    { id: "cat-cases", name: "Чехлы" },
    { id: "cat-chargers", name: "Зарядные устройства" },
    { id: "cat-cables", name: "Кабели" },
    { id: "cat-glass", name: "Защитные стёкла" },
    { id: "cat-accessories", name: "Аксессуары" },
  ]

  const categoryRecords: Record<string, { id: string }> = {}
  for (const cat of categoryData) {
    const record = await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        isSerialized: cat.isSerialized ?? false,
        identifierType: cat.identifierType ?? null,
      },
      create: {
        id: cat.id,
        name: cat.name,
        isSerialized: cat.isSerialized ?? false,
        identifierType: cat.identifierType ?? null,
      },
    })
    categoryRecords[cat.id] = record
  }
  console.log(`  ${categoryData.length} categories`)

  // =============================================
  // 6. Brands
  // =============================================
  console.log("Brands...")
  const brandData = [
    { id: "brand-apple", name: "Apple" },
    { id: "brand-samsung", name: "Samsung" },
    { id: "brand-xiaomi", name: "Xiaomi" },
    { id: "brand-huawei", name: "Huawei" },
    { id: "brand-jbl", name: "JBL" },
    { id: "brand-sony", name: "Sony" },
    { id: "brand-baseus", name: "Baseus" },
    { id: "brand-anker", name: "Anker" },
  ]

  const brandRecords: Record<string, { id: string }> = {}
  for (const br of brandData) {
    const record = await prisma.brand.upsert({
      where: { id: br.id },
      update: { name: br.name },
      create: { id: br.id, name: br.name },
    })
    brandRecords[br.id] = record
  }
  console.log(`  ${brandData.length} brands`)

  // =============================================
  // 7. Products (18 products across all categories)
  // =============================================
  console.log("Products...")
  const productData = [
    // Smartphones
    {
      id: "prod-iphone15",
      name: "iPhone 15 128GB",
      sku: "APL-IP15-128",
      barcode: "1000000001",
      catId: "cat-smartphones",
      brandId: "brand-apple",
      sell: 79990,
      cost: 65000,
    },
    {
      id: "prod-iphone15pro",
      name: "iPhone 15 Pro 256GB",
      sku: "APL-IP15P-256",
      barcode: "1000000002",
      catId: "cat-smartphones",
      brandId: "brand-apple",
      sell: 119990,
      cost: 95000,
    },
    {
      id: "prod-galaxy-s24",
      name: "Samsung Galaxy S24",
      sku: "SAM-GS24",
      barcode: "1000000003",
      catId: "cat-smartphones",
      brandId: "brand-samsung",
      sell: 69990,
      cost: 55000,
    },
    {
      id: "prod-xiaomi14",
      name: "Xiaomi 14",
      sku: "XIA-14",
      barcode: "1000000004",
      catId: "cat-smartphones",
      brandId: "brand-xiaomi",
      sell: 44990,
      cost: 35000,
    },
    // Tablets
    {
      id: "prod-ipad-air",
      name: "iPad Air M2",
      sku: "APL-IPAD-AIR",
      barcode: "1000000005",
      catId: "cat-tablets",
      brandId: "brand-apple",
      sell: 59990,
      cost: 48000,
    },
    {
      id: "prod-galaxy-tab",
      name: "Samsung Galaxy Tab S9",
      sku: "SAM-TABS9",
      barcode: "1000000006",
      catId: "cat-tablets",
      brandId: "brand-samsung",
      sell: 49990,
      cost: 38000,
    },
    // Headphones
    {
      id: "prod-airpods-pro",
      name: "AirPods Pro 2",
      sku: "APL-APP2",
      barcode: "1000000007",
      catId: "cat-headphones",
      brandId: "brand-apple",
      sell: 24990,
      cost: 18000,
    },
    {
      id: "prod-jbl-t770",
      name: "JBL Tune 770NC",
      sku: "JBL-T770",
      barcode: "1000000008",
      catId: "cat-headphones",
      brandId: "brand-jbl",
      sell: 7990,
      cost: 5500,
    },
    {
      id: "prod-sony-xm5",
      name: "Sony WH-1000XM5",
      sku: "SONY-XM5",
      barcode: "1000000009",
      catId: "cat-headphones",
      brandId: "brand-sony",
      sell: 29990,
      cost: 22000,
    },
    // Cases
    {
      id: "prod-case-ip15",
      name: "Чехол iPhone 15 Clear",
      sku: "CASE-IP15-CLR",
      barcode: "1000000010",
      catId: "cat-cases",
      brandId: "brand-apple",
      sell: 2490,
      cost: 800,
    },
    {
      id: "prod-case-s24",
      name: "Чехол Samsung S24 Silicone",
      sku: "CASE-S24-SIL",
      barcode: "1000000011",
      catId: "cat-cases",
      brandId: "brand-samsung",
      sell: 1990,
      cost: 600,
    },
    // Chargers
    {
      id: "prod-baseus-gan65",
      name: "Baseus GaN 65W",
      sku: "BAS-GAN65",
      barcode: "1000000012",
      catId: "cat-chargers",
      brandId: "brand-baseus",
      sell: 3490,
      cost: 1800,
    },
    {
      id: "prod-anker-pp3",
      name: "Anker PowerPort III",
      sku: "ANK-PP3",
      barcode: "1000000013",
      catId: "cat-chargers",
      brandId: "brand-anker",
      sell: 2990,
      cost: 1500,
    },
    // Cables
    {
      id: "prod-cable-cl",
      name: "Кабель USB-C Lightning 1m",
      sku: "CBL-CL-1M",
      barcode: "1000000014",
      catId: "cat-cables",
      brandId: "brand-apple",
      sell: 1990,
      cost: 700,
    },
    {
      id: "prod-cable-cc",
      name: "Кабель USB-C USB-C 2m",
      sku: "CBL-CC-2M",
      barcode: "1000000015",
      catId: "cat-cables",
      brandId: "brand-baseus",
      sell: 990,
      cost: 350,
    },
    // Screen protectors
    {
      id: "prod-glass-ip15",
      name: "Защитное стекло iPhone 15",
      sku: "GLASS-IP15",
      barcode: "1000000016",
      catId: "cat-glass",
      brandId: null,
      sell: 990,
      cost: 200,
    },
    {
      id: "prod-glass-s24",
      name: "Защитное стекло Samsung S24",
      sku: "GLASS-S24",
      barcode: "1000000017",
      catId: "cat-glass",
      brandId: null,
      sell: 890,
      cost: 180,
    },
    // Accessories
    {
      id: "prod-holder-mag",
      name: "Автодержатель магнитный",
      sku: "ACC-HOLDER-MAG",
      barcode: "1000000018",
      catId: "cat-accessories",
      brandId: "brand-baseus",
      sell: 1490,
      cost: 500,
    },
  ]

  for (const [pIdx, prod] of productData.entries()) {
    const product = await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        categoryId: prod.catId,
        brandId: prod.brandId,
      },
      create: {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        categoryId: prod.catId,
        brandId: prod.brandId,
      },
    })

    // Add stock to all stores with varying deterministic quantities
    for (let i = 0; i < stores.length; i++) {
      const qty = ((pIdx * 7 + i * 3) % 15) + 1
      await prisma.storeProduct.upsert({
        where: {
          storeId_productId: {
            storeId: stores[i].id,
            productId: product.id,
          },
        },
        update: {
          sellPrice: prod.sell,
          costPrice: prod.cost,
          quantity: qty,
          minQty: 3,
        },
        create: {
          storeId: stores[i].id,
          productId: product.id,
          sellPrice: prod.sell,
          costPrice: prod.cost,
          quantity: qty,
          minQty: 3,
        },
      })
    }
  }
  console.log(`  ${productData.length} products with stock in ${stores.length} stores`)

  // =============================================
  // 8. Suppliers
  // =============================================
  console.log("Suppliers...")
  const suppliersData = [
    {
      id: "sup-technoimport",
      name: "ООО Техноимпорт",
      contactName: "Алексей Козлов",
      phone: "+7 (495) 111-22-33",
      email: "info@technoimport.ru",
      city: "Москва",
      inn: "7701234567",
    },
    {
      id: "sup-kim",
      name: "ИП Ким А.С.",
      contactName: "Андрей Ким",
      phone: "+7 (916) 444-55-66",
      city: "Москва",
    },
    {
      id: "sup-china-direct",
      name: "China Direct Supply",
      contactName: "Li Wei",
      email: "liwei@cds.cn",
      city: "Шэньчжэнь",
    },
  ]

  for (const s of suppliersData) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        city: s.city,
        inn: s.inn,
      },
      create: s,
    })
  }
  console.log(`  ${suppliersData.length} suppliers`)

  // =============================================
  // 9. Default Document Templates
  // =============================================
  console.log("Document templates...")
  const defaultLayouts = getDefaultLayouts()
  let templateCount = 0

  for (const store of stores) {
    for (const docType of DOCUMENT_TYPES) {
      const existing = await prisma.documentTemplate.findFirst({
        where: { storeId: store.id, type: docType as any, isDefault: true },
      })
      if (!existing) {
        await prisma.documentTemplate.create({
          data: {
            storeId: store.id,
            name: DOCUMENT_TYPE_LABELS[docType],
            type: docType as any,
            layout: defaultLayouts[docType] as object,
            isDefault: true,
            createdById: admin.id,
          },
        })
        templateCount++
      }
    }
  }
  console.log(`  ${templateCount} default document templates`)

  // =============================================
  // 10. Motivation Groups
  // =============================================
  console.log("Motivation groups...")
  const motivationGroups = [
    { code: "ТехОсн", name: "Техника основная (Samsung, прочие)" },
    { code: "IPhCтр", name: "iPhone SE/11/12/13" },
    { code: "ТехОсн2", name: "iPhone остальные" },
    { code: "МакСтр", name: "iMac/MacBook Pro старые" },
    {
      code: "ТехОсн3",
      name: "MacBook, iPad, iMac Pro топы, приставки, AirPods, PS5, Watch, Dyson",
    },
    { code: "ПортА", name: "Портативная техника Apple" },
    { code: "АксПрем", name: "Аксессуары Премиум (>4000)" },
    { code: "Акс", name: "Аксессуары не премиум (<4000)" },
    { code: "КомпИгр", name: "Комплектующие к игровым приставкам" },
    { code: "Ориг", name: "Оригинальные аксессуары" },
    { code: "Экран", name: "Стёкла/Плёнки" },
    { code: "ПортТ", name: "Портативная техника (не Apple)" },
    { code: "СОКред", name: "Сервисное обслуживание (Кредит/Халва)" },
    { code: "СОНал", name: "Сервисное обслуживание (Наличные/Карта/QR)" },
    { code: "УслугиН", name: "Услуги/Настройка устройства" },
  ]

  for (const mg of motivationGroups) {
    await prisma.motivationGroup.upsert({
      where: { code: mg.code },
      update: { name: mg.name },
      create: mg,
    })
  }
  console.log(`  ${motivationGroups.length} motivation groups`)

  // =============================================
  // 11. Default Motivation Scheme
  // =============================================
  console.log("Default motivation scheme...")
  const allGroups = await prisma.motivationGroup.findMany()
  const groupByCode = new Map(allGroups.map((g) => [g.code, g.id]))

  const commissionRules = [
    { code: "ТехОсн", rate: 0.14, basis: "PROFIT" },
    { code: "IPhCтр", rate: 0.2, basis: "PROFIT" },
    { code: "ТехОсн2", rate: 0.14, basis: "PROFIT" },
    { code: "МакСтр", rate: 0.17, basis: "PROFIT" },
    { code: "ТехОсн3", rate: 0.14, basis: "PROFIT" },
    { code: "ПортА", rate: 0.8, basis: "PROFIT" },
    { code: "АксПрем", rate: 0.08, basis: "PROFIT" },
    { code: "Акс", rate: 0.1, basis: "RETAIL_PRICE" },
    { code: "КомпИгр", rate: 0.2, basis: "PROFIT" },
    { code: "Ориг", rate: 0.14, basis: "PROFIT" },
    { code: "Экран", rate: 0.15, basis: "RETAIL_PRICE" },
    { code: "ПортТ", rate: 0.1, basis: "PROFIT" },
    { code: "СОКред", rate: 0.2, basis: "RETAIL_PRICE" },
    { code: "СОНал", rate: 0.4, basis: "RETAIL_PRICE" },
    { code: "УслугиН", rate: 0.3, basis: "RETAIL_PRICE" },
  ].map((r) => ({
    groupId: groupByCode.get(r.code)!,
    rate: r.rate,
    basis: r.basis,
  }))

  const sellerSchemeFormula = {
    dailyRate: 1000,
    commissionRules,
    defaultCommission: { rate: 0.14, basis: "PROFIT" },
    crossSellBonuses: [
      { minItems: 2, bonus: 200 },
      { minItems: 3, bonus: 400 },
      { minItems: 4, bonus: 600 },
    ],
    repairBonus: 300,
  }

  await prisma.motivationScheme.upsert({
    where: { id: "default-seller-scheme" },
    update: { formula: sellerSchemeFormula as unknown as object },
    create: {
      id: "default-seller-scheme",
      name: "Продавец стандарт",
      description: "Стандартная схема мотивации для продавцов",
      formula: sellerSchemeFormula as unknown as object,
      createdById: admin.id,
      status: "ACTIVE",
    },
  })
  console.log("  Default seller scheme created")

  // =============================================
  // Done
  // =============================================
  console.log("\n--- Seed complete! ---")
  console.log("Login: admin / admin123   (Владелец, все магазины)")
  console.log("Login: seller / seller123  (Продавец, a:store Центральный)")
  console.log("Login: senior / senior123  (Старший продавец, Центральный + ТЦ Мега)")
  console.log("---------------------\n")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
