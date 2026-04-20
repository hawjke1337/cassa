---
phase: 07-test-infrastructure-decimal-foundation
plan: 03
type: execute
wave: 2
depends_on: ["07-01", "07-02"]
files_modified:
  - src/actions/sales.ts
  - src/actions/shifts.ts
  - src/actions/orders.ts
  - src/actions/motivation-calculation.ts
  - src/actions/repairs.ts
  - eslint.config.mjs
  - src/__tests__/e2e/sales-decimal.e2e.test.ts
  - src/__tests__/e2e/shifts-cash-reconciliation.e2e.test.ts
  - src/__tests__/e2e/motivation-precision.e2e.test.ts
autonomous: true
requirements: [DATA2-02]
must_haves:
  truths:
    - "src/actions/sales.ts не содержит ни одного `Number(` для денежных полей (sellPrice/costPrice/total/finalAmount/discountAmount)"
    - "src/actions/shifts.ts cash reconciliation формула использует sum/sub из money.ts"
    - "src/actions/motivation-calculation.ts процентные расчёты используют mul из money.ts"
    - "ESLint правило no-restricted-syntax блокирует Number( на whitelist денежных полей"
    - "E2E тест доказывает что 1000 createSale операций сохраняют точность копейки"
  artifacts:
    - path: src/actions/sales.ts
      provides: "Migrated to Prisma.Decimal arithmetic"
      contains: "from '@/lib/money'"
    - path: src/actions/shifts.ts
      provides: "Cash reconciliation через Decimal helpers"
      contains: "from '@/lib/money'"
    - path: src/actions/motivation-calculation.ts
      provides: "Mul/sum через money.ts"
      contains: "from '@/lib/money'"
    - path: eslint.config.mjs
      provides: "no-restricted-syntax rule блокирующий Number() на денежных полях"
    - path: src/__tests__/e2e/sales-decimal.e2e.test.ts
      provides: "E2E proof: createSale возвращает точные Decimal без потерь"
  key_links:
    - from: src/actions/sales.ts
      to: src/lib/money.ts
      via: "import"
      pattern: "from '@/lib/money'"
    - from: eslint.config.mjs
      to: "no-restricted-syntax"
      via: "rule config"
      pattern: "no-restricted-syntax"
---

<objective>
Мигрировать 5 hotspot-файлов с `Number()` на `Prisma.Decimal` через helpers из `src/lib/money.ts`. Установить ESLint guard, блокирующий Number() на денежных полях для нового кода. Доказать корректность E2E тестами на реальной БД.

Purpose: 138 `Number()` calls в этих 5 файлах — критичные точки потери копеек (BUG-069, BUG-078). После Phase 7 эти файлы — bedrock для всей последующей бизнес-логики v1.1.
Output: Hotspot-файлы используют Decimal everywhere, ESLint защищает от регрессии, E2E тесты доказывают точность.
</objective>

<execution_context>
@/Users/pushkarev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pushkarev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md
@src/lib/money.ts
@src/actions/sales.ts
@src/actions/shifts.ts
@src/actions/orders.ts
@src/actions/motivation-calculation.ts
@src/actions/repairs.ts
@prisma/schema.prisma
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Мигрировать sales.ts + shifts.ts + написать E2E proof</name>
  <files>src/actions/sales.ts, src/actions/shifts.ts, src/__tests__/e2e/sales-decimal.e2e.test.ts, src/__tests__/e2e/shifts-cash-reconciliation.e2e.test.ts</files>
  <read_first>
    - src/actions/sales.ts (full file — 52 Number() calls)
    - src/actions/shifts.ts (full file, lines 35-41 особенно — cash reconciliation формула)
    - src/lib/money.ts (helpers созданные в Plan 02)
    - src/__tests__/e2e/example.e2e.test.ts (паттерн из Plan 01)
    - src/__tests__/helpers/fixtures.ts
    - prisma/schema.prisma (Sale, SaleItem, Payment, Shift модели — все денежные поля типа Decimal)
  </read_first>
  <behavior>
    - createSale(items: 3 шт по 1499.99): Sale.totalAmount должен быть `4499.97`, не `4499.969999999...`
    - createSale с discount 0.5%: finalAmount === toMoney(totalAmount).sub(mul(totalAmount, '0.005')) — точно
    - 1000 последовательных createSale на одной смене: sum(all Sale.finalAmount) === ожидаемая сумма (точно)
    - closeShift: expectedCash = openingCash + sum(cashSales) - sum(cashWithdrawals) + sum(cashDeposits) — все через `sum/sub`, не Number()
    - closeShift с миксом наличных операций: discrepancy === expectedCash.sub(closingCash), без потерь копеек на 100+ операциях
  </behavior>
  <action>
    1. **`src/actions/sales.ts`** — пройти все 52 `Number(` calls на денежных полях:
       - Импортировать `import { sum, mul, sub, div, toMoney } from '@/lib/money'`
       - Импортировать `import { Prisma } from '@prisma/client'`
       - Заменить:
         - `Number(item.price) * item.quantity` → `mul(item.price, item.quantity)`
         - `total + Number(x.amount)` → `sum(total, x.amount)` (где total накапливается)
         - `Number(sellPrice) - Number(discount)` → `sub(sellPrice, discount)`
         - Любую формулу `Number(a) * Number(b) - Number(c)` → разложить через mul/sub
       - НЕ трогать: `Number()` на quantity (целое число), на индексах массивов, на pageSize/offset
       - Возвращаемые значения Server Action: преобразовать Decimal → string через `.toFixed(2)` (или `toClient(value)` для branded type) — текущий паттерн возврата сохранить (string), но без `Number()` на пути
       - Все промежуточные accumulators объявлять как `Prisma.Decimal`

    2. **`src/actions/shifts.ts`** — особое внимание lines 35-41 (cash reconciliation):
       - Импортировать helpers
       - Формулу expectedCash = openingCash + cashSales - cashWithdrawals + cashDeposits переписать через `sum(openingCash, sum(...cashSales), sum(...cashDeposits))` минус `sum(...cashWithdrawals)`
       - discrepancy = sub(expectedCash, closingCash)
       - Все 35 `Number(` calls заменить аналогично sales.ts

    3. **`src/__tests__/e2e/sales-decimal.e2e.test.ts`** (~120 строк) — TDD-тесты, написанные ПЕРЕД миграцией кода:
       - Setup: createTestStore + createTestUser + createTestProduct + createTestStoreProduct (sellPrice='1499.99', costPrice='999.50', quantity=10000)
       - Test 1: Single sale 1 unit — finalAmount.equals('1499.99')
       - Test 2: Sale 3 units no discount — totalAmount.equals('4499.97')
       - Test 3: Sale with 0.5% discount — discountAmount.equals('22.4998') и finalAmount === sub
       - Test 4 (1000-loop precision): создать 1000 sales по 0.01₽, sum всех finalAmount должен === '10.00'
       - Test 5: createSale с float-input от клиента (`'1499.99'`) — Sale.finalAmount в БД === '1499.99' (не сериализованный с потерей)
       - Использовать `toEqualDecimal` matcher из Plan 02

    4. **`src/__tests__/e2e/shifts-cash-reconciliation.e2e.test.ts`** (~80 строк):
       - Setup: открытая смена с openingCash='1000.00'
       - Симулировать 100 cashSales по '0.01' через createSale (или прямые Payment вставки)
       - closeShift с closingCash='1001.00' → expectedCash должен === '1001.00', discrepancy === '0.00'
       - Edge: смешать withdrawal '500.50' и deposit '200.25' → expectedCash === точная формула

    5. RED → GREEN cycle:
       - Сначала написать ВСЕ тесты, запустить — они ДОЛЖНЫ упасть на текущей `Number()` логике (precision loss)
       - Commit: `test(07-03): add failing E2E precision tests for sales+shifts`
       - Затем мигрировать sales.ts и shifts.ts
       - Запустить тесты — должны пройти
       - Commit: `feat(07-03): migrate sales.ts + shifts.ts to Prisma.Decimal`

  </action>
  <verify>
    <automated>cd astore-erp && ! grep -nE "Number\((sellPrice|costPrice|amount|total|finalAmount|discountAmount|cashReceived|changeAmount|openingCash|closingCash|expectedCash|discrepancy)" src/actions/sales.ts src/actions/shifts.ts && grep -q "from '@/lib/money'" src/actions/sales.ts && grep -q "from '@/lib/money'" src/actions/shifts.ts && pnpm test:e2e -- sales-decimal shifts-cash-reconciliation</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "Number\((sellPrice|costPrice|amount|total|finalAmount|discountAmount|cashReceived|changeAmount)" src/actions/sales.ts` returns 0 matches
    - `grep -nE "Number\((openingCash|closingCash|expectedCash|discrepancy|amount)" src/actions/shifts.ts` returns 0 matches
    - `src/actions/sales.ts` contains literal `from '@/lib/money'`
    - `src/actions/shifts.ts` contains literal `from '@/lib/money'`
    - `src/__tests__/e2e/sales-decimal.e2e.test.ts` exists with at least 5 `it(` blocks
    - `pnpm test:e2e` runs sales-decimal and shifts-cash-reconciliation tests, all green
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    sales.ts и shifts.ts мигрированы на Decimal helpers, E2E тесты доказывают точность на 1000+ операциях, типы корректны.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Мигрировать orders.ts + motivation-calculation.ts + repairs.ts + motivation E2E</name>
  <files>src/actions/orders.ts, src/actions/motivation-calculation.ts, src/actions/repairs.ts, src/__tests__/e2e/motivation-precision.e2e.test.ts</files>
  <read_first>
    - src/actions/orders.ts (29 Number() calls)
    - src/actions/motivation-calculation.ts (13 calls, processionage formulas — критично BUG-078)
    - src/actions/repairs.ts (9 calls)
    - src/lib/money.ts
    - src/__tests__/helpers/fixtures.ts
  </read_first>
  <behavior>
    - calculateMotivation для seller с rate 0.5%, sales 100×1499.99: bonus === toMoney('1499.99').mul('0.005').mul(100) ровно
    - 1000 sales × percentage commission accumulation: финальная сумма === ожидаемая (без drift)
    - Order with prepayment 5000.00 + total 30000.00: finalAmount === '25000.00' (sub-точность)
    - Repair finalCost mutations не теряют копейки
  </behavior>
  <action>
    1. **`src/actions/orders.ts`** (29 calls):
       - Аналогично Task 1: импортировать money helpers, заменить все Number() на денежных полях через mul/sum/sub/div
       - Особое внимание: `totalAmount`, `prepaidAmount`, `finalAmount`, `purchasePrice`, `deliveryCost`
       - finalAmount = sub(totalAmount, prepaidAmount)
       - netProfit = sub(sub(totalAmount, purchasePrice), deliveryCost)

    2. **`src/actions/motivation-calculation.ts`** (13 calls — критично):
       - Замена `Number(saleTotal) * Number(rate)` → `mul(saleTotal, rate)`
       - Замена `total += Number(...)` → `total = sum(total, ...)`
       - Все промежуточные totals — `Prisma.Decimal`
       - Возврат: `.toFixed(2)` для UI слоя

    3. **`src/actions/repairs.ts`** (9 calls):
       - Аналогично, поля `estimatedCost`, `agreedCost`, `finalCost`

    4. **`src/__tests__/e2e/motivation-precision.e2e.test.ts`** (~100 строк):
       - Setup: создать MotivationScheme с PERCENT rate '0.005' (0.5%), Sale из 1000 итераций по '1499.99'
       - Запустить calculateMotivation через action
       - expect(result.bonus).toEqualDecimal('7499.95') — точная сумма без drift
       - Test 2: rate '0.0033' (нестандартный), 100 итераций — точное совпадение с manual `mul(...).mul(100)`
       - Test 3: смешанные продажи (разные суммы) — sum через map+reduce совпадает с server action

    5. RED → GREEN cycle (написать тесты, увидеть падение, мигрировать, увидеть зелёное)

    Commits:
    - `test(07-03): add E2E motivation precision tests`
    - `feat(07-03): migrate orders.ts, motivation-calculation.ts, repairs.ts to Decimal`

  </action>
  <verify>
    <automated>cd astore-erp && ! grep -nE "Number\((sellPrice|costPrice|amount|total|finalAmount|discountAmount|prepaidAmount|purchasePrice|deliveryCost|estimatedCost|agreedCost|finalCost|rate|bonus|commission)" src/actions/orders.ts src/actions/motivation-calculation.ts src/actions/repairs.ts && grep -q "from '@/lib/money'" src/actions/orders.ts && grep -q "from '@/lib/money'" src/actions/motivation-calculation.ts && grep -q "from '@/lib/money'" src/actions/repairs.ts && pnpm test:e2e -- motivation-precision</automated>
  </verify>
  <acceptance_criteria>
    - 0 `Number(` calls на whitelist денежных полях во всех 3 файлах (grep returns 0)
    - Все 3 файла contain `from '@/lib/money'`
    - `src/__tests__/e2e/motivation-precision.e2e.test.ts` contains at least 3 `it(` blocks с `toEqualDecimal`
    - `pnpm test:e2e` для motivation-precision — все зелёные
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    Все 5 hotspot-файлов мигрированы, E2E тесты доказывают precision, типы корректны.
  </done>
</task>

<task type="auto">
  <name>Task 3: ESLint guard против Number() на денежных полях</name>
  <files>eslint.config.mjs</files>
  <read_first>
    - eslint.config.mjs (текущий конфиг — обычно eslint-config-next)
    - .planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md (lines 60-75, ESLint rule decision)
  </read_first>
  <action>
    1. Найти существующий eslint конфиг (`eslint.config.mjs` или `eslint.config.js` или `.eslintrc.*`). Если нет — создать `eslint.config.mjs` extending `eslint-config-next`.

    2. Добавить правило `no-restricted-syntax` (или дополнить существующее) — блокирует `Number(<arg>)` где arg — Identifier из whitelist денежных полей:

    Использовать AST selector `CallExpression[callee.name='Number'][arguments.0.type='Identifier']` с whitelist через regex в имени:

    ```js
    {
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.name='Number'][arguments.0.type='Identifier'][arguments.0.name=/^(sellPrice|costPrice|price|total|amount|finalAmount|discountAmount|cashReceived|changeAmount|openingCash|closingCash|expectedCash|discrepancy|prepaidAmount|purchasePrice|deliveryCost|estimatedCost|agreedCost|finalCost|bonus|commission|rate|crossBonuses|repairBonuses|returns|dailyTotal|commissions|totalAmount|cashSales|cashWithdrawals|cashDeposits)$/]",
            message: "Не используй Number() на денежных полях. Импортируй { toMoney, sum, mul, sub, div } из '@/lib/money'.",
          },
          {
            selector: "CallExpression[callee.name='Number'][arguments.0.type='MemberExpression'][arguments.0.property.name=/^(sellPrice|costPrice|price|total|amount|finalAmount|discountAmount|cashReceived|changeAmount|openingCash|closingCash|expectedCash|discrepancy|prepaidAmount|purchasePrice|deliveryCost|estimatedCost|agreedCost|finalCost|bonus|commission|rate|crossBonuses|repairBonuses|returns|dailyTotal|commissions|totalAmount)$/]",
            message: "Не используй Number() на денежных полях (member access). Импортируй { toMoney, sum, mul, sub, div } из '@/lib/money'.",
          },
        ],
      },
    }
    ```

    3. Исключения для тестов: добавить override чтобы тесты могли использовать Number() для test data assertion:
       ```js
       {
         files: ['**/*.test.ts', '**/__tests__/**'],
         rules: { 'no-restricted-syntax': 'off' },
       }
       ```

    4. Запустить `pnpm lint` — должен пройти на текущем коде (после миграции в Task 1+2). Если показывает ошибки — это означает что Task 1+2 пропустили места, нужно исправить.

  </action>
  <verify>
    <automated>cd astore-erp && grep -q "no-restricted-syntax" eslint.config.mjs && grep -q "money" eslint.config.mjs && pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `eslint.config.mjs` contains literal `no-restricted-syntax`
    - `eslint.config.mjs` contains literal `from '@/lib/money'` (in error message)
    - `eslint.config.mjs` whitelist contains at least: `sellPrice`, `costPrice`, `total`, `amount`, `finalAmount`, `discountAmount`, `openingCash`, `closingCash`
    - `pnpm lint` exits 0 (после миграции hotspot-файлов в Task 1+2 — линт должен быть зелёным)
    - Регрессионный тест: вручную добавить `Number(sellPrice)` в любой `src/actions/*.ts` → `pnpm lint` падает с правильным message → откатить (документировать в done)
  </acceptance_criteria>
  <done>
    ESLint guard активен, hotspot-файлы проходят lint, любая попытка Number() на whitelist полях блокируется на этапе lint.
  </done>
</task>

</tasks>

<verification>
1. `pnpm lint` — 0 errors
2. `pnpm typecheck` — 0 errors
3. `pnpm test:e2e` — все sales-decimal, shifts-cash-reconciliation, motivation-precision зелёные
4. `grep -rE "Number\((sellPrice|costPrice|amount|total|finalAmount|discountAmount|openingCash|closingCash|expectedCash|discrepancy|prepaidAmount|purchasePrice|deliveryCost|estimatedCost|agreedCost|finalCost|bonus|commission|rate)" src/actions/sales.ts src/actions/shifts.ts src/actions/orders.ts src/actions/motivation-calculation.ts src/actions/repairs.ts` — 0 results
</verification>

<success_criteria>

- 5 hotspot-файлов используют Decimal helpers everywhere
- ESLint guard блокирует регрессии
- E2E precision тесты доказывают correctness на 1000+ операциях
- 0.1 + 0.2 в любом hotspot-файле даёт ровно 0.30
  </success_criteria>

<output>
Создать `.planning/phases/07-test-infrastructure-decimal-foundation/07-03-SUMMARY.md`.
</output>
</content>
</invoke>
