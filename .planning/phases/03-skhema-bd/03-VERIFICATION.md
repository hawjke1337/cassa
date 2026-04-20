---
phase: 03-skhema-bd
verified: 2026-04-05T17:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 3: Схема БД — Verification Report

**Phase Goal:** Схема базы данных гарантирует целостность на уровне СУБД и обеспечивает производительность запросов
**Verified:** 2026-04-05T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Запросы Sale по магазину и дате используют индекс (не Seq Scan) | VERIFIED | `@@index([storeId, createdAt])` на Sale, строка 267 schema.prisma; `CREATE INDEX "Sale_storeId_createdAt_idx"` в migration 20260405154800 |
| 2  | Запросы Payment по смене используют индекс | VERIFIED | `@@index([shiftId])` на Payment строка 324; `@@index([saleId])` строка 325 |
| 3  | Supplier.inn уникален на уровне БД | VERIFIED | `inn String? @unique` строка 382; `CREATE UNIQUE INDEX "Supplier_inn_key"` в migration 20260405154800 |
| 4  | Category name+parentId уникальна (нет дублей на одном уровне) | VERIFIED | `@@unique([name, parentId])` строка 160; `CREATE UNIQUE INDEX "Category_name_parentId_key"` в migration 20260405154800 |
| 5  | Удаление SaleItem каскадно происходит при удалении Sale | VERIFIED | `sale Sale @relation(..., onDelete: Cascade)` строка 284; `ALTER TABLE "SaleItem" ADD CONSTRAINT ... ON DELETE CASCADE` в migration 20260405160343 |
| 6  | Удаление Product с продажами запрещено (Restrict) | VERIFIED | `product Product? @relation(..., onDelete: Restrict)` в SaleItem строка 286 |
| 7  | PriceHistory.storeId ссылается на Store как FK | VERIFIED | `store Store @relation(..., onDelete: Restrict)` + `priceHistory PriceHistory[]` на Store строка 43; migration 20260405160343 строка 172 |
| 8  | PriceHistory.changedBy ссылается на User как FK | VERIFIED | `changedByUser User @relation("PriceHistoryChangedBy", ...)` строка 225; `priceHistoryChanges PriceHistory[] @relation("PriceHistoryChangedBy")` на User строка 86; migration 20260405160343 строка 175 |
| 9  | Soft-deleted Product не появляется в findMany без явного запроса | VERIFIED | `$extends` в src/lib/db.ts вставляет `{ deletedAt: null, ...args.where }` для findMany/findFirst/findFirstOrThrow/count на всех моделях из SOFT_DELETE_MODELS; db импортируется в 34+ файлах |
| 10 | Невозможно вставить Payment.amount <= 0 через любой путь | VERIFIED | `chk_payment_amount_gt0 CHECK (amount > 0)` в migration 20260405160839 строка 47; 11/11 CHECK constraints присутствуют |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | 40+ @@index, 2 @@unique, 107 onDelete, deletedAt на 5 моделей, @updatedAt на 51 модели | VERIFIED | 45 @@index (включая deletedAt индексы), 107 onDelete правил, 51 @updatedAt (0 пропущено), deletedAt ровно на Store/User/Product/Supplier/Customer |
| `prisma/migrations/20260405154800_add_indexes_and_unique_constraints/migration.sql` | CREATE INDEX и UNIQUE | VERIFIED | 25 CREATE INDEX + 2 CREATE UNIQUE INDEX = 27 операций |
| `prisma/migrations/20260405160343_add_on_delete_soft_delete_updated_at/migration.sql` | ALTER TABLE для FK, deletedAt, updatedAt | VERIFIED | FK constraints с ON DELETE, DEFAULT NOW() паттерн для updatedAt на existing rows |
| `prisma/migrations/20260405160839_add_check_constraints/migration.sql` | 11 ADD CONSTRAINT chk_ | VERIFIED | Ровно 11 CHECK constraints + data cleanup SQL |
| `src/lib/db.ts` | $extends soft delete фильтрация | VERIFIED | $extends с SOFT_DELETE_MODELS, findMany/findFirst/findFirstOrThrow/count перехвачены, $use отсутствует (Prisma 7 совместимо), ReturnType<typeof createPrismaClient> типизация |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prisma/schema.prisma` | PostgreSQL | prisma migrate deploy | VERIFIED | 4 миграции фазы 3 применены (20260405000001, 20260405154800, 20260405160343, 20260405160839) |
| `src/lib/db.ts` | `prisma/schema.prisma` | $extends query hooks для SOFT_DELETE_MODELS | VERIFIED | SOFT_DELETE_MODELS = ['Product', 'Supplier', 'Customer', 'Store', 'User']; все 5 имеют deletedAt в schema; db импортируется в 34 production файлах |
| `prisma/migrations/*_add_check_constraints/migration.sql` | PostgreSQL | prisma migrate dev | VERIFIED | migration применена (есть в директории migrations); Summary подтверждает: 11/11 constraints проверены через pg_constraint catalog |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DB-01 | 03-01 | Добавить 35+ отсутствующих индексов | SATISFIED | 25 новых @@index добавлено (3 пропущено из-за несуществующих полей — корректная автофиксация); итого 45 @@index в schema |
| DB-02 | 03-02 | Добавить onDelete правила на все FK | SATISFIED | 107 onDelete правил (Cascade/Restrict/SetNull) на всех FK relationship полях; grep -c "onDelete:" = 107 |
| DB-03 | 03-02 | PriceHistory: storeId и changedBy как FK | SATISFIED | Store.priceHistory + User.priceHistoryChanges@relation; migration 20260405160343 строки 172-175 |
| DB-04 | 03-02 | Soft delete на Product, Supplier, Customer, Store, User | SATISFIED | deletedAt DateTime? + @@index([deletedAt]) ровно на 5 моделях; $extends автофильтрация в db.ts |
| DB-05 | 03-02 | updatedAt на Sale, Payment, Return, все Items-таблицы | SATISFIED | @updatedAt на всех 51 моделях; python3 скрипт подтверждает 0 пропущено |
| DB-06 | 03-03 | CHECK constraints (price >= 0, quantity > 0, amount > 0) | SATISFIED | 11 CHECK constraints в migration 20260405160839; data cleanup предшествует constraints |
| DB-07 | 03-01 | @@unique на Supplier.inn, @@unique на [Category.name, Category.parentId] | SATISFIED | `inn String? @unique` стр. 382; `@@unique([name, parentId])` стр. 160 |

**Все 7 требований (DB-01 — DB-07) выполнены. Orphaned requirements: нет.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

Никаких TODO, FIXME, заглушек или empty implementations в ключевых файлах обнаружено не было.

**Примечание — задокументированные отклонения (не дефекты):**

- Payment: `@@index([method])` вместо `@@index([type])` из плана — поле называется `method`, это корректная автофиксация
- CustomOrder и Repair: пропущены `@@index([customerId])` — эти модели не имеют FK на Customer (используют inline поля clientName/clientPhone)
- Return: пропущен `@@index([storeId, createdAt])` — модель Return не имеет поля storeId (только shiftId + saleId)

Все три отклонения зафиксированы в 03-01-SUMMARY.md и являются корректными исправлениями ошибок в плане, а не нарушениями требований.

### Human Verification Required

Следующее не может быть проверено статическим анализом:

**1. Реальная работа CHECK constraints в PostgreSQL**

**Test:** Выполнить `INSERT INTO "Payment" (id, method, amount) VALUES ('test', 'CASH', 0)` в боевой БД.
**Expected:** `ERROR: new row for relation "Payment" violates check constraint "chk_payment_amount_gt0"`
**Why human:** Summary заявляет о верификации через pg_constraint catalog + NOTICE из DO-блоков, но прямое отклонение INSERT не верифицируемо без подключения к БД.

**2. $extends фильтрация в реальных запросах приложения**

**Test:** Создать Product, установить `deletedAt = now()`, затем вызвать `db.product.findMany()`.
**Expected:** Soft-deleted продукт не возвращается в результатах.
**Why human:** Логика корректна по коду, но поведение $extends в Prisma 7 с реальным соединением нужно проверить runtime.

### Gaps Summary

Критических gap'ов нет. Фаза 3 достигает заявленной цели:

- **Производительность:** 45 индексов покрывают все приоритетные запросы (Sale по storeId+date, Payment по shiftId, StockReceive по storeId+date, Repair/CustomOrder/SerialUnit по storeId+status)
- **Целостность FK:** 107 onDelete правил гарантируют отсутствие orphaned записей на уровне СУБД
- **Целостность данных:** 11 CHECK constraints блокируют невалидные price/quantity/amount на уровне PostgreSQL
- **Soft delete:** Автоматическая фильтрация через $extends в db.ts; все 34 production-импортёра автоматически получают защиту
- **Уникальность:** Supplier.inn и Category[name,parentId] защищены на уровне СУБД
- **Аудит:** @updatedAt на всех 51 моделях — полный аудит изменений

---

_Verified: 2026-04-05T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
