# Phase 3: Схема БД - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Укрепить схему БД: добавить недостающие индексы для производительности запросов, определить onDelete правила на все FK, добавить soft delete (deletedAt) на справочники, updatedAt на все таблицы с мутациями, и CHECK constraints на уровне СУБД для price/quantity/amount >= 0. Чисто миграционная фаза — server actions затрагиваются минимально (фильтрация по deletedAt).

</domain>

<decisions>
## Implementation Decisions

### Индексы (DB-01)
- Приоритетные индексы на часто используемые запросы:
  - Sale: `@@index([storeId, createdAt])`, `@@index([sellerId])`, `@@index([shiftId])`
  - SaleItem: `@@index([saleId])`, `@@index([productId])`
  - Payment: `@@index([saleId])`, `@@index([shiftId])`, `@@index([type])`
  - StoreProduct: `@@index([storeId, productId])` (уже есть @@unique)
  - StockReceive: `@@index([storeId, createdAt])`, `@@index([supplierId])`
  - Repair: `@@index([storeId, status])`, `@@index([customerId])`
  - TradeIn: `@@index([storeId, status])`
  - SerialUnit: `@@index([productId])`, `@@index([storeId, status])`
  - Return: `@@index([saleId])`, `@@index([storeId, createdAt])`
  - CustomOrder: `@@index([storeId, status])`, `@@index([customerId])`
- Все индексы добавить через Prisma schema `@@index()` — стандартный подход
- Не добавлять индексы на таблицы < 100 строк (Role, Permission, Counter, Brand)

### Уникальные constraints (DB-07)
- `@@unique([name, parentId])` на Category — предотвратить дублирование категорий на одном уровне
- `@@unique` на Supplier.inn — ИНН должен быть уникальным (если есть поле inn)
- Проверить что Category.parentId nullable (для корневых категорий)

### onDelete правила (DB-02)
- **Cascade** — дочерние записи, не имеющие смысла без родителя:
  - SaleItem → Sale, ReturnItem → Return, StockReceiveItem → StockReceive
  - StockTransferItem → StockTransfer, StockWriteOffItem → StockWriteOff
  - InventoryAuditItem → InventoryAudit, CustomOrderItem → CustomOrder
  - OrderStatusHistory → CustomOrder, RepairStatusHistory → Repair
  - RolePermission → Role/Permission, UserRole → User/Role
  - MotivationGroupProduct → MotivationScheme, MotivationAssignment → User/Store
  - SerialUnitHistory → SerialUnit, StockTransferItemSerial → StockTransferItem
- **Restrict** — нельзя удалять если есть зависимые:
  - Product ← SaleItem, StoreProduct, SerialUnit (нельзя удалить товар с историей продаж)
  - Store ← Sale, StoreProduct, Shift (нельзя удалить магазин с данными)
  - User ← Sale (как seller), Shift (нельзя удалить пользователя с продажами)
  - Supplier ← StockReceive (нельзя удалить поставщика с приходами)
  - Customer ← Repair, CustomOrder (нельзя удалить клиента с заказами)
- **SetNull** — опциональные связи:
  - Sale.shiftId → Shift (продажа может существовать без смены)
  - Product.brandId → Brand (товар может быть без бренда)
  - StockReceive.supplierId → Supplier (приход может быть без поставщика)

### PriceHistory FK (DB-03)
- storeId как FK на Store (сейчас просто string)
- changedBy как FK на User (сейчас просто string)
- onDelete: Restrict (не удалять Store/User если есть history)

### Soft delete (DB-04)
- Добавить `deletedAt DateTime?` на: Product, Supplier, Customer, Store, User
- НЕ добавлять на транзакционные таблицы (Sale, Payment, Return) — они не удаляются
- Фильтрация: добавить `where: { deletedAt: null }` во все findMany/findFirst для этих моделей
- Подход: Prisma middleware (`$use`) для автоматической фильтрации — один раз настроить, работает везде
- Soft-deleted записи доступны через explicit `where: { deletedAt: { not: null } }` для admin
- При soft delete: проверить Restrict constraints — если есть active зависимости, запретить soft delete тоже

### updatedAt (DB-05)
- Добавить `updatedAt DateTime @updatedAt` на все модели без updatedAt (35 моделей)
- Prisma `@updatedAt` автоматически обновляет при каждом update
- Для lookup-таблиц (Role, Permission, Counter) — тоже добавить для консистентности
- Одна миграция для всех updatedAt полей

### CHECK constraints (DB-06)
- Prisma не поддерживает CHECK constraints нативно
- Добавить через raw SQL в отдельной миграции: `prisma migrate dev --create-only`, затем вручную добавить ALTER TABLE
- Constraints:
  - `StoreProduct: CHECK (quantity >= 0)`
  - `StoreProduct: CHECK ("sellPrice" >= 0 AND "costPrice" >= 0)`
  - `SaleItem: CHECK (price >= 0 AND "costPrice" >= 0 AND quantity > 0)`
  - `Payment: CHECK (amount > 0)`
  - `StockReceiveItem: CHECK (quantity > 0 AND "costPrice" >= 0)`
  - `Return/ReturnItem: CHECK (amount >= 0)`
  - `Fund: CHECK (balance >= 0)` — если applicable
- Проверить существующие данные ПЕРЕД добавлением constraints — исправить невалидные записи

### Claude's Discretion
- Точный порядок индексов в составных @@index (какое поле первое)
- Нужно ли покрывающие индексы (INCLUDE) для отчётов
- Batch size при миграции updatedAt (все 35 за раз vs по частям)
- Формат именования constraints (например, `chk_store_product_quantity_gte0`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (DB-01..DB-07).

### Ключевые файлы
- `prisma/schema.prisma` — текущая схема (51 модель, 55 индексов, 17 onDelete, 0 deletedAt, 16 updatedAt)
- `src/lib/db.ts` — Prisma client instance (место для middleware)
- `.planning/phases/01-security/01-CONTEXT.md` — паттерны requirePermission, Prisma transactions
- `.planning/phases/02-tselostnost-dannykh/02-CONTEXT.md` — SELECT FOR UPDATE, $queryRaw, pure functions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma/schema.prisma` — 51 модель, уже 55 @@index/@@unique, 17 onDelete
- `db.$use()` / Prisma middleware — для автоматической фильтрации soft delete
- Prisma `@updatedAt` directive — автоматическое обновление
- `prisma migrate dev --create-only` — для raw SQL миграций

### Established Patterns
- Все relation fields уже определены в schema — нужно добавить onDelete к существующим
- 16 моделей уже имеют updatedAt — 35 без
- Zod-валидация на уровне приложения (Phase 1/2) — CHECK constraints добавляют DB-уровень

### Integration Points
- Все findMany/findFirst в server actions — нужно учесть soft delete фильтрацию
- `prisma/migrations/` — новые миграции не должны ломать существующие данные
- Существующие данные могут нарушать CHECK constraints — нужна data cleanup миграция

</code_context>

<specifics>
## Specific Ideas

- updatedAt на все 35 моделей в одной миграции — быстро и консистентно
- CHECK constraints в отдельной миграции с предварительной проверкой данных
- Prisma middleware для soft delete — один раз настроить, потом не думать

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-skhema-bd*
*Context gathered: 2026-04-05 via auto-mode*
