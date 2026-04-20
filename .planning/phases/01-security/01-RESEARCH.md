# Phase 1: Безопасность - Research

**Researched:** 2026-04-05
**Domain:** Server-side security hardening for Next.js 16 + NextAuth v5 + Prisma 7 POS system
**Confidence:** HIGH

## Summary

Фаза 1 закрывает критические дыры безопасности в server actions POS-системы: валидация цен из БД (а не от клиента), динамическая перезагрузка permissions через JWT callback, store-scoped access control, rate limiting на логин, и усиление паролей. Все изменения чисто серверные -- UI затрагивается минимально (отображение ошибок).

Текущий код имеет ясные паттерны (`requirePermission` первой строкой, `db.$transaction`, Zod-схемы), которые нужно расширить, а не переписывать. Главный технический вызов -- перезагрузка permissions в JWT callback next-auth v5 beta без создания узкого места производительности.

**Primary recommendation:** Загружать permissions из БД в jwt callback с version-based invalidation (permissionsVersion в User vs в token) -- это оптимальный баланс между безопасностью и производительностью для ~10 пользователей.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Сервер ВСЕГДА берёт sellPrice и costPrice из StoreProduct по productId+storeId
- Клиент передаёт только: productId, quantity, discount, serialUnitId (для серийных)
- Скидка разрешена любому продавцу, но ограничена: >= 0 и <= sellPrice
- Скидка свыше порога (> 30%) требует permission `pos.discount_high`
- quantity валидируется: > 0, целое число, <= остаток на складе
- Короткий maxAge для JWT: 15 минут
- При каждом jwt callback -- перезагрузка permissions из БД
- При деактивации пользователя -- немедленная инвалидация через permissionsVersion
- Компромисс: +1 запрос к БД на каждый authenticated request (приемлемо для ~10 пользователей)
- Блокировка по username (не по IP)
- 5 неудачных попыток -- блокировка на 15 минут
- Хранение счётчика в памяти (Map) -- не Redis
- Минимум 8 символов пароля, без спецсимволов
- Существующие пароли < 8 символов продолжают работать, новые требования при смене
- writeSerialHistory вынести в `src/lib/serial-history.ts`
- Продажа без открытой смены запрещена
- Порядок проверок: auth -- permission -- validation -- business logic

### Claude's Discretion
- Конкретная реализация rate limiting middleware
- Структура ошибок (формат сообщений)
- Порядок проверок внутри server actions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Сервер валидирует sellPrice из БД | Pattern: lookup StoreProduct в транзакции, игнорировать price от клиента |
| SEC-02 | Сервер валидирует costPrice из БД | Pattern: для serial -- из SerialUnit.costPrice, для обычных -- из StoreProduct.costPrice |
| SEC-03 | discount >= 0 и discount <= price | Zod schema + серверная проверка внутри транзакции |
| SEC-04 | quantity > 0, целое, <= остаток | Zod `.int().positive()` + проверка StoreProduct.quantity в транзакции |
| SEC-05 | Продажа без смены запрещена | Проверка openShift в createSale до создания Sale, throw если null |
| SEC-06 | Возврат проверяет storeId | Добавить `requirePermission("pos.return", sale.storeId)` в createReturn |
| AUTH-01 | JWT обновляет permissions при изменении ролей | jwt callback: version-based reload из БД + session.maxAge: 900 |
| AUTH-02 | Rate limiting на логин | In-memory Map с timestamp-based cleanup |
| AUTH-03 | Минимальная длина пароля 8 символов | Обновить все 3 точки: createUser, resetUserPassword, changePassword |
| AUTH-04 | writeSerialHistory не экспортируется как server action | Вынести в src/lib/serial-history.ts без "use server" |
| PERM-01 | Trade-in actions проверяют storeId | Уже передают storeId в requirePermission -- нужно убедиться во всех actions |
| PERM-02 | Отчёты проверяют storeId | getSalesReport и др. -- добавить storeId в requirePermission |
| PERM-03 | Payroll: отдельные permissions | Разделить motivation.payroll.view на view/manage/confirm/pay |
| PERM-04 | getDocumentData проверяет permissions | Добавить requirePermission для RECEIVE_DOC и WRITE_OFF_DOC |
| PERM-05 | getCurrentShift и checkOpenShift -- store-scoped | Добавить requirePermission("shifts.view", storeId) |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 | Authentication + JWT | Already integrated, JWT strategy with Credentials provider |
| zod | 4.3.6 | Input validation | Already used for trade-in/catalog schemas |
| prisma | 7.4.2 | ORM + transactions | Already used everywhere, $transaction for atomic ops |
| bcryptjs | 3.0.3 | Password hashing | Already used in auth.ts |

### Supporting (new for this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *none* | - | - | All requirements solved with existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory rate limit Map | Redis (ioredis) | Overkill for ~10 users; memory Map resets on restart -- acceptable |
| permissionsVersion field | Short JWT maxAge only | Version field catches immediate role changes, not just 15-min window |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Structure for New/Modified Files
```
src/
├── lib/
│   ├── auth.ts               # JWT callback: reload permissions from DB
│   ├── auth.config.ts         # maxAge: 900 (15 min)
│   ├── permissions.ts         # requirePermission (no changes to interface)
│   ├── permissions-list.ts    # Add pos.discount_high + payroll permissions
│   ├── serial-history.ts      # NEW: writeSerialHistory extracted helper
│   ├── rate-limit.ts          # NEW: in-memory rate limiter
│   └── validations/
│       └── sales.ts           # NEW: Zod schema for createSale input
├── actions/
│   ├── sales.ts               # SEC-01..06: server-side price lookup
│   ├── trade-in.ts            # PERM-01: verify storeId in all actions
│   ├── reports.ts             # PERM-02: add storeId to requirePermission
│   ├── motivation-payroll.ts  # PERM-03: split permissions
│   ├── document-templates.ts  # PERM-04: permission check in getDocumentData
│   ├── shifts.ts              # PERM-05: store-scoped permission
│   ├── serial-units.ts        # AUTH-04: import from lib/serial-history
│   └── settings.ts            # AUTH-03: password length 4 -> 8
```

### Pattern 1: Server-Side Price Resolution (SEC-01, SEC-02)
**What:** Client sends only identifiers, server looks up all monetary values from DB
**When to use:** Any server action that creates financial records
**Example:**
```typescript
// BEFORE (vulnerable): client sends price and costPrice
export async function createSale(data: {
  items: Array<{ productId: string; price: number; costPrice: number; ... }>
})

// AFTER (secure): client sends only identifiers
export async function createSale(data: {
  storeId: string
  items: Array<{ productId: string; quantity: number; discount: number; serialUnitId?: string }>
  payments: Array<{ method: PaymentMethod; amount: number }>
}) {
  // Inside transaction, for each item:
  const sp = await tx.storeProduct.findUnique({
    where: { storeId_productId: { storeId, productId: item.productId } },
  })
  if (!sp) throw new Error("Товар не найден в магазине")
  const price = Number(sp.sellPrice)
  const costPrice = Number(sp.costPrice)
  // Use these server-resolved values, NOT client input
}
```

### Pattern 2: Version-Based Permission Invalidation (AUTH-01)
**What:** Store permissionsVersion on User model, compare with JWT token on each request
**When to use:** JWT-based auth where permissions must be fresh
**Example:**
```typescript
// In jwt callback (auth.ts):
async jwt({ token, user }) {
  if (user) {
    // First login: load everything
    token.id = user.id
    token.permissions = await getUserPermissions(user.id)
    token.permissionsVersion = await getPermissionsVersion(user.id)
  } else {
    // Subsequent requests: check if permissions changed
    const currentVersion = await getPermissionsVersion(token.id)
    if (currentVersion !== token.permissionsVersion) {
      token.permissions = await getUserPermissions(token.id)
      token.permissionsVersion = currentVersion
    }
  }
  return token
}
```

### Pattern 3: In-Memory Rate Limiting (AUTH-02)
**What:** Map<username, { count, lockedUntil }> with automatic cleanup
**When to use:** Login endpoint protection for small-scale internal tools
**Example:**
```typescript
// src/lib/rate-limit.ts
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number | null }>()

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const WINDOW_MS = 15 * 60 * 1000

export function checkRateLimit(username: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = loginAttempts.get(username)

  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now }
  }

  if (entry?.lockedUntil && now >= entry.lockedUntil) {
    loginAttempts.delete(username)
    return { allowed: true }
  }

  // Reset if window expired
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(username)
  }

  return { allowed: true }
}

export function recordFailedAttempt(username: string): void {
  const now = Date.now()
  const entry = loginAttempts.get(username) ?? { count: 0, firstAttempt: now, lockedUntil: null }
  entry.count++
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_DURATION_MS
  }
  loginAttempts.set(username, entry)
}

export function clearAttempts(username: string): void {
  loginAttempts.delete(username)
}
```

### Pattern 4: Consistent Error Response Format
**What:** All server actions return `{ success: false, error: string }` on failure
**When to use:** Every server action that the client calls
**Example:**
```typescript
// Existing pattern -- keep it
try {
  await requirePermission("pos.sell", storeId)
  // ... business logic
  return { success: true, data: result }
} catch (error) {
  return { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" }
}
```

### Anti-Patterns to Avoid
- **Trusting client-sent monetary values:** Never use price/costPrice from client input for financial records
- **Caching permissions in JWT without invalidation:** Permissions become stale when admin changes roles
- **IP-based rate limiting behind NAT:** Blocks entire office on a single user's failures
- **Checking permissions in middleware only:** Each server action must independently verify permissions (defense in depth)
- **Using "use server" for internal helpers:** Functions like writeSerialHistory should be plain imports, not server actions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom crypto | bcryptjs (already used) | Timing attacks, salt management |
| Input validation | Manual if/throw chains | Zod schemas | Consistent error messages, type safety |
| Prisma transactions | Manual BEGIN/COMMIT | `db.$transaction()` (already used) | Automatic rollback, type-safe |
| JWT management | Custom JWT library | next-auth JWT strategy (already used) | Cookie handling, rotation, CSRF |

**Key insight:** This phase does not require new libraries. All security improvements are achievable by tightening existing patterns.

## Common Pitfalls

### Pitfall 1: JWT Callback Performance in next-auth v5 beta
**What goes wrong:** Loading permissions from DB on every `auth()` call creates N+1 per request if multiple server actions called
**Why it happens:** jwt callback fires on every `auth()` invocation, each hitting DB
**How to avoid:** Version-based approach -- only reload when permissionsVersion changed. For ~10 users, even unconditional reload is acceptable (1 query per auth call). Keep it simple.
**Warning signs:** Dashboard loading slowly after this change (multiple server actions = multiple DB queries)

### Pitfall 2: next-auth v5 beta JWT maxAge Configuration
**What goes wrong:** Setting `jwt: { maxAge: 900 }` does NOT work as expected in v5 beta
**Why it happens:** In v5 beta, `session.maxAge` controls JWT expiration, not `jwt.maxAge`
**How to avoid:** Set `session: { strategy: "jwt", maxAge: 900 }` in authConfig
**Warning signs:** JWT tokens lasting 30 days (default) instead of 15 minutes

### Pitfall 3: Race Condition Between Permission Check and Data Access
**What goes wrong:** Permission checked, then data accessed in separate queries -- role could be revoked between them
**Why it happens:** `requirePermission` runs before the transaction
**How to avoid:** For this POS system with ~10 users and admin changes being rare, this is an acceptable trade-off. The 15-min JWT maxAge already bounds the staleness window. Do NOT move permission checks inside transactions (overengineering).
**Warning signs:** None expected in practice

### Pitfall 4: Existing Short Passwords Breaking After Migration
**What goes wrong:** Users with passwords < 8 chars cannot log in
**Why it happens:** Validation applied to login flow instead of only creation/change
**How to avoid:** Minimum length check ONLY in createUser, resetUserPassword, changePassword -- NOT in authorize callback. Existing bcrypt hashes work regardless of original length.
**Warning signs:** Users unable to log in after deployment

### Pitfall 5: createReturn Missing storeId in Permission Check (SEC-06)
**What goes wrong:** `createReturn` currently calls `requirePermission("pos.return")` without storeId -- seller in store A can return items from store B
**Why it happens:** storeId is derived from the sale, but permission check runs before sale lookup
**How to avoid:** First look up the sale to get storeId, then call `requirePermission("pos.return", sale.storeId)`
**Warning signs:** Cross-store returns in audit log

### Pitfall 6: getDocumentData Has No Auth Check At All (PERM-04)
**What goes wrong:** `getDocumentData` switches on document type but does not call `requirePermission` for RECEIVE_DOC and WRITE_OFF_DOC
**Why it happens:** Function was added for printing templates, assumed to be called from authorized context only
**How to avoid:** Add `requirePermission` calls based on document type at the start of the function
**Warning signs:** Any user can generate inventory/writeoff documents

## Code Examples

### Zod Schema for Secure createSale Input
```typescript
// src/lib/validations/sales.ts
import { z } from "zod"

export const createSaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("Количество должно быть > 0"),
  discount: z.number().min(0, "Скидка не может быть отрицательной"),
  serialUnitId: z.string().uuid().nullable().optional(),
})

export const createSaleSchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(createSaleItemSchema).min(1, "Добавьте товары"),
  payments: z.array(z.object({
    method: z.enum(["CASH", "CARD", "SBP", "TRANSFER", "CREDIT"]),
    amount: z.number().positive(),
  })).min(1, "Укажите способ оплаты"),
  comment: z.string().optional(),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>
```

### Updated auth.config.ts with 15-minute maxAge
```typescript
// src/lib/auth.config.ts
export const authConfig = {
  session: { strategy: "jwt", maxAge: 900 }, // 15 minutes
  pages: { signIn: "/login" },
  // ... rest unchanged
} satisfies NextAuthConfig
```

### New Permission Codes for PERM-03
```typescript
// Add to permissions-list.ts
// Payroll (replacing single motivation.payroll.view)
MOTIVATION_PAYROLL_MANAGE: { code: "motivation.payroll.manage", module: "motivation", name: "Управление расчётами зарплат" },
MOTIVATION_PAYROLL_CONFIRM: { code: "motivation.payroll.confirm", module: "motivation", name: "Подтверждение расчётов" },
MOTIVATION_PAYROLL_PAY: { code: "motivation.payroll.pay", module: "motivation", name: "Выплата зарплат" },

// POS high discount
POS_DISCOUNT_HIGH: { code: "pos.discount_high", module: "pos", name: "Скидка свыше 30%" },
```

### Rate Limit Integration in authorize
```typescript
// In auth.ts authorize callback:
async authorize(credentials) {
  if (!credentials?.login || !credentials?.password) return null

  const username = (credentials.login as string).toLowerCase()
  const rateCheck = checkRateLimit(username)
  if (!rateCheck.allowed) {
    throw new Error(`Слишком много попыток. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 60000)} мин.`)
  }

  const user = await db.user.findUnique({ where: { login: credentials.login as string } })
  if (!user || !user.isActive) {
    recordFailedAttempt(username)
    return null
  }

  const isValid = await compare(credentials.password as string, user.password)
  if (!isValid) {
    recordFailedAttempt(username)
    return null
  }

  clearAttempts(username)
  return { id: user.id, name: `${user.firstName} ${user.lastName}`, login: user.login }
}
```

### Shift Check in createSale (SEC-05)
```typescript
// Inside createSale transaction, BEFORE creating sale:
const openShift = await tx.shift.findFirst({
  where: { storeId: data.storeId, status: "OPEN" },
  select: { id: true },
})
if (!openShift) {
  throw new Error("Откройте кассовую смену перед продажей")
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-auth v4 getServerSession | next-auth v5 auth() | 2024 (beta) | Direct import, no authOptions passing |
| getToken() for JWT | auth() returns session with JWT data | v5 beta | Unified API for server/client |
| jwt.maxAge | session.maxAge controls JWT too | v5 beta (bug/design) | Must use session.maxAge for JWT expiry |

**Deprecated/outdated:**
- `getServerSession()`: replaced by `auth()` in v5
- `jwt: { maxAge }`: does not work as expected in v5 beta, use `session: { maxAge }` instead

## Open Questions

1. **permissionsVersion field on User model**
   - What we know: Need a way to detect permission changes between JWT callbacks
   - What's unclear: Whether to add a DB column (`permissionsVersion INT DEFAULT 1`) or use `updatedAt` on UserRole
   - Recommendation: Add `permissionsVersion Int @default(1)` to User model. Increment in toggleUserActive and assignRolesToUser. Simpler than querying UserRole.updatedAt.

2. **next-auth v5 beta authorize throwing errors**
   - What we know: In v5, throwing Error in authorize may or may not surface the message to the client
   - What's unclear: Exact error propagation behavior in beta.30 with Credentials provider
   - Recommendation: Test during implementation. Fallback: return null and handle error display differently.

3. **Zod v4 vs v3 API differences**
   - What we know: Project uses zod 4.3.6, which has some API changes from v3
   - What's unclear: Whether `.uuid()` and other validators work identically
   - Recommendation: Verify during implementation. Existing Zod schemas in project already use v4 patterns (z.coerce.date(), etc.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (not yet installed -- INFRA-01 is Phase 5) |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | sellPrice from DB not client | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "sellPrice"` | Wave 0 |
| SEC-02 | costPrice from DB not client | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "costPrice"` | Wave 0 |
| SEC-03 | discount bounds validation | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "discount"` | Wave 0 |
| SEC-04 | quantity validation | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "quantity"` | Wave 0 |
| SEC-05 | sale requires open shift | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "shift"` | Wave 0 |
| SEC-06 | return checks sale storeId | unit | `npx vitest run src/__tests__/sales-validation.test.ts -t "return storeId"` | Wave 0 |
| AUTH-01 | JWT refreshes permissions | unit | `npx vitest run src/__tests__/auth-jwt.test.ts -t "permissions refresh"` | Wave 0 |
| AUTH-02 | Rate limiting blocks after 5 | unit | `npx vitest run src/__tests__/rate-limit.test.ts` | Wave 0 |
| AUTH-03 | Password min 8 chars | unit | `npx vitest run src/__tests__/password-validation.test.ts` | Wave 0 |
| AUTH-04 | writeSerialHistory not exported | manual-only | Check: `grep "use server" src/lib/serial-history.ts` should fail | N/A |
| PERM-01 | Trade-in storeId check | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "trade-in"` | Wave 0 |
| PERM-02 | Reports storeId check | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "reports"` | Wave 0 |
| PERM-03 | Payroll split permissions | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "payroll"` | Wave 0 |
| PERM-04 | getDocumentData permission | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "document"` | Wave 0 |
| PERM-05 | Shift store-scoped | unit | `npx vitest run src/__tests__/permissions-store-scope.test.ts -t "shift"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest @vitejs/plugin-react` (or defer to INFRA-01 Phase 5)
- [ ] `vitest.config.ts` -- basic config with path aliases matching tsconfig
- [ ] `src/__tests__/sales-validation.test.ts` -- SEC-01..06
- [ ] `src/__tests__/auth-jwt.test.ts` -- AUTH-01
- [ ] `src/__tests__/rate-limit.test.ts` -- AUTH-02
- [ ] `src/__tests__/password-validation.test.ts` -- AUTH-03
- [ ] `src/__tests__/permissions-store-scope.test.ts` -- PERM-01..05

**Note:** Test infrastructure is Phase 5 (INFRA-01). For Phase 1, testing can be done with minimal vitest setup or deferred to manual verification + Phase 5. Recommendation: install vitest minimally now for unit tests on pure functions (rate-limit, Zod schemas, password validation). Defer integration test infrastructure to Phase 5.

## Sources

### Primary (HIGH confidence)
- Project source code: `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/lib/permissions.ts`, `src/actions/sales.ts` -- current implementation patterns
- Project `package.json` -- confirmed next-auth 5.0.0-beta.30, zod 4.3.6, prisma 7.4.2
- [Auth.js NextJS reference](https://authjs.dev/reference/nextjs) -- JWT callback behavior, session configuration

### Secondary (MEDIUM confidence)
- [next-auth GitHub Discussion #9476](https://github.com/nextauthjs/next-auth/discussions/9476) -- session.maxAge controls JWT expiry in v5 beta (not jwt.maxAge)
- [Auth.js migration guide](https://authjs.dev/getting-started/migrating-to-v5) -- v5 API changes

### Tertiary (LOW confidence)
- next-auth v5 error propagation in authorize callback -- behavior unclear in beta.30, needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns clearly established in codebase, changes are incremental
- Pitfalls: HIGH -- verified through code review and official docs
- JWT refresh: MEDIUM -- next-auth v5 beta behavior partially documented, needs runtime verification

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable patterns, but next-auth beta may release breaking changes)
