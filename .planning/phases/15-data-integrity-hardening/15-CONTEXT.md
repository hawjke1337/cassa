# Phase 15: Data Integrity Hardening - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

На уровне БД и API закрыть последние дыры целостности: Payment exclusivity CHECK constraint, varchar limits, UTC timezone handling в отчётах, IMEI/phone нормализация, optimistic locking для MotivationScheme, User cascade delete safety, DeviceRecord deduplication.

</domain>

<decisions>
## Implementation Decisions

### Payment exclusivity (DATA2-01)
- **CHECK constraint на уровне БД** — ровно один из (saleId, orderId, repairId) IS NOT NULL
- Если `isExpense=true`, все 3 FK могут быть NULL (расходные платежи не привязаны к sale/order/repair)
- Формула CHECK: `(isExpense = true AND saleId IS NULL AND orderId IS NULL AND repairId IS NULL) OR (isExpense = false AND (CASE WHEN saleId IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN orderId IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN repairId IS NOT NULL THEN 1 ELSE 0 END) = 1)`
- TradeIn привязан к Sale, если товар на заказ — к CustomOrder. Payment с TradeIn всегда имеет saleId или orderId
- **Миграция:** проверить существующие данные на orphan/multi-target Payments перед добавлением CHECK. Если найдутся — исправить в миграции

### UTC и timezone handling (DATA2-04)
- Все магазины в одном часовом поясе: **Москва (UTC+3)**
- Сутки в отчётах = **московское время** (00:00-23:59 MSK), не UTC
- БД хранит timestamps в UTC (стандарт PostgreSQL)
- При фильтрации по дате: конвертировать MSK boundaries в UTC для запросов (`startOfDay MSK → UTC-3h`, `endOfDay MSK → UTC-3h`)
- Ночных смен нет — магазины работают днём, edge case с полуночью не актуален
- TZ сервера — Claude's Discretion (рекомендация: UTC, конвертация в коде)

### User cascade delete (DATA2-06)
- User уже в SOFT_DELETE_MODELS — физическое удаление не происходит
- **Как страховка:** изменить UserRole, UserStore, MotivationAssignment с `onDelete: Cascade` на `onDelete: SetNull` (userId станет nullable)
- При soft delete пользователя — Claude's Discretion: решить нужна ли инвалидация сессии и деактивация MotivationAssignment или достаточно soft delete

### DeviceRecord deduplication (DATA2-12)
- **Upsert по идентификаторам:** при создании Repair — искать существующий DeviceRecord по imei, imei2, или serialNumber
- Если найден — привязать новый Repair к существующему DeviceRecord, обновить customerId на текущего клиента
- Если не найден — создать новый DeviceRecord
- Поиск по всем трём полям (imei, imei2, serialNumber) — максимальное покрытие дублей
- Одно устройство = один DeviceRecord с историей всех ремонтов

### VARCHAR limits (DATA2-03)
- Добавить `@db.VarChar(N)` на все текстовые поля без ограничений
- Claude's Discretion: конкретные лимиты для каждого поля (comment, reason, diagnosis, etc.)

### Quantity CHECK constraints (DATA2-07)
- CHECK >= 0 на все quantity-поля (StoreProduct.quantity, SaleItem.quantity, StockReceiveItem.quantity, etc.)
- Raw SQL миграция для добавления CHECK constraints

### IMEI validation (DATA2-05)
- Существующая валидация в `src/lib/imei-utils.ts` и `src/lib/validations/serial.ts`
- Применить во всех точках входа: receive, update, trade-in, import

### Phone normalization (DATA2-08)
- `normalizePhone()` — функция пока не существует, нужно создать
- Применять при create/update для Customer, User, Store, Supplier

### Optimistic locking (DATA2-10, DATA2-11)
- Добавить `version Int @default(1)` в MotivationScheme
- UPDATE с `WHERE version = expectedVersion`, increment version
- Устаревшая версия → ошибка "Данные были изменены другим пользователем"

### SerialUnit uniqueness (DATA2-09)
- `@@unique([productId, imei])` когда imei not null — закрыть возможность NULL-дубля

### Claude's Discretion
- Конкретные VarChar лимиты для каждого поля
- TZ сервера (UTC или Europe/Moscow)
- Инвалидация сессии при soft delete User
- Порядок миграций и разбивка на планы
- Формат normalizePhone (E.164, +7, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Схема БД
- `prisma/schema.prisma` — Payment model (lines 317-350), SerialUnit (1192-1220), DeviceRecord (1244-1260), MotivationScheme (919-935), User relations (UserRole, UserStore, MotivationAssignment)

### IMEI/Serial валидация
- `src/lib/imei-utils.ts` — Существующая IMEI валидация (Luhn check)
- `src/lib/validations/serial.ts` — Serial validation schemas
- `src/components/serial/imei-scanner-input.tsx` — UI компонент ввода IMEI

### Денежные расчёты
- `src/lib/money.ts` — Decimal-safe арифметика (sum, sub, mul, toMoney)

### Soft delete
- `src/lib/db.ts` — SOFT_DELETE_MODELS list, soft delete middleware implementation

### Требования
- `.planning/REQUIREMENTS.md` — DATA2-01..DATA2-12

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/imei-utils.ts`: IMEI validation с Luhn check — расширить для применения во всех точках входа
- `src/lib/db.ts`: Soft delete middleware для User — уже работает, нужно только исправить cascade на SetNull
- `src/lib/money.ts`: Decimal-safe арифметика — DATA2-02 уже закрыт

### Established Patterns
- Prisma миграции через `prisma migrate dev` — CHECK constraints через raw SQL в миграции
- Server actions с `requirePermission()` — все точки входа проходят через server actions
- Zod валидация в `src/lib/validations/` — для input validation

### Integration Points
- Payment creation: `src/actions/sales.ts`, `src/actions/orders.ts`, `src/actions/repairs.ts`
- DeviceRecord creation: `src/actions/repairs.ts` (createRepair)
- Phone input: Customer/User/Store/Supplier forms
- Date filtering: отчёты, dashboard, смены

</code_context>

<specifics>
## Specific Ideas

- Пользователь подтвердил что TradeIn привязан к Sale (или к CustomOrder если товар на заказ) — вписывается в стандартный CHECK
- Все магазины в Москве, ночных смен нет — упрощает timezone handling
- Миграцию данных (orphan Payments) нужно проверить перед CHECK constraint

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-data-integrity-hardening*
*Context gathered: 2026-04-14*
