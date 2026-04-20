# Phase 4: Заказы и поставщики - Research

**Researched:** 2026-04-05
**Domain:** Orders business logic, supplier debt management, motivation commission, reporting
**Confidence:** HIGH

## Summary

Phase 4 extends the existing CustomOrder workflow with purchase cost tracking, net profit calculation, supplier debt management, commission adjustment, discounts, and price editing. The codebase already has strong foundations: `SupplierDebt` model exists and is auto-created at ORDERED status, `markSupplierDebtPaid` action works, `getSuppliersList` returns active suppliers, `orders.costs` permission is already defined, and `calculateItemCommission` is a pure testable function in `motivation-utils.ts`.

Key changes fall into two categories: (1) schema + business logic (add `purchasePrice`/`deliveryCost` to `CustomOrder`, update debt amounts, pass `discountAmount` through to `Sale`, enable price editing in items), and (2) reporting/UX (supplier debts report page, net profit display, commission from net profit for orders). All patterns are established in the codebase -- no new libraries or architectural decisions needed.

**Primary recommendation:** Follow existing patterns exactly. Schema migration for 2 new Decimal fields, server actions for cost entry with `orders.manage_costs` permission (new permission to add), pure utility for net profit calculation, SQL aggregation for debt report.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Выпадающий список поставщиков при создании CustomOrder -- supplierId уже в модели, нужно только UI (Select компонент)
- Ввод закупочной цены и доставки ПОСЛЕ статуса COMPLETED -- новые поля `purchasePrice Decimal?`, `deliveryCost Decimal?` в CustomOrder
- Permission: `orders.manage_costs` -- отдельный от `orders.create`
- netProfit = totalAmount - discountAmount - (purchasePrice ?? 0) - (deliveryCost ?? 0) -- вычисляемое поле, не хранить в БД
- SupplierDebt.amount обновлять при вводе закупочных данных (purchasePrice + deliveryCost)
- Если purchasePrice не введена, долг = totalAmount заказа (приблизительно)
- Комиссия = 0 если purchasePrice не введена -- защита от некорректных начислений
- purchasePrice/deliveryCost на ВЕСЬ заказ, не per-item
- discountAmount передавать из формы выдачи заказа (не хардкодить 0)
- Редактирование price в CustomOrderItem при создании/редактировании заказа
- Отчёт по долгам: /dashboard/reports/supplier-debts -- SQL агрегация
- Фильтры отчёта: поставщик, статус, период

### Claude's Discretion
- Точный layout карточки заказа (расположение блоков)
- Нужен ли confirmation dialog при вводе закупочных данных
- Формат отчёта по долгам (compact vs detailed)
- Нужен ли export отчёта (CSV/PDF) -- скорее нет для Phase 4

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORD-01 | Выпадающий список поставщиков при создании заказа | `getSuppliersList()` уже есть, supplierId в модели, shadcn Select паттерн в order-detail.tsx |
| ORD-02 | Ввод закупочной цены и доставки после завершения | Новые поля в schema + server action `updateOrderCosts`, permission `orders.manage_costs` |
| ORD-03 | Расчёт чистой прибыли по заказу | Pure function в `src/lib/order-utils.ts`, вычисляемое поле, паттерн из `motivation-utils.ts` |
| ORD-04 | Автоматический учёт долга поставщику | SupplierDebt уже создаётся при ORDERED (orders.ts:435), нужно обновление amount при ORD-02 |
| ORD-05 | Отчёт по долгам поставщикам | Новая страница + server action с SQL агрегацией, паттерн из reports.ts |
| ORD-06 | Комиссия от чистой прибыли для заказов | Модификация calculateEarningsWithFormula, ветка для sale с orderId |
| ORD-07 | Скидка при выдаче заказа | Передача discountAmount в createSaleFromOrder (orders.ts:384,571 -- сейчас хардкод 0) |
| ORD-08 | Редактирование цены товара в заказе | Новый action `updateOrderItem` + editable price поле в UI |
</phase_requirements>

## Standard Stack

### Core (уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App Router, Server Actions | Основной фреймворк проекта |
| Prisma | 7 | ORM, миграции, типы | Уже используется повсеместно |
| shadcn/ui | latest | Select, Dialog, Table, Input | Единый UI стек проекта |
| Zod | 4.x | Валидация server actions | Паттерн из Phase 1 |
| TanStack Table | 8.x | Табличный отчёт по долгам | Используется в reports |
| Vitest | 4.1.2 | Unit тесты pure functions | Инфраструктура из Phase 1-2 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | existing | Toast уведомления | Все пользовательские действия |
| lucide-react | existing | Иконки | UI элементы |
| date-fns | existing (if present) | Форматирование дат в отчёте | Фильтры по периоду |

### Alternatives Considered
Нет -- все решения используют существующий стек. Новых библиотек не требуется.

## Architecture Patterns

### Файлы для изменения (Plan 04-01: Models + Business Logic)
```
prisma/schema.prisma              # +purchasePrice, +deliveryCost в CustomOrder
src/lib/permissions-list.ts       # +orders.manage_costs permission
src/lib/order-utils.ts            # NEW: calculateNetProfit() pure function
src/actions/orders.ts             # +updateOrderCosts, +updateOrderItem, modify createOrder (supplierId), modify COMPLETED flow (discountAmount)
src/components/orders/order-form.tsx    # +supplier Select, +editable price
src/components/orders/order-detail.tsx  # +cost entry modal, +net profit display, +discount при выдаче
```

### Файлы для изменения (Plan 04-02: Reports + Motivation + UX)
```
src/actions/reports.ts                              # +getSupplierDebtsReport
src/actions/motivation-calculation.ts               # modify commission for order-based sales
src/app/(dashboard)/reports/supplier-debts/page.tsx # NEW: отчёт по долгам
src/app/(dashboard)/reports/page.tsx                # +ссылка на отчёт по долгам
```

### Pattern 1: Pure Function для бизнес-логики
**What:** Вычисления (netProfit, commission) выносить в `src/lib/*-utils.ts`
**When to use:** Любая бизнес-формула, которую нужно тестировать
**Example:**
```typescript
// src/lib/order-utils.ts
export function calculateNetProfit(
  totalAmount: number,
  discountAmount: number,
  purchasePrice: number | null,
  deliveryCost: number | null,
): number | null {
  if (purchasePrice === null) return null
  return totalAmount - discountAmount - purchasePrice - (deliveryCost ?? 0)
}
```

### Pattern 2: Server Action с Permission Guard
**What:** Каждый server action начинается с `requirePermission` / `checkPermission`
**When to use:** Все мутации и чтения с контролем доступа
**Example:**
```typescript
// src/actions/orders.ts
export async function updateOrderCosts(
  orderId: string,
  data: { purchasePrice: number; deliveryCost?: number }
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")
  
  const order = await db.customOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  
  await requirePermission("orders.manage_costs", order.storeId)
  
  // Validate: only after COMPLETED
  if (order.status !== "COMPLETED") {
    throw new Error("Закупочные данные можно ввести только после завершения заказа")
  }
  
  await db.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        purchasePrice: data.purchasePrice,
        deliveryCost: data.deliveryCost ?? 0,
      },
    })
    // Update supplier debt amount
    const debt = await tx.supplierDebt.findFirst({ where: { orderId } })
    if (debt) {
      await tx.supplierDebt.update({
        where: { id: debt.id },
        data: { amount: data.purchasePrice + (data.deliveryCost ?? 0) },
      })
    }
  })
}
```

### Pattern 3: SQL Aggregation для отчётов (INFRA-04)
**What:** Отчёты используют SQL агрегацию, не загрузку всех записей в память
**When to use:** Любой отчёт с фильтрами и итогами
**Example:**
```typescript
// Паттерн из reports.ts -- но для долгов использовать Prisma groupBy + aggregate
const debts = await db.supplierDebt.findMany({
  where: {
    ...(supplierId ? { supplierId } : {}),
    ...(isPaid !== undefined ? { isPaid } : {}),
    createdAt: { gte: dateFrom, lte: dateTo },
  },
  include: {
    supplier: { select: { name: true } },
    order: { select: { number: true, totalAmount: true } },
  },
  orderBy: { createdAt: "desc" },
})
// Итоги через отдельный aggregate
const totals = await db.supplierDebt.aggregate({
  where: { /* same where */ },
  _sum: { amount: true },
  _count: true,
})
```

### Anti-Patterns to Avoid
- **Хранение netProfit в БД:** Вычисляемое поле -- считать на лету. Иначе рассинхронизация при обновлении purchasePrice/discountAmount.
- **Загрузка всех долгов в память для фильтрации:** Использовать Prisma where + aggregate.
- **Изменение createSaleFromOrder подписи:** Лучше добавить параметр `discountAmount` к существующему flow внутри `updateOrderStatus`/`payAndChangeStatus`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown с поставщиками | Custom autocomplete | shadcn Select + getSuppliersList() | Поставщиков < 100, Select достаточно |
| Валидация Decimal полей | Ручные проверки | Zod schema (.positive(), .nonnegative()) | Консистентно с Phase 1 |
| Табличный отчёт | Custom table | TanStack Table + shadcn Table | Паттерн из existing reports |
| Date range picker | Custom date inputs | Существующий паттерн из ReportsPageClient | Уже реализован в отчётах |

## Common Pitfalls

### Pitfall 1: Decimal precision в JavaScript
**What goes wrong:** `Number(order.totalAmount)` теряет точность для больших сумм
**Why it happens:** Prisma Decimal -> JS number conversion
**How to avoid:** Использовать `Number()` только для отображения, бизнес-логику держать в Decimal или использовать формулу только в SQL/Prisma
**Warning signs:** Копейки не сходятся в отчётах

### Pitfall 2: Race condition при обновлении долга
**What goes wrong:** Два пользователя одновременно вводят закупочные данные
**Why it happens:** Нет locking на CustomOrder при updateOrderCosts
**How to avoid:** Использовать `$transaction` с проверкой текущего состояния. Поскольку ввод costs -- редкая операция (1 раз на заказ), достаточно optimistic check.
**Warning signs:** Сумма долга не соответствует purchasePrice + deliveryCost

### Pitfall 3: discountAmount > totalAmount
**What goes wrong:** Отрицательная чистая прибыль из-за некорректной скидки
**Why it happens:** Отсутствие валидации на сервере
**How to avoid:** Zod: `discountAmount.nonnegative().max(totalAmount)` -- валидация в server action
**Warning signs:** Клиент вводит скидку больше суммы заказа

### Pitfall 4: Комиссия для заказов без purchasePrice
**What goes wrong:** Продавец получает 0 комиссию за заказ навсегда
**Why it happens:** purchasePrice не введена -> комиссия = 0
**How to avoid:** Это ОЖИДАЕМОЕ поведение (решение из CONTEXT.md). Но нужно отобразить предупреждение в UI: "Комиссия не начислена -- введите закупочную цену"
**Warning signs:** Продавец жалуется на отсутствие комиссии

### Pitfall 5: Обновление totalAmount при редактировании цены (ORD-08)
**What goes wrong:** totalAmount заказа не пересчитывается при изменении item price
**Why it happens:** totalAmount -- хранимое поле, не computed
**How to avoid:** В action `updateOrderItem` пересчитывать `totalAmount = SUM(price * quantity)` для всех items в транзакции
**Warning signs:** totalAmount не соответствует сумме items

### Pitfall 6: getSuppliersList не фильтрует deletedAt
**What goes wrong:** Удалённые поставщики показываются в dropdown
**Why it happens:** `getSuppliersList` фильтрует только по `isActive: true`, но Phase 3 добавила soft delete
**How to avoid:** `$extends` на Prisma client уже добавляет `deletedAt: null` к findMany (Phase 3 решение). Проверить что `$extends` покрывает этот запрос. Если нет -- добавить `deletedAt: null` явно.
**Warning signs:** Удалённый поставщик появляется в списке

## Code Examples

### Net Profit Pure Function
```typescript
// src/lib/order-utils.ts
export function calculateNetProfit(
  totalAmount: number,
  discountAmount: number,
  purchasePrice: number | null,
  deliveryCost: number | null,
): number | null {
  if (purchasePrice === null) return null
  return totalAmount - discountAmount - purchasePrice - (deliveryCost ?? 0)
}
```

### Permission Registration
```typescript
// src/lib/permissions-list.ts -- добавить
ORDERS_MANAGE_COSTS: { 
  code: "orders.manage_costs", 
  module: "orders", 
  name: "Ввод закупочных цен заказов" 
},
```
**NOTE:** Существующий `orders.costs` -- это VIEW (просмотр). Новый `orders.manage_costs` -- это WRITE (ввод). Разные permissions.

### Модификация COMPLETED flow для discount
```typescript
// В updateOrderStatus / payAndChangeStatus при newStatus === "COMPLETED":
// Сейчас (orders.ts:384):
//   discountAmount: 0,
// Должно стать:
//   discountAmount: extraData?.discountAmount ?? 0,
//   finalAmount: order.totalAmount - (extraData?.discountAmount ?? 0),
```

### Модификация комиссии для заказов (ORD-06)
```typescript
// В calculateEarningsWithFormula, для каждой sale:
// Проверить есть ли связанный заказ
const orderData = sale.customOrder 
  ? { 
      purchasePrice: Number(sale.customOrder.purchasePrice),
      deliveryCost: Number(sale.customOrder.deliveryCost ?? 0),
    } 
  : null

// Если это заказ И purchasePrice введена -- использовать netProfit
// Если это заказ БЕЗ purchasePrice -- комиссия = 0
// Если обычная продажа -- как раньше (sellPrice - costPrice)
```

### Supplier Select в форме заказа (ORD-01)
```tsx
// В order-form.tsx, после полей клиента:
<div>
  <Label>Поставщик</Label>
  <Select value={supplierId} onValueChange={setSupplierId}>
    <SelectTrigger>
      <SelectValue placeholder="Выберите поставщика (опционально)" />
    </SelectTrigger>
    <SelectContent>
      {suppliers.map(s => (
        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| discountAmount = 0 (хардкод) | discountAmount из формы выдачи | Phase 4 | Корректная прибыль по заказам |
| Комиссия от sellPrice-costPrice | Комиссия от netProfit для заказов | Phase 4 | Честная мотивация продавцов |
| Долг = totalAmount (приблизительно) | Долг = purchasePrice + deliveryCost | Phase 4 (после ввода costs) | Точный учёт долгов |

## Open Questions

1. **Нужна ли новая Prisma миграция для `orders.manage_costs` permission seed?**
   - What we know: Permissions хранятся в RolePermission, seed скрипт создаёт начальные данные
   - What's unclear: Нужен ли seed или достаточно ручного добавления через UI
   - Recommendation: Добавить permission в `permissions-list.ts` + seed в миграции

2. **Sale.customOrder relation -- нужна ли для calculateEarnings?**
   - What we know: Sale имеет `customOrder CustomOrder?` relation (через CustomOrder.saleId)
   - What's unclear: Нужно ли добавлять include `customOrder` в запрос sales в calculateEarningsWithFormula
   - Recommendation: Да, добавить `customOrder: { select: { purchasePrice: true, deliveryCost: true } }` в include

3. **Confirmation dialog при вводе закупочных данных?**
   - What we know: Это Claude's discretion
   - Recommendation: Да -- это финансовая операция, обновляющая долг. Confirmation dialog с суммой "Закупочная: X, Доставка: Y, Итого долг: Z. Подтвердить?"

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists, configured) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORD-01 | Supplier select при создании | manual-only (UI) | N/A -- UI dropdown | N/A |
| ORD-02 | Ввод costs после COMPLETED | unit | `npx vitest run src/__tests__/order-costs.test.ts -x` | Wave 0 |
| ORD-03 | calculateNetProfit formula | unit | `npx vitest run src/__tests__/order-net-profit.test.ts -x` | Wave 0 |
| ORD-04 | Debt amount update при costs | unit | `npx vitest run src/__tests__/order-costs.test.ts -x` | Wave 0 |
| ORD-05 | Supplier debts report filters | unit | `npx vitest run src/__tests__/supplier-debts-report.test.ts -x` | Wave 0 |
| ORD-06 | Commission from netProfit | unit | `npx vitest run src/__tests__/order-commission.test.ts -x` | Wave 0 |
| ORD-07 | Discount при выдаче | unit | `npx vitest run src/__tests__/order-discount.test.ts -x` | Wave 0 |
| ORD-08 | Price edit + totalAmount recalc | unit | `npx vitest run src/__tests__/order-item-edit.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/order-net-profit.test.ts` -- covers ORD-03 (pure function)
- [ ] `src/__tests__/order-costs.test.ts` -- covers ORD-02, ORD-04 (cost entry validation logic)
- [ ] `src/__tests__/order-commission.test.ts` -- covers ORD-06 (commission from netProfit)
- [ ] `src/__tests__/order-discount.test.ts` -- covers ORD-07 (discount validation)
- [ ] `src/__tests__/order-item-edit.test.ts` -- covers ORD-08 (price edit + totalAmount recalc)

*Note: ORD-01 (supplier select) и ORD-05 (report page) -- преимущественно UI, тестируются через manual QA или E2E. Unit тесты для report server action можно добавить если getSupplierDebtsReport содержит нетривиальную логику.*

## Sources

### Primary (HIGH confidence)
- Prisma schema: `prisma/schema.prisma` -- CustomOrder, SupplierDebt, Sale models verified
- Server actions: `src/actions/orders.ts` -- createOrder (line 207), updateOrderStatus (274), cancelOrder (817), markSupplierDebtPaid (455), payAndChangeStatus (481)
- Motivation: `src/lib/motivation-utils.ts` -- calculateItemCommission pure function
- Motivation calc: `src/actions/motivation-calculation.ts` -- calculateEarningsWithFormula (line 129)
- Permissions: `src/lib/permissions-list.ts` -- orders.costs already exists (line 26)
- UI components: `src/components/orders/order-form.tsx`, `order-detail.tsx` -- current UI structure
- Reports pattern: `src/actions/reports.ts` -- SQL aggregation pattern
- Suppliers: `src/actions/suppliers.ts:253` -- getSuppliersList() exists

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- user-confirmed business rules for all 8 requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- все библиотеки уже в проекте, новых не требуется
- Architecture: HIGH -- все паттерны повторяют existing code (server actions, pure utils, permission guards)
- Pitfalls: HIGH -- основаны на анализе реального кода (hardcoded 0, Decimal precision, race conditions)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- brownfield, no library upgrades)
