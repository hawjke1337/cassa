---
phase: 07-test-infrastructure-decimal-foundation
plan: 02
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/lib/money.ts
  - src/lib/money.test.ts
  - src/__tests__/setup-decimal-matcher.ts
  - vitest.config.ts
autonomous: true
requirements: [DATA2-02]
must_haves:
  truths:
    - "Сложение 0.1 + 0.2 через `sum()` даёт ровно `0.30` (не `0.30000000000000004`)"
    - "1000 операций сложения 0.01 → ровно 10.00 (precision не теряется)"
    - "1000 операций умножения с процентами не накапливают погрешность"
    - "Branded type `Money` нельзя случайно сложить через `+` (TS compile error)"
    - "Custom matcher `toEqualDecimal('0.30')` работает в любом тесте"
  artifacts:
    - path: src/lib/money.ts
      provides: "toMoney, sum, mul, sub, div, toClient, fromClient — Decimal-arithmetic helpers"
      min_lines: 80
    - path: src/lib/money.test.ts
      provides: "Vitest unit tests, доказывающие precision на 1000+ операциях"
      min_lines: 100
    - path: src/__tests__/setup-decimal-matcher.ts
      provides: "Custom matcher toEqualDecimal для использования во всех тестах"
  key_links:
    - from: src/lib/money.ts
      to: "@prisma/client (Prisma.Decimal)"
      via: "import"
      pattern: "import.*Prisma.*from.*@prisma/client"
    - from: vitest.config.ts
      to: src/__tests__/setup-decimal-matcher.ts
      via: "globalSetupFiles"
      pattern: "setup-decimal-matcher"
---

<objective>
Создать типизированный helper-модуль `src/lib/money.ts` с TDD-доказательством что Decimal-арифметика не теряет точность на 1000 операций. Это прерывает float-погрешности во всём milestone v1.1.

Purpose: Float-арифметика накапливает погрешности, BUG-069 уже существует. Decimal foundation должен быть доказан перед миграцией hotspot-файлов.
Output: `money.ts` модуль + comprehensive test suite + custom matcher для всех остальных тестов.
</objective>

<execution_context>
@/Users/pushkarev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pushkarev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md
@prisma/schema.prisma
</context>

<interfaces>
```ts
// src/lib/money.ts target shape
import { Prisma } from '@prisma/client'

export type Money = string & { readonly \_\_brand: 'Money' }
export type DecimalLike = Prisma.Decimal | string | number

export function toMoney(input: DecimalLike): Prisma.Decimal
export function sum(...values: DecimalLike[]): Prisma.Decimal
export function sub(a: DecimalLike, b: DecimalLike): Prisma.Decimal
export function mul(a: DecimalLike, b: DecimalLike): Prisma.Decimal
export function div(a: DecimalLike, b: DecimalLike): Prisma.Decimal
export function toClient(value: Prisma.Decimal): Money
export function fromClient(value: Money): Prisma.Decimal
export function isMoney(value: unknown): value is Money

````

```ts
// Custom matcher signature
declare module 'vitest' {
  interface Assertion<T> {
    toEqualDecimal(expected: DecimalLike): T
  }
}
````

</interfaces>

<feature>
  <name>Decimal money helpers с branded type</name>
  <files>src/lib/money.ts, src/lib/money.test.ts</files>
  <behavior>
    Cases (RED first — every case must fail before implementation):

    **toMoney:**
    - `toMoney('1499.99').toString()` → `'1499.99'`
    - `toMoney(0).toString()` → `'0'`
    - `toMoney(new Prisma.Decimal('100.50')).toString()` → `'100.5'`
    - `toMoney('not-a-number')` → throws

    **sum (precision proof):**
    - `sum('0.1', '0.2').equals(new Prisma.Decimal('0.3'))` → `true`
    - `sum(...Array(1000).fill('0.01')).equals(new Prisma.Decimal('10'))` → `true`
    - `sum().equals(new Prisma.Decimal(0))` → `true` (empty)
    - `sum('100.50', '200.25', '50.75').toString()` → `'351.5'`

    **sub:**
    - `sub('100.00', '0.30').toString()` → `'99.7'`
    - `sub('1.00', '0.10').equals(new Prisma.Decimal('0.9'))` → `true`

    **mul (motivation formulas):**
    - `mul('1499.99', '0.005').toString()` → `'7.49995'` (0.5% commission)
    - `mul('100', 3).toString()` → `'300'`

    **div:**
    - `div('100', 4).toString()` → `'25'`
    - `div('100.00', 3).toString().startsWith('33.33')` → `true`

    **Edge: 1000 motivation calc operations:**
    - Loop: start `total = toMoney('0')`, 1000 raз `total = sum(total, mul('1499.99', '0.005'))` → `total.equals(new Prisma.Decimal('7499.95'))` → `true`

    **Branded type Money:**
    - `toClient(new Prisma.Decimal('1499.99'))` → `'1499.99'` (typed as Money)
    - `fromClient('1499.99' as Money).toString()` → `'1499.99'`
    - `isMoney('1499.99')` → `false` (no brand on raw string)
    - TS compile check: `toClient(...) + toClient(...)` produces TS error (manually verified in comment, not runtime)

  </behavior>
  <implementation>
    После RED phase (тесты падают):
    1. Создать `src/lib/money.ts` (~80-120 строк):
       - Импортировать `Prisma` из `@prisma/client`
       - `export type Money = string & { readonly __brand: 'Money' }`
       - `export type DecimalLike = Prisma.Decimal | string | number`
       - `toMoney(input)`: `if (input instanceof Prisma.Decimal) return input; return new Prisma.Decimal(input)` — обернуть в try/catch и rethrow с понятным сообщением
       - `sum(...values)`: `values.reduce((acc, v) => acc.add(toMoney(v)), new Prisma.Decimal(0))`
       - `sub(a, b)`: `toMoney(a).sub(toMoney(b))`
       - `mul(a, b)`: `toMoney(a).mul(toMoney(b))`
       - `div(a, b)`: `toMoney(a).div(toMoney(b))`
       - `toClient(value)`: `value.toFixed(2) as Money`
       - `fromClient(value)`: `new Prisma.Decimal(value)`
       - `isMoney(value)`: false (brand невозможно проверить runtime, но функция полезна для type guards в utils — комментарий объяснить)
       - JSDoc на каждый export

    2. GREEN: запустить `pnpm vitest run src/lib/money.test.ts` — все зелёные

    3. REFACTOR (если нужно): извлечь validation в private helper

    Commits:
    - `test(07-02): add failing tests for money helpers`
    - `feat(07-02): implement Decimal money helpers`
    - `refactor(07-02): extract validation` (optional)

  </implementation>
</feature>

<feature>
  <name>Custom Vitest matcher toEqualDecimal</name>
  <files>src/__tests__/setup-decimal-matcher.ts, vitest.config.ts</files>
  <behavior>
    - `expect(new Prisma.Decimal('0.30')).toEqualDecimal('0.3')` → passes
    - `expect(new Prisma.Decimal('0.30')).toEqualDecimal(new Prisma.Decimal('0.3'))` → passes
    - `expect(new Prisma.Decimal('0.30')).toEqualDecimal('0.31')` → fails with message "expected 0.3 to equal 0.31"
    - Matcher available in BOTH unit and e2e projects (через extends-конфиг)
  </behavior>
  <implementation>
    1. **Создать `src/__tests__/setup-decimal-matcher.ts`** (~30 строк):
       ```ts
       import { expect } from 'vitest'
       import { Prisma } from '@prisma/client'

       expect.extend({
         toEqualDecimal(received: unknown, expected: Prisma.Decimal | string | number) {
           const exp = expected instanceof Prisma.Decimal ? expected : new Prisma.Decimal(expected)
           if (!(received instanceof Prisma.Decimal)) {
             return { pass: false, message: () => `expected ${received} to be a Prisma.Decimal` }
           }
           const pass = received.equals(exp)
           return {
             pass,
             message: () => pass
               ? `expected ${received.toString()} not to equal ${exp.toString()}`
               : `expected ${received.toString()} to equal ${exp.toString()}`,
           }
         },
       })

       declare module 'vitest' {
         interface Assertion<T = unknown> {
           toEqualDecimal(expected: Prisma.Decimal | string | number): T
         }
       }
       ```

    2. **Обновить `vitest.config.ts`** — добавить `setup-decimal-matcher.ts` в setupFiles ОБОИХ projects (unit и e2e). НЕ удалять `setup-db.ts` из e2e.
       - unit project: `setupFiles: ['./src/__tests__/setup-decimal-matcher.ts']`
       - e2e project: `setupFiles: ['./src/__tests__/setup-decimal-matcher.ts', './src/__tests__/setup-db.ts']`

    3. Добавить в `src/lib/money.test.ts` 2-3 теста, использующих `toEqualDecimal`, чтобы доказать что matcher работает.

    Commit: `test(07-02): add toEqualDecimal custom matcher`

  </implementation>
</feature>

<verification>
1. `pnpm vitest run src/lib/money.test.ts` — все тесты зелёные
2. `pnpm test:unit` — money.test.ts включён
3. Один из тестов в money.test.ts использует `expect(...).toEqualDecimal('0.30')` и проходит
4. `pnpm typecheck` — 0 ошибок
</verification>

<success_criteria>

- TDD выполнен: RED → GREEN → (optional REFACTOR), commits атомарные
- 1000-операций тесты проходят (precision proof)
- Branded type Money экспортирован
- Custom matcher работает в unit project
  </success_criteria>

<output>
Создать `.planning/phases/07-test-infrastructure-decimal-foundation/07-02-SUMMARY.md`.
</output>
</content>
</invoke>
