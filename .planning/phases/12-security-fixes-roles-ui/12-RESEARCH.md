# Phase 12: Security Fixes & Roles UI - Research

**Researched:** 2026-04-11
**Domain:** Security hardening (IDOR, soft delete, rate limiting, audit log) + Roles/Permissions UI
**Confidence:** HIGH

## Summary

Phase 12 закрывает 15 требований: 10 security-фиксов (SEC2-01..10) и 5 UI-фич (ROLE-01..05). Security-часть -- это инструментальные исправления в существующем коде: добавление storeId-проверок в server actions (IDOR), расширение Prisma `$extends` на `findUnique`/`findUniqueOrThrow` (soft delete bypass), rate limiting wrapper для write-операций, AuditLog модель в схеме + middleware. UI-часть -- страница /settings/roles с CRUD ролей и permission-матрицей, страница /settings/audit-log, soft delete UI для клиентов и магазинов.

Все паттерны уже установлены в кодовой базе: `requirePermission(code, storeId)` для авторизации, in-memory Map для rate limiting (src/lib/rate-limit.ts), `$extends` для soft delete (src/lib/db.ts), shadcn/ui Dialog+Form+Checkbox для настроек. Новый код следует этим паттернам, добавляя AuditLog как единственную новую Prisma-модель.

**Primary recommendation:** Разделить на 3 плана: (1) Security fixes в server actions + db.ts + rate limiting, (2) AuditLog модель + middleware + UI, (3) Roles CRUD UI + soft delete UI + E2E security tests.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- No preset roles -- all custom, user creates from scratch
- Multiple roles per user per store (permissions merge as union)
- Permission categories: POS, Orders, Inventory, Reports, Settings (as in existing requirePermission calls)
- Each permission is a checkbox with clear label
- Audit log scope: everything auditable -- all create/update/delete across all entities
- Audit log UI: both dedicated /settings/audit-log page AND inline history on relevant entity pages
- Retention: configurable via UI settings (admin sets retention period in days/months)
- Filterable by: date range, action type, user, entity type
- Owner-only access to full audit log page
- Toast notification with countdown timer on rate limit hit
- Apply rate limiting to ALL write operations (not just createSale/createReceive/createOrder)
- In-memory storage (Map) -- consistent with Phase 1 login rate limiting
- "Delete" button (not "Archive") with confirmation dialog explaining data is preserved
- Deleted entities always visible in lists with "Archived" badge, grayed out
- No toggle to hide -- always shown with visual distinction

### Claude's Discretion

- Roles page layout pattern (table+drawer consistent with existing settings, or cards)
- Permission matrix visual design (category rows + toggles vs flat checklist)
- Rate limit threshold values per endpoint
- Store deletion guard behavior (block if stock > 0 vs warn but allow)
- Audit log cleanup scheduler implementation
- IDOR fix patterns (middleware vs per-action check)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                  | Research Support                                                                                                                               |
| ------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC2-01 | getSale проверяет requirePermission по sale.storeId (закрытие IDOR)          | Подтверждено: getSale (sales.ts:423) не вызывает requirePermission с storeId. Паттерн: fetch entity -> requirePermission(code, entity.storeId) |
| SEC2-02 | db.ts soft delete расширение перехватывает findUnique                        | Подтверждено: db.ts НЕ содержит findUnique/findUniqueOrThrow в $extends. Prisma 7 $extends API поддерживает эти методы                         |
| SEC2-03 | Reports с reports.full проверяют доступ к requested storeId                  | reports.ts уже проверяет storeId/reports.full для getSalesReport; нужно проверить ВСЕ report-функции                                           |
| SEC2-04 | updateOrderStatus для COMPLETED проверяет pos.discount_high при скидке > 30% | Нужна проверка в orders.ts: if discount > 30% -> requirePermission("pos.discount_high")                                                        |
| SEC2-05 | createCashOperation: верхний лимит amount, проверка баланса фонда            | cash-operations.ts нуждается в validation: max amount + fund balance check                                                                     |
| SEC2-06 | Rate limiting на все write operations                                        | Существующий паттерн: src/lib/rate-limit.ts (in-memory Map). Нужен generic wrapper                                                             |
| SEC2-07 | closeShift с большим discrepancy требует approval старшего                   | shifts.ts:closeShift -- добавить threshold check + senior approval flow                                                                        |
| SEC2-08 | updateUserRoles запрещает менять свою роль                                   | Подтверждено: settings.ts:391 updateUserRoles НЕ проверяет userId !== session.user.id                                                          |
| SEC2-09 | updateOrderItem: hard cap на price change > 30%                              | orders.ts -- проверка прав при существенном изменении цены                                                                                     |
| SEC2-10 | AuditLog таблица -- структурированный лог изменений                          | Модель AuditLog НЕ существует в schema.prisma. Нужно создать                                                                                   |
| ROLE-01 | Страница /settings/roles -- список ролей с CRUD                              | Маршрут НЕ существует. Паттерн: /settings/users (page.tsx + components)                                                                        |
| ROLE-02 | Матрица прав: чекбоксы permissions по категориям                             | permissions-list.ts содержит ~50 permissions в 13 модулях (modules). Группировка по module field                                               |
| ROLE-03 | Назначение роли пользователю при создании/редактировании                     | updateUserRoles уже существует; нужен UI на /settings/users/[id]                                                                               |
| ROLE-04 | Удаление клиентов из UI (soft delete)                                        | Customer модель уже в SOFT_DELETE_MODELS. Нужен UI-кнопка + server action                                                                      |
| ROLE-05 | Удаление магазинов из UI (soft delete с проверкой остатков)                  | Store модель в SOFT_DELETE_MODELS. Нужна проверка StoreProduct.quantity > 0                                                                    |

</phase_requirements>

## Standard Stack

### Core (already in project)

| Library      | Version | Purpose                                        | Why Standard                                       |
| ------------ | ------- | ---------------------------------------------- | -------------------------------------------------- |
| Prisma       | 7.4.2+  | ORM, $extends для soft delete, AuditLog модель | Уже используется, $extends поддерживает findUnique |
| Next.js      | 16      | Server actions, App Router                     | Уже используется                                   |
| shadcn/ui    | latest  | Dialog, Form, Checkbox, Table                  | Уже используется для всех settings pages           |
| sonner       | latest  | Toast notifications (rate limit countdown)     | Уже используется через toast()                     |
| zod          | latest  | Server action input validation                 | Уже используется                                   |
| lucide-react | latest  | Icons                                          | Уже используется                                   |

### No New Dependencies Required

Все необходимое уже в проекте. Rate limiting -- in-memory Map (как Phase 1). AuditLog -- Prisma модель. UI -- shadcn/ui компоненты.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── rate-limit.ts          # Расширить: generic writeRateLimit (не только login)
│   ├── db.ts                  # Расширить: findUnique + findUniqueOrThrow в $extends
│   └── audit.ts               # НОВЫЙ: createAuditEntry helper
├── actions/
│   ├── sales.ts               # IDOR fix: getSale + requirePermission(storeId)
│   ├── reports.ts             # SEC2-03: все report functions проверяют storeId
│   ├── settings.ts            # SEC2-08: updateUserRoles self-check
│   ├── shifts.ts              # SEC2-07: closeShift discrepancy approval
│   ├── cash-operations.ts     # SEC2-05: amount limit + fund balance
│   ├── orders.ts              # SEC2-04/09: discount/price checks
│   ├── customers.ts           # ROLE-04: softDeleteCustomer action
│   ├── stores.ts              # ROLE-05: softDeleteStore action
│   └── roles.ts               # НОВЫЙ: CRUD roles, manage permissions
├── app/(dashboard)/settings/
│   ├── roles/page.tsx         # НОВЫЙ: ROLE-01/02
│   └── audit-log/page.tsx     # НОВЫЙ: SEC2-10 UI
└── components/settings/
    ├── role-form.tsx           # НОВЫЙ: Create/Edit role dialog
    ├── permission-matrix.tsx   # НОВЫЙ: ROLE-02 checkbox matrix
    └── audit-log-table.tsx     # НОВЫЙ: SEC2-10 table with filters
```

### Pattern 1: IDOR Fix (per-action storeId check)

**What:** После fetch entity по ID, проверить requirePermission с entity.storeId
**When to use:** Каждый server action, принимающий entity ID напрямую
**Example:**

```typescript
// BEFORE (vulnerable):
export async function getSale(saleId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  const sale = await db.sale.findUnique({ where: { id: saleId }, ... })
  // NO storeId check!

// AFTER (fixed):
export async function getSale(saleId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  const sale = await db.sale.findUnique({ where: { id: saleId }, ... })
  if (!sale) throw new Error("Продажа не найдена")
  await requirePermission("pos.sell", sale.storeId) // IDOR fix
```

### Pattern 2: Soft Delete Extension for findUnique

**What:** Добавить findUnique и findUniqueOrThrow в db.ts $extends
**When to use:** Один раз в db.ts
**Example:**

```typescript
return base.$extends({
  name: "softDelete",
  query: {
    $allModels: {
      // Existing: findMany, findFirst, findFirstOrThrow, count
      async findUnique({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          // findUnique не поддерживает произвольные where-условия,
          // поэтому выполняем запрос и проверяем deletedAt пост-фактум
          const result = await query(args)
          if (result && (result as any).deletedAt !== null) {
            return null
          }
          return result
        }
        return query(args)
      },
      async findUniqueOrThrow({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          const result = await query(args)
          if (result && (result as any).deletedAt !== null) {
            throw new Error(`${model} not found`)
          }
          return result
        }
        return query(args)
      },
    },
  },
})
```

**ВАЖНО:** `findUnique` в Prisma принимает only `where` с unique fields, не произвольные фильтры. Нельзя добавить `deletedAt: null` в `args.where` как в `findMany`. Нужен post-query filter: fetch -> check deletedAt -> return null if soft-deleted.

### Pattern 3: Generic Write Rate Limiting

**What:** Wrapper для server actions с rate limiting по userId + action name
**When to use:** Все write server actions
**Example:**

```typescript
// src/lib/rate-limit.ts -- расширение существующего файла
const writeAttempts = new Map<string, { count: number; windowStart: number }>()

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "pos.sell": { maxRequests: 30, windowMs: 60_000 }, // POS: высокий throughput
  "pos.return": { maxRequests: 10, windowMs: 60_000 },
  "inventory.receive": { maxRequests: 20, windowMs: 60_000 },
  "orders.create": { maxRequests: 15, windowMs: 60_000 },
  default: { maxRequests: 20, windowMs: 60_000 }, // для остальных
}

export function checkWriteRateLimit(
  userId: string,
  action: string,
): {
  allowed: boolean
  retryAfterMs?: number
} {
  const config = RATE_LIMITS[action] ?? RATE_LIMITS["default"]
  const key = `${userId}:${action}`
  const now = Date.now()
  const entry = writeAttempts.get(key)
  // ... sliding window logic
}
```

### Pattern 4: AuditLog Model

**What:** Prisma модель для структурированного лога изменений
**Example:**

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  action    String   // CREATE, UPDATE, DELETE, ROLE_CHANGE, PERMISSION_CHANGE
  entity    String   // Sale, User, Role, etc.
  entityId  String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  storeId   String?
  store     Store?   @relation(fields: [storeId], references: [id])
  changes   Json?    // { field: { old: value, new: value } }
  metadata  Json?    // additional context
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([userId])
  @@index([storeId])
  @@index([createdAt])
  @@index([action])
}
```

### Pattern 5: Permission Matrix UI Layout

**Recommendation (Claude's Discretion):** Category rows with toggle columns.
**Why:** ~50 permissions in 13 modules. Flat checklist is unwieldy. Group by `module` field from permissions-list.ts, show toggles per permission in each category row. "Select all" per category.

```
| Category     | Permission 1 | Permission 2 | Permission 3 | Select All |
|-------------|:---:|:---:|:---:|:---:|
| POS         | [x] Sell | [x] Return | [ ] Discount High | [ ] All |
| Inventory   | [x] View | [ ] Receive | [ ] Transfer | [ ] All |
```

### Pattern 6: Roles Page Layout

**Recommendation (Claude's Discretion):** Table + drawer (consistent with /settings/users pattern).
**Why:** Existing settings pages use table layouts. Roles list in table, clicking opens drawer/dialog with role form + permission matrix.

### Anti-Patterns to Avoid

- **Middleware-based IDOR checks:** Server actions уже имеют `requirePermission` -- не создавать отдельный middleware layer. Проверка в каждом action после fetch entity.
- **Database-level rate limiting:** In-memory Map -- установленный паттерн (Phase 1). Не усложнять с Redis/DB storage.
- **Separate audit action calls:** Audit logging должен быть в Prisma $extends middleware, не в каждом action вручную. Исключение: role/permission changes где нужен explicit context.

## Don't Hand-Roll

| Problem                    | Don't Build             | Use Instead                                           | Why                                                  |
| -------------------------- | ----------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Permission grouping        | Manual category mapping | `Permission.module` field from DB/permissions-list.ts | Уже есть module field на каждом permission           |
| Rate limit countdown UI    | Custom timer component  | sonner toast с onDismiss + setTimeout                 | sonner уже в проекте, toast.error с duration         |
| Audit log diff calculation | Custom object diff      | JSON.stringify comparison in $extends middleware      | Prisma $extends получает args.data и existing record |
| Soft delete UI             | Custom visibility logic | `deletedAt` field + conditional CSS classes           | Все soft delete модели уже имеют deletedAt           |

## Common Pitfalls

### Pitfall 1: findUnique + where limitations

**What goes wrong:** Попытка добавить `deletedAt: null` в `args.where` для `findUnique` -- Prisma не позволяет произвольные поля в unique where.
**Why it happens:** `findUnique` принимает только unique constraint fields в where (id, email+storeId, etc.)
**How to avoid:** Post-query filter: выполнить query, проверить result.deletedAt, вернуть null если soft-deleted.
**Warning signs:** TypeScript error на `args.where.deletedAt`

### Pitfall 2: Self-role modification bypass

**What goes wrong:** Администратор меняет свои роли и теряет доступ к settings
**Why it happens:** updateUserRoles не проверяет userId === session.user.id
**How to avoid:** Explicit check `if (userId === session.user.id) throw new Error("Нельзя изменять свои роли")`

### Pitfall 3: Rate limit key collision

**What goes wrong:** Rate limit по userId блокирует все actions если один action hit limit
**Why it happens:** Ключ `userId` без action name
**How to avoid:** Ключ = `${userId}:${actionName}` -- per-action rate limiting

### Pitfall 4: AuditLog в транзакциях

**What goes wrong:** AuditLog entry создается, но основная операция откатывается (или наоборот)
**Why it happens:** AuditLog.create вне транзакции основной операции
**How to avoid:** Для critical operations -- AuditLog.create внутри той же $transaction. Для $extends middleware -- автоматически в той же query.

### Pitfall 5: Store soft delete с активными данными

**What goes wrong:** Удаление магазина с открытой сменой, незакрытыми заказами, товарами на складе
**Why it happens:** Нет проверки зависимых данных
**How to avoid:** Проверить: открытые смены, активные заказы, StoreProduct.quantity > 0. **Recommendation (Claude's Discretion):** блокировать если stock > 0 -- это защита от потери данных.

### Pitfall 6: Prisma $extends ordering for audit

**What goes wrong:** Audit middleware перехватывает query но не видит old values
**Why it happens:** $extends middleware получает args но не existing record
**How to avoid:** Для update/delete -- сначала fetch existing record внутри middleware, затем выполнить query, затем создать audit entry.

## Code Examples

### IDOR Fix Pattern (verified from codebase)

```typescript
// src/actions/sales.ts -- getSale fix
export async function getSale(saleId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      /* existing includes */
    },
  })

  if (!sale) throw new Error("Продажа не найдена")

  // SEC2-01: IDOR fix -- verify user has access to this sale's store
  await requirePermission("pos.sell", sale.storeId)

  return {
    /* existing return */
  }
}
```

### Write Rate Limit Wrapper

```typescript
// Usage in server action:
export async function createSale(input: CreateSaleInput) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  // SEC2-06: Rate limiting
  const rateCheck = checkWriteRateLimit(session.user.id, "pos.sell")
  if (!rateCheck.allowed) {
    throw new Error(
      `Слишком много запросов. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 1000)} сек.`,
    )
  }
  recordWriteAttempt(session.user.id, "pos.sell")

  // ... rest of action
}
```

### closeShift Discrepancy Approval

```typescript
// SEC2-07: Large discrepancy requires senior approval
const DISCREPANCY_THRESHOLD = 1000 // рублей -- Claude's Discretion
if (Math.abs(discrepancy) > DISCREPANCY_THRESHOLD) {
  // Check if current user has elevated permission
  const canOverride = await checkPermission("shifts.override_discrepancy", shift.storeId)
  if (!canOverride) {
    throw new Error(
      `Расхождение ${discrepancy} руб. превышает допустимое. Требуется подтверждение старшего.`,
    )
  }
}
```

### AuditLog Helper

```typescript
// src/lib/audit.ts
export async function createAuditEntry(params: {
  action: string
  entity: string
  entityId: string
  userId: string
  storeId?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
  tx?: PrismaTransaction
}) {
  const client = params.tx ?? db
  await client.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      userId: params.userId,
      storeId: params.storeId,
      changes: params.changes ?? Prisma.JsonNull,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
  })
}
```

### Soft Delete Customer/Store Action

```typescript
// src/actions/customers.ts
export async function softDeleteCustomer(customerId: string) {
  await requirePermission("customers.manage")
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  await db.customer.update({
    where: { id: customerId },
    data: { deletedAt: new Date() },
  })

  await createAuditEntry({
    action: "DELETE",
    entity: "Customer",
    entityId: customerId,
    userId: session.user.id,
  })

  revalidatePath("/customers")
}
```

## State of the Art

| Old Approach                        | Current Approach                     | When Changed | Impact                |
| ----------------------------------- | ------------------------------------ | ------------ | --------------------- |
| findMany/findFirst soft delete only | + findUnique/findUniqueOrThrow       | Phase 12     | Closes BUG-059 bypass |
| Login-only rate limiting            | All write operations rate limited    | Phase 12     | Closes BUG-063        |
| No audit trail                      | AuditLog model + $extends middleware | Phase 12     | Full traceability     |
| Roles: system presets only          | Custom roles via UI                  | Phase 12     | Flexibility for admin |

## Validation Architecture

### Test Framework

| Property           | Value                                   |
| ------------------ | --------------------------------------- |
| Framework          | Vitest (via vitest.config.ts)           |
| Config file        | vitest.config.ts (projects: unit + e2e) |
| Quick run command  | `pnpm test:unit`                        |
| Full suite command | `pnpm test`                             |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                 | Test Type | Automated Command                                                 | File Exists? |
| ------- | ---------------------------------------- | --------- | ----------------------------------------------------------------- | ------------ |
| SEC2-01 | getSale IDOR: чужой storeId -> 403       | e2e       | `pnpm vitest run src/__tests__/e2e/security-idor.e2e.test.ts -x`  | Wave 0       |
| SEC2-02 | findUnique soft-deleted -> null          | e2e       | `pnpm vitest run src/__tests__/e2e/security-idor.e2e.test.ts -x`  | Wave 0       |
| SEC2-03 | reports.full storeId access              | e2e       | `pnpm vitest run src/__tests__/e2e/security-idor.e2e.test.ts -x`  | Wave 0       |
| SEC2-04 | high discount -> pos.discount_high check | unit      | `pnpm vitest run src/__tests__/order-discount-check.test.ts -x`   | Wave 0       |
| SEC2-05 | cash op amount limit + fund balance      | unit      | `pnpm vitest run src/__tests__/cash-operation-limits.test.ts -x`  | Wave 0       |
| SEC2-06 | rate limiting triggers after N requests  | unit      | `pnpm vitest run src/__tests__/write-rate-limit.test.ts -x`       | Wave 0       |
| SEC2-07 | closeShift large discrepancy -> approval | e2e       | `pnpm vitest run src/__tests__/e2e/security-idor.e2e.test.ts -x`  | Wave 0       |
| SEC2-08 | updateUserRoles self-change -> error     | unit      | `pnpm vitest run src/__tests__/role-self-change.test.ts -x`       | Wave 0       |
| SEC2-09 | order item price cap > 30%               | unit      | `pnpm vitest run src/__tests__/order-price-cap.test.ts -x`        | Wave 0       |
| SEC2-10 | AuditLog entries created on role changes | e2e       | `pnpm vitest run src/__tests__/e2e/audit-log.e2e.test.ts -x`      | Wave 0       |
| ROLE-01 | roles CRUD                               | e2e       | `pnpm vitest run src/__tests__/e2e/roles-crud.e2e.test.ts -x`     | Wave 0       |
| ROLE-02 | permission matrix saves correctly        | e2e       | `pnpm vitest run src/__tests__/e2e/roles-crud.e2e.test.ts -x`     | Wave 0       |
| ROLE-03 | assign role to user                      | e2e       | `pnpm vitest run src/__tests__/e2e/roles-crud.e2e.test.ts -x`     | Wave 0       |
| ROLE-04 | soft delete customer                     | e2e       | `pnpm vitest run src/__tests__/e2e/soft-delete-ui.e2e.test.ts -x` | Wave 0       |
| ROLE-05 | soft delete store + stock check          | e2e       | `pnpm vitest run src/__tests__/e2e/soft-delete-ui.e2e.test.ts -x` | Wave 0       |

### Sampling Rate

- **Per task commit:** `pnpm test:unit`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps

- [ ] `src/__tests__/e2e/security-idor.e2e.test.ts` -- SEC2-01, SEC2-02, SEC2-03, SEC2-07
- [ ] `src/__tests__/write-rate-limit.test.ts` -- SEC2-06
- [ ] `src/__tests__/e2e/audit-log.e2e.test.ts` -- SEC2-10
- [ ] `src/__tests__/e2e/roles-crud.e2e.test.ts` -- ROLE-01, ROLE-02, ROLE-03
- [ ] `src/__tests__/e2e/soft-delete-ui.e2e.test.ts` -- ROLE-04, ROLE-05
- [ ] AuditLog migration: `prisma migrate dev` for new model
- [ ] Possible new permission: `shifts.override_discrepancy` for SEC2-07

## Open Questions

1. **Audit log retention cleanup scheduler**
   - What we know: User wants configurable retention (days/months) via UI
   - What's unclear: Cron job vs manual cleanup? In Next.js server action vs separate process?
   - Recommendation: Simple server action `cleanupAuditLog()` called via cron route (`/api/cron/audit-cleanup`) or manual button. Not a separate process -- keep it simple.

2. **Rate limit thresholds per endpoint**
   - What we know: POS transactions need higher throughput than admin operations
   - What's unclear: Exact values depend on real usage patterns
   - Recommendation: Start with conservative defaults (30/min for POS, 10/min for admin), make configurable later

3. **Inline audit history on entity pages**
   - What we know: User wants audit entries shown on relevant entity pages
   - What's unclear: Which entity pages get inline history? All? Just critical ones?
   - Recommendation: Start with Role/User pages (most security-relevant), extend to others in Phase 16

4. **New permission for SEC2-07**
   - What we know: closeShift с большим discrepancy требует "approval старшего"
   - What's unclear: New permission code? Or use existing role hierarchy?
   - Recommendation: Add `shifts.override_discrepancy` to permissions-list.ts. Simple permission check, no approval workflow.

## Sources

### Primary (HIGH confidence)

- `src/lib/db.ts` -- existing soft delete $extends (verified: NO findUnique)
- `src/lib/rate-limit.ts` -- existing rate limiting pattern (verified: in-memory Map)
- `src/lib/permissions.ts` -- requirePermission/checkPermission implementation
- `src/lib/permissions-list.ts` -- 50 permissions in 13 modules
- `src/actions/sales.ts:423` -- getSale without storeId check (IDOR confirmed)
- `src/actions/settings.ts:391` -- updateUserRoles without self-check (confirmed)
- `prisma/schema.prisma` -- Role, Permission, RolePermission, UserRole models (no AuditLog)
- `vitest.config.ts` -- test infrastructure (unit + e2e projects)

### Secondary (MEDIUM confidence)

- Prisma 7 $extends documentation -- findUnique interception supported, but `where` only accepts unique fields (post-query filter needed)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns established in codebase (requirePermission, $extends, rate-limit, settings UI)
- Pitfalls: HIGH -- verified against actual code (findUnique limitation, IDOR bugs, self-role change)

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- no external dependency changes expected)
