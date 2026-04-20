# Phase 6: UX - Research

**Researched:** 2026-04-06
**Domain:** POS UX polish, dashboard metrics, navigation improvements
**Confidence:** HIGH

## Summary

Phase 6 -- финальная UX-полировка ePRM. Три направления: (1) POS-интерфейс -- debounce уже реализован в pos-interface.tsx (300ms), нужно добавить persist middleware в Zustand корзину, поддержку EAN-13 штрихкодов, и исправить Escape конфликт; (2) POS-оплата -- cashReceived/changeAmount в БД, защита от двойного клика, комментарий к продаже, печать возврата, история продаж; (3) дашборд и навигация -- прибыль/маржа из getProfitReport, readyRepairsCount (данные уже есть в dashboard action), breadcrumbs, toast ошибки, formatDuration, замена native select.

Все изменения -- brownfield: затрагиваются существующие компоненты и паттерны. Ни одна задача не требует новых библиотек. Zustand 5 persist middleware, shadcn Dialog/Select, sonner toast -- все уже в проекте. Миграция БД минимальна: 2 новых Decimal поля на Sale (cashReceived, changeAmount), 1 новое значение в DocumentType enum (RETURN_ACT).

**Primary recommendation:** Выполнять в 3 плана по группам (POS UX, POS оплата, дашборд). Каждый план -- самодостаточный, параллелизация не нужна.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Debounce >= 300ms, единый паттерн (уже в pos-interface.tsx через setTimeout)
- Zustand persist с localStorage, ключ `astore-pos-cart`, без sync между вкладками
- Escape fix: stopPropagation или проверка isDialogOpen
- EAN-13: 13 цифр -> barcode, 15 цифр -> IMEI
- cashReceived/changeAmount -- Decimal поля в Sale
- Двойной клик: disabled + spinner на кнопке
- Комментарий: Sale.comment (поле уже есть в схеме)
- Печать возврата: аналогично чеку продажи через DocumentRenderer
- История продаж: последние 20 продаж текущей смены, поиск по номеру
- Прибыль/маржа: данные из getProfitReport
- Breadcrumbs: покрыть все 14+ маршрутов
- Ошибки дашборда: try/catch + toast, частичные данные
- readyRepairsCount: данные уже есть в getDashboardData
- Время смены: formatDuration(minutes) -> "Xч Yм"
- Native select -> shadcn Select в return-form.tsx и trade-in-detail-client.tsx

### Claude's Discretion

- Layout истории продаж (modal vs sidebar vs drawer)
- Дизайн карточек дашборда (размер, иконки)
- Route для печати возврата (новый или модификация существующего)
- Порядок карточек на дашборде

### Deferred Ideas (OUT OF SCOPE)

None
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID    | Description                          | Research Support                                                        |
| ----- | ------------------------------------ | ----------------------------------------------------------------------- |
| UX-01 | Debounce на всех поисковых полях     | POS уже 300ms; проверить заказы/склад -- все через server action search |
| UX-02 | Персистентная корзина POS            | Zustand 5 persist middleware на use-cart.ts                             |
| UX-03 | cashReceived/changeAmount в БД + чек | Новые Decimal поля + миграция; PaymentDialog уже считает change         |
| UX-04 | Escape конфликт                      | stopPropagation на Dialog или guard paymentOpen в handleKeyDown         |
| UX-05 | EAN-13 штрихкод                      | Расширить IMEI-блок в pos-interface.tsx (13 цифр -> barcode search)     |
| UX-06 | Комментарий к продаже                | Sale.comment уже в схеме; добавить Textarea в PaymentDialog             |
| UX-07 | Печатная форма возврата              | Новый RETURN_ACT в DocumentType + /print/return/[id] route              |
| UX-08 | Защита от двойного клика             | useState isPending + disabled на Button в PaymentDialog                 |
| UX-09 | История продаж в POS                 | Новый компонент; searchSaleByNumber уже есть; getSalesByShift нужен     |
| UX-10 | Прибыль/маржа на дашборде            | getProfitReport уже SQL-оптимизирован; добавить карточку                |
| UX-11 | Breadcrumbs все маршруты             | header.tsx pageTitles -- расширить словарь, добавить вложенные routes   |
| UX-12 | Ошибки дашборда через toast          | try/catch в dashboard-content.tsx с partial render                      |
| UX-13 | readyRepairsCount на дашборде        | Данные уже в getDashboardData; добавить StatCard                        |
| UX-14 | Время смены "Xч Yм"                  | formatDuration утилита в src/lib/format.ts                              |
| UX-15 | Native select -> shadcn Select       | 2 файла: return-form.tsx, trade-in-detail-client.tsx                    |

</phase_requirements>

## Standard Stack

### Core (уже установлено)

| Library   | Version   | Purpose                              | Why Standard                   |
| --------- | --------- | ------------------------------------ | ------------------------------ |
| zustand   | 5.0.11    | State management + persist           | Уже используется для корзины   |
| next      | 16.1.6    | Framework                            | Уже установлен                 |
| sonner    | installed | Toast notifications                  | Уже используется через `toast` |
| shadcn/ui | installed | UI компоненты (Select, Dialog, etc.) | Единый стек по CLAUDE.md       |

### Supporting (не требует установки)

| Library      | Version   | Purpose        | When to Use                 |
| ------------ | --------- | -------------- | --------------------------- |
| lucide-react | installed | Иконки         | Для новых карточек дашборда |
| prisma       | installed | ORM + миграции | Новые поля Sale             |

### Alternatives Considered

| Instead of           | Could Use        | Tradeoff                                                 |
| -------------------- | ---------------- | -------------------------------------------------------- |
| setTimeout debounce  | use-debounce npm | Не нужно -- setTimeout уже работает в POS и консистентен |
| localStorage persist | IndexedDB        | Overkill для корзины из 5-10 items                       |

**Installation:** Новых пакетов не требуется.

## Architecture Patterns

### Текущая структура (затрагиваемые файлы)

```
src/
├── hooks/use-cart.ts              # UX-02: добавить persist middleware
├── components/pos/
│   ├── pos-interface.tsx           # UX-01, UX-04, UX-05, UX-09
│   ├── payment-dialog.tsx          # UX-03, UX-06, UX-08
│   ├── return-form.tsx             # UX-15: native select
│   └── sales-history.tsx           # UX-09: НОВЫЙ компонент
├── components/dashboard/
│   ├── dashboard-content.tsx       # UX-10, UX-12, UX-13
│   └── stat-card.tsx               # Используется для новых карточек
├── components/layout/
│   └── header.tsx                  # UX-11: breadcrumbs
├── lib/
│   └── format.ts                   # UX-14: formatDuration
├── actions/
│   ├── sales.ts                    # UX-03, UX-05, UX-09: расширить
│   ├── dashboard.ts                # UX-10: вызов getProfitReport
│   └── document-templates.ts       # UX-07: RETURN_ACT тип
├── app/(dashboard)/
│   ├── print/return/[id]/page.tsx  # UX-07: НОВЫЙ route
│   └── trade-in/[id]/
│       └── trade-in-detail-client.tsx # UX-15: native select
└── prisma/schema.prisma            # UX-03, UX-07: миграция
```

### Pattern 1: Zustand Persist Middleware

**What:** Добавить `persist` middleware в существующий Zustand store
**When to use:** UX-02
**Example:**

```typescript
// Zustand 5 persist syntax
import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      // ... все существующие методы без изменений
    }),
    {
      name: "astore-pos-cart",
      // partialize: опционально для исключения computed fields
    },
  ),
)
```

**Confidence:** HIGH -- Zustand 5 persist API стабилен

### Pattern 2: Escape Guard

**What:** Предотвращение конфликта Escape между Dialog и очисткой корзины
**When to use:** UX-04
**Example:**

```typescript
// В handleKeyDown -- проверить что Dialog НЕ открыт
} else if (e.key === "Escape") {
  e.preventDefault()
  // Guard: если открыт PaymentDialog или SerialPicker -- не очищать
  if (paymentOpen || serialPickerProduct || clearConfirmOpen) return
  if (items.length > 0) {
    setClearConfirmOpen(true)
  }
}
```

**Confidence:** HIGH -- простая проверка состояния

### Pattern 3: Double-click Protection

**What:** Disabled кнопка + loading state при отправке
**When to use:** UX-08
**Example:**

```typescript
// В PaymentDialog -- loading уже есть (useState), просто нужно disabled
<Button
  disabled={loading || items.length === 0 || ...}
  onClick={handleConfirm}
>
  {loading ? <Loader2 className="animate-spin" /> : "Подтвердить"}
</Button>
```

**Note:** `loading` state уже реализован в payment-dialog.tsx (строки 56, 129-151, 302-318). Кнопка УЖЕ disabled при `loading`. Фактически UX-08 уже частично реализован -- нужно только убедиться что setLoading(true) происходит ДО async вызова (что и сделано на строке 129).

### Pattern 4: Dashboard Error Handling

**What:** Partial render при ошибках отдельных метрик
**When to use:** UX-12
**Example:**

```typescript
// dashboard-content.tsx -- catch не сбрасывает data в null
getDashboardData(currentStoreId)
  .then(setData)
  .catch((err) => {
    toast.error("Ошибка загрузки данных дашборда")
    // НЕ setData(null) -- если были partial данные, показать их
  })
  .finally(() => setLoading(false))
```

### Anti-Patterns to Avoid

- **Global keydown без guard:** Escape-хандлер в POS ловит ВСЕ Escape нажатия, включая внутри диалогов. Всегда проверять state диалогов.
- **Persist без version:** Zustand persist без `version` поля не сможет мигрировать при изменении CartItem interface. Добавить `version: 1`.
- **Sync debounce across tabs:** НЕ синхронизировать корзину между вкладками (одна касса = один компьютер).

## Don't Hand-Roll

| Problem             | Don't Build                 | Use Instead                    | Why                                         |
| ------------------- | --------------------------- | ------------------------------ | ------------------------------------------- |
| State persistence   | Custom localStorage wrapper | Zustand persist middleware     | Handles hydration, serialization, migration |
| Debounce            | Custom debounce function    | setTimeout (уже есть)          | Работает, консистентно с codebase           |
| Toast notifications | Custom notification system  | sonner (уже есть)              | Уже используется во всех компонентах        |
| Print layout        | Custom CSS print            | PrintLayout + DocumentRenderer | Паттерн уже есть для 8 типов документов     |
| Select component    | Styled native select        | shadcn Select                  | Уже используется в 15+ местах               |

**Key insight:** Все инструменты уже в проекте. Phase 6 -- чисто интеграционная работа без новых зависимостей.

## Common Pitfalls

### Pitfall 1: Zustand Persist Hydration Mismatch

**What goes wrong:** SSR рендерит пустую корзину, клиент hydrate из localStorage -- мерцание
**Why it happens:** Next.js SSR не имеет доступа к localStorage
**How to avoid:** POS-компонент уже `"use client"` и загружается только на клиенте. Zustand persist middleware автоматически обрабатывает hydration. Но если видно мерцание, использовать `onRehydrateStorage` callback или `skipHydration` + ручной `useCart.persist.rehydrate()`.
**Warning signs:** Flash of empty cart при навигации на /pos

### Pitfall 2: EAN-13 vs 13-digit random input

**What goes wrong:** Пользователь вводит 13 цифр (например, номер телефона) -- система пытается искать по barcode
**Why it happens:** Только проверка длины (13 цифр)
**How to avoid:** EAN-13 имеет контрольную цифру. Добавить валидацию checksum: `sum of digits * weights (1,3,1,3...) mod 10 == 0`. Это отсекает случайные 13-значные числа.
**Warning signs:** Ложные срабатывания barcode поиска

### Pitfall 3: cashReceived не передается в createSale

**What goes wrong:** Поле cashReceived уже отображается в PaymentDialog, но не передается в server action
**Why it happens:** createSale schema не включает cashReceived/changeAmount
**How to avoid:** Расширить Zod schema для createSale, добавить cashReceived/changeAmount в input. Обязательно серверная валидация: changeAmount == cashReceived - finalAmount.
**Warning signs:** Сдача показана в UI но не сохранена в БД

### Pitfall 4: Breadcrumb для динамических routes

**What goes wrong:** Для /orders/[id] breadcrumb показывает "Заказы" без номера заказа
**Why it happens:** header.tsx использует pageTitles dict с статическими путями
**How to avoid:** Для nested routes использовать regex matching. Формат: "Заказы > ORD-123" требует данные о заказе. Простое решение -- показывать только section name без ID (как сейчас для /catalog).
**Warning signs:** Breadcrumb пустой на динамических страницах

### Pitfall 5: DocumentType enum migration

**What goes wrong:** Добавление RETURN_ACT в DocumentType enum требует миграции
**Why it happens:** Prisma enum mapping к PostgreSQL enum type
**How to avoid:** Prisma migration автоматически обработает ALTER TYPE. Но если есть drift -- `prisma migrate resolve`. Проверить что getDocumentData поддерживает новый тип.
**Warning signs:** Migration failure на deployed DB

## Code Examples

### Zustand Persist (UX-02)

```typescript
// src/hooks/use-cart.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => {
        /* existing code */
      },
      clearCart: () => set({ items: [] }),
      // ... rest unchanged
    }),
    {
      name: "astore-pos-cart",
      version: 1,
    },
  ),
)
```

### EAN-13 Validation + Search (UX-05)

```typescript
// src/lib/barcode.ts
export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  const digits = code.split("").map(Number)
  const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0)
  return checksum % 10 === 0
}

// В pos-interface.tsx, рядом с IMEI check:
if (/^\d{13}$/.test(search.trim()) && isValidEAN13(search.trim())) {
  const barcodeResult = await searchByBarcodeForPos(currentStoreId, search.trim())
  if (barcodeResult) {
    addItem({
      /* ... */
    })
    setSearch("")
    toast.success(`${barcodeResult.name} добавлен по штрихкоду`)
    return
  }
}
```

### formatDuration (UX-14)

```typescript
// src/lib/format.ts
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}м`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`
}
```

### Prisma Migration (UX-03)

```prisma
// schema.prisma -- Sale model additions
model Sale {
  // ... existing fields
  cashReceived   Decimal?  @db.Decimal(12, 2)
  changeAmount   Decimal?  @db.Decimal(12, 2)
  // comment already exists as String?
}
```

### Native Select -> shadcn Select (UX-15)

```typescript
// Before (return-form.tsx):
<select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
  <option value="CASH">Наличные</option>
</select>

// After:
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select value={refundMethod} onValueChange={setRefundMethod}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="CASH">Наличные</SelectItem>
    <SelectItem value="CARD">Карта</SelectItem>
    <SelectItem value="SBP">СБП</SelectItem>
    <SelectItem value="TRANSFER">Перевод</SelectItem>
    <SelectItem value="CREDIT">Рассрочка</SelectItem>
  </SelectContent>
</Select>
```

## State of the Art

| Old Approach       | Current Approach             | When Changed        | Impact                      |
| ------------------ | ---------------------------- | ------------------- | --------------------------- |
| Zustand 4 persist  | Zustand 5 persist (same API) | 2024                | Нет изменений в persist API |
| Manual debounce    | setTimeout pattern           | Already in codebase | Консистентно                |
| Native HTML select | shadcn Select                | shadcn convention   | Unified UI                  |

**Deprecated/outdated:**

- Ничего не устарело -- все используемые API актуальны для текущих версий

## Open Questions

1. **История продаж: layout**
   - What we know: Нужна кнопка в POS, показывающая последние 20 продаж смены
   - What's unclear: Modal (Dialog), Sheet (sidebar), или Drawer?
   - Recommendation: **Sheet (sidebar)** -- не блокирует POS полностью, видна корзина рядом. Использовать shadcn Sheet с `side="left"`.

2. **Печать возврата: route**
   - What we know: Паттерн печати через DocumentRenderer + getDocumentData(type, id)
   - What's unclear: Создавать новый DocumentType RETURN_ACT или переиспользовать SALE_RECEIPT с флагом?
   - Recommendation: **Новый тип RETURN_ACT** -- чище, позволяет отдельный шаблон. Migration: добавить в enum + seed default template.

3. **Порядок карточек на дашборде**
   - What we know: Сейчас 5 карточек в одном ряду (lg:grid-cols-4 но 5 карточек)
   - Recommendation: 2 ряда: (1) Продажи, Выручка, Ср.чек, **Прибыль** -- 4 шт; (2) Заказы, Ремонты в работе, **Готовые ремонты** -- 3 шт (или в отдельную секцию)

## Validation Architecture

### Test Framework

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| Framework          | Vitest 4.1.2                        |
| Config file        | vitest.config.ts                    |
| Quick run command  | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run`                    |

### Phase Requirements -> Test Map

| Req ID | Behavior                                       | Test Type   | Automated Command                                          | File Exists? |
| ------ | ---------------------------------------------- | ----------- | ---------------------------------------------------------- | ------------ |
| UX-01  | Debounce >= 300ms на поиске                    | manual-only | Visual check in browser                                    | N/A          |
| UX-02  | Корзина persist в localStorage                 | unit        | `npx vitest run src/__tests__/cart-persist.test.ts -x`     | Wave 0       |
| UX-03  | cashReceived/changeAmount в Sale               | unit        | `npx vitest run src/__tests__/cash-change.test.ts -x`      | Wave 0       |
| UX-04  | Escape не очищает корзину при открытом диалоге | manual-only | Keyboard test in browser                                   | N/A          |
| UX-05  | EAN-13 валидация и поиск                       | unit        | `npx vitest run src/__tests__/ean13-validation.test.ts -x` | Wave 0       |
| UX-06  | Комментарий сохраняется в Sale                 | unit        | `npx vitest run src/__tests__/sale-comment.test.ts -x`     | Wave 0       |
| UX-07  | Печатная форма возврата                        | manual-only | Visual check /print/return/[id]                            | N/A          |
| UX-08  | Двойной клик blocked                           | manual-only | Visual check (loading state already exists)                | N/A          |
| UX-09  | История продаж отображается                    | manual-only | Visual check in POS                                        | N/A          |
| UX-10  | Прибыль на дашборде                            | manual-only | Visual check dashboard                                     | N/A          |
| UX-11  | Breadcrumbs на всех маршрутах                  | unit        | `npx vitest run src/__tests__/breadcrumbs.test.ts -x`      | Wave 0       |
| UX-12  | Toast при ошибке дашборда                      | manual-only | Visual check                                               | N/A          |
| UX-13  | readyRepairsCount на дашборде                  | manual-only | Visual check                                               | N/A          |
| UX-14  | formatDuration корректно                       | unit        | `npx vitest run src/__tests__/format-duration.test.ts -x`  | Wave 0       |
| UX-15  | shadcn Select вместо native                    | manual-only | Visual check                                               | N/A          |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/ean13-validation.test.ts` -- covers UX-05 (isValidEAN13 pure function)
- [ ] `src/__tests__/format-duration.test.ts` -- covers UX-14 (formatDuration pure function)
- [ ] `src/__tests__/cart-persist.test.ts` -- covers UX-02 (Zustand persist config)
- [ ] `src/__tests__/breadcrumbs.test.ts` -- covers UX-11 (pageTitles coverage)

## Sources

### Primary (HIGH confidence)

- Codebase analysis: pos-interface.tsx, payment-dialog.tsx, use-cart.ts, dashboard-content.tsx, header.tsx, return-form.tsx, trade-in-detail-client.tsx
- prisma/schema.prisma -- Sale model, DocumentType enum
- src/actions/dashboard.ts -- readyRepairsCount already computed
- src/actions/reports.ts -- getProfitReport SQL-optimized

### Secondary (MEDIUM confidence)

- Zustand 5 persist middleware API -- stable, same as Zustand 4

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- все библиотеки уже установлены и используются
- Architecture: HIGH -- все паттерны уже в codebase (print, dashboard cards, persist)
- Pitfalls: HIGH -- основаны на прямом анализе кода

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable codebase, no moving targets)
