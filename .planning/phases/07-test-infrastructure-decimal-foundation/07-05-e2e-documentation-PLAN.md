---
phase: 07-test-infrastructure-decimal-foundation
plan: 05
type: execute
wave: 3
depends_on: ["07-01", "07-02", "07-03", "07-04"]
files_modified:
  - src/__tests__/README.md
  - docs/E2E-TESTING.md
  - src/__tests__/e2e/_template.e2e.test.ts
autonomous: false
requirements: [TEST2-01, TEST2-02]
must_haves:
  truths:
    - "Новый разработчик читает docs/E2E-TESTING.md и создаёт работающий E2E тест за < 10 минут"
    - "Шаблон `_template.e2e.test.ts` копируется как стартовая точка"
    - "README объясняет: команды, structure, fixtures, troubleshooting"
  artifacts:
    - path: docs/E2E-TESTING.md
      provides: "Quick Start, паттерн, примеры, FAQ"
      contains: "## Quick Start"
    - path: src/__tests__/README.md
      provides: "Index тестов и команды"
    - path: src/__tests__/e2e/_template.e2e.test.ts
      provides: "Копируемый шаблон с комментариями"
  key_links:
    - from: docs/E2E-TESTING.md
      to: src/__tests__/e2e/_template.e2e.test.ts
      via: "ссылка на template"
      pattern: "_template.e2e.test.ts"
    - from: docs/E2E-TESTING.md
      to: src/__tests__/helpers/fixtures.ts
      via: "примеры использования fixtures"
      pattern: "createTestStore"
---

<objective>
Документировать E2E test framework чтобы любой новый разработчик (или Claude в новой сессии) мог создать тест на реальной БД за < 10 минут. Без этого Phase 8-16 не смогут эффективно использовать инфраструктуру из Plan 01.

Purpose: Без документации даже отличная инфраструктура не используется. Шаблон + README + Quick Start превращают паттерн в норму.
Output: docs/E2E-TESTING.md + README + копируемый template.
</objective>

<execution_context>
@/Users/pushkarev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pushkarev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md
@src/__tests__/setup-db.ts
@src/__tests__/helpers/db.ts
@src/__tests__/helpers/fixtures.ts
@src/__tests__/e2e/example.e2e.test.ts
@src/lib/money.ts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Создать docs/E2E-TESTING.md (Quick Start + полное руководство)</name>
  <files>docs/E2E-TESTING.md</files>
  <read_first>
    - src/__tests__/setup-db.ts (Plan 01 result)
    - src/__tests__/helpers/db.ts
    - src/__tests__/helpers/fixtures.ts
    - src/__tests__/e2e/example.e2e.test.ts
    - src/lib/money.ts (для секции про Decimal в тестах)
    - package.json (актуальные scripts)
  </read_first>
  <action>
    Создать `docs/E2E-TESTING.md` (на русском, ~250-350 строк) со следующей структурой:

    ```markdown
    # E2E Testing — Реальная БД

    ## Quick Start (< 10 минут)

    ### Предусловия
    - PostgreSQL запущен локально на `localhost:5432`
    - Креды: `astore:astore_dev_2026`

    ### Первый запуск
    ```bash
    pnpm db:test:create     # создать БД astore_erp_test
    pnpm db:test:migrate    # применить миграции
    pnpm test:e2e           # запустить все E2E тесты
    ```

    ### Создание нового теста за 5 минут

    1. Скопировать шаблон:
    ```bash
    cp src/__tests__/e2e/_template.e2e.test.ts src/__tests__/e2e/мой-кейс.e2e.test.ts
    ```

    2. Написать тест:
    ```ts
    import { describe, it, expect } from 'vitest'
    import { db } from '../helpers/db'
    import { createTestStore, createTestUser, createTestProduct, createTestStoreProduct } from '../helpers/fixtures'

    describe('Мой кейс', () => {
      it('создаёт продажу с правильным итогом', async () => {
        const store = await createTestStore()
        const user = await createTestUser({ storeId: store.id })
        // ... ваш тест
        expect(...).toEqualDecimal('1499.99')
      })
    })
    ```

    3. Запустить:
    ```bash
    pnpm test:e2e -- мой-кейс
    ```

    Готово.

    ## Архитектура

    ### Schema-per-worker изоляция
    Каждый Vitest worker (`forks` pool) получает свой Postgres schema:
    - Worker 0 → `test_w0`
    - Worker 1 → `test_w1`
    - и т.д.

    Schema создаётся в `beforeAll`, мигрируется через `prisma migrate deploy`, удаляется в `afterAll`.

    ### TRUNCATE между тестами
    `beforeEach` выполняет `TRUNCATE ... RESTART IDENTITY CASCADE` всех таблиц схемы. Каждый тест начинает с пустой БД.

    Это **не** транзакционный rollback — он работает с raw SQL, savepoints и DDL, что критично для нашего паттерна "ловить raw SQL баги".

    ## Команды

    | Команда | Что делает |
    |---------|-----------|
    | `pnpm test:e2e` | Все E2E один прогон |
    | `pnpm test:e2e:watch` | Watch mode |
    | `pnpm test:e2e -- имя-файла` | Запустить конкретный тест |
    | `pnpm test:unit` | Только unit (без БД) |
    | `pnpm test` | Всё подряд |
    | `pnpm db:test:create` | Создать БД (idempotent) |
    | `pnpm db:test:migrate` | Применить миграции |

    ## Fixtures

    Все фикстуры в `src/__tests__/helpers/fixtures.ts`. Денежные поля принимаются как **string**:

    ```ts
    const sp = await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: '1499.99',  // string, не number!
      costPrice: '999.50',
      quantity: 10,
    })
    ```

    Доступные:
    - `createTestStore(overrides?)` → Store
    - `createTestUser({ storeId })` → User (с bcrypt password)
    - `createTestCategory({ isSerialized? })` → Category
    - `createTestProduct({ categoryId })` → Product
    - `createTestStoreProduct({ productId, storeId, sellPrice, ... })` → StoreProduct

    ## Decimal в тестах

    Денежные сравнения — через custom matcher `toEqualDecimal`:

    ```ts
    // ✅ ПРАВИЛЬНО
    expect(sale.finalAmount).toEqualDecimal('1499.99')

    // ❌ НЕПРАВИЛЬНО (структурное сравнение ломается на 0.30 vs 0.3)
    expect(sale.finalAmount).toEqual(new Prisma.Decimal('1499.99'))
    ```

    Арифметика в тестах — через хелперы `src/lib/money.ts`:
    ```ts
    import { sum, mul, sub } from '@/lib/money'
    const expected = sum(mul('1499.99', 3), '0.01')
    expect(actual).toEqualDecimal(expected)
    ```

    ## Что НЕ делать

    - **НЕ использовать `test.concurrent`** — внутри одного worker делит schema → race conditions в тестах
    - **НЕ хардкодить даты в `new Date('2026-01-01')`** для current-time логики — используйте mocks или относительные даты
    - **НЕ делать cleanup вручную** — TRUNCATE beforeEach делает это автоматически
    - **НЕ импортировать `db` из `@/lib/db`** в e2e тестах — только из `helpers/db.ts` (тестовый scope)
    - **НЕ использовать `Number()` на денежных полях** — ESLint заблокирует, используйте `money.ts`

    ## Troubleshooting

    | Симптом | Решение |
    |---------|---------|
    | `connection refused localhost:5432` | Запустить Postgres локально |
    | `database "astore_erp_test" does not exist` | `pnpm db:test:create` |
    | `relation "..." does not exist` | `pnpm db:test:migrate` |
    | `schema "test_w0" already exists` | Прошлый run упал. Удалить вручную или добавить `DROP SCHEMA IF EXISTS` в setup |
    | Тест медленнее 500мс | Скорее всего лишние запросы — пересмотреть фикстуры |
    | Flaky test между прогонами | Скорее всего использовали global state или test.concurrent |

    ## CI

    На каждый push GitHub Actions запускает E2E с `postgres:17-alpine` service. См. `.github/workflows/ci.yml` и `docs/CI-BRANCH-PROTECTION.md`.

    ## Дальше

    - Шаблон: `src/__tests__/e2e/_template.e2e.test.ts`
    - Эталон: `src/__tests__/e2e/example.e2e.test.ts`
    - Хелперы: `src/__tests__/helpers/`
    ```

  </action>
  <verify>
    <automated>cd astore-erp && test -f docs/E2E-TESTING.md && grep -q "## Quick Start" docs/E2E-TESTING.md && grep -q "createTestStore" docs/E2E-TESTING.md && grep -q "toEqualDecimal" docs/E2E-TESTING.md && grep -q "_template.e2e.test.ts" docs/E2E-TESTING.md && grep -q "TRUNCATE" docs/E2E-TESTING.md</automated>
  </verify>
  <acceptance_criteria>
    - `docs/E2E-TESTING.md` exists
    - Contains literal `## Quick Start`
    - Contains literal `createTestStore`, `toEqualDecimal`, `_template.e2e.test.ts`, `TRUNCATE`, `pnpm test:e2e`, `schema-per-worker` (or "test_w0")
    - Contains таблицу команд (markdown table)
    - Contains раздел Troubleshooting
    - Documentation на русском языке
  </acceptance_criteria>
  <done>
    Документация созданa, покрывает Quick Start, архитектуру, fixtures, Decimal, troubleshooting.
  </done>
</task>

<task type="auto">
  <name>Task 2: Создать копируемый template _template.e2e.test.ts + src/__tests__/README.md</name>
  <files>src/__tests__/e2e/_template.e2e.test.ts, src/__tests__/README.md</files>
  <read_first>
    - src/__tests__/e2e/example.e2e.test.ts (для согласованности)
    - src/__tests__/helpers/fixtures.ts
    - docs/E2E-TESTING.md (Task 1 result)
  </read_first>
  <action>
    1. **Создать `src/__tests__/e2e/_template.e2e.test.ts`** (~50 строк, обильно комментированный):

    ```ts
    /**
     * E2E TEST TEMPLATE — реальная БД
     *
     * Скопируйте этот файл и переименуйте: cp _template.e2e.test.ts моя-фича.e2e.test.ts
     *
     * Полное руководство: docs/E2E-TESTING.md
     */

    import { describe, it, expect, beforeEach } from 'vitest'
    import { db } from '../helpers/db'
    import {
      createTestStore,
      createTestUser,
      createTestProduct,
      createTestStoreProduct,
    } from '../helpers/fixtures'

    describe('Моя фича', () => {
      // ОПЦИОНАЛЬНО: общий setup для всех тестов в describe.
      // ВНИМАНИЕ: TRUNCATE происходит в глобальном beforeEach из setup-db.ts,
      // так что данные ВСЕГДА чистые в начале каждого it().
      // Используйте этот блок только если нужны общие фикстуры — но обычно
      // лучше создавать их прямо в it() для ясности.

      it('делает что-то и проверяет результат', async () => {
        // 1. ARRANGE — создать данные
        const store = await createTestStore()
        const user = await createTestUser({ storeId: store.id })
        const category = await db.category.create({
          data: { name: 'Тест-категория', isSerialized: false },
        })
        const product = await createTestProduct({ categoryId: category.id })
        const sp = await createTestStoreProduct({
          productId: product.id,
          storeId: store.id,
          sellPrice: '1499.99',
          costPrice: '999.50',
          quantity: 10,
        })

        // 2. ACT — выполнить тестируемое действие
        // (например: вызвать server action или сделать прямой db query)
        const result = await db.storeProduct.findUnique({ where: { id: sp.id } })

        // 3. ASSERT — проверить результат
        expect(result).not.toBeNull()
        expect(result?.quantity).toBe(10)
        expect(result?.sellPrice).toEqualDecimal('1499.99')  // ← matcher из Plan 02
      })

      it('второй тест начинается с чистой БД (TRUNCATE автоматический)', async () => {
        const count = await db.store.count()
        expect(count).toBe(0)  // даже если предыдущий тест создал store
      })
    })
    ```

    2. **Создать `src/__tests__/README.md`** (~80 строк):

    ```markdown
    # src/__tests__/

    ## Структура

    - `e2e/` — E2E тесты на реальной БД (PostgreSQL)
      - `*.e2e.test.ts` — обычные тесты
      - `_template.e2e.test.ts` — копируемый шаблон
      - `example.e2e.test.ts` — эталон работающей инфраструктуры
    - `helpers/` — разделяемые хелперы
      - `db.ts` — Test-scoped Prisma client
      - `fixtures.ts` — Идемпотентные фикстуры (createTestStore, etc.)
    - `setup-db.ts` — Global setup: schema-per-worker, TRUNCATE beforeEach
    - `setup-decimal-matcher.ts` — Custom matcher toEqualDecimal

    Старые integration тесты (`*-integration.test.ts`) — мигрируются на E2E pattern постепенно в фазах 8-16.

    ## Запуск

    ```bash
    pnpm test:e2e               # все E2E
    pnpm test:e2e -- имя        # конкретный
    pnpm test:e2e:watch         # watch
    pnpm test:unit              # unit без БД
    ```

    ## Полное руководство

    См. `docs/E2E-TESTING.md`.

    ## Создание нового теста

    1. `cp src/__tests__/e2e/_template.e2e.test.ts src/__tests__/e2e/моё-имя.e2e.test.ts`
    2. Отредактировать
    3. `pnpm test:e2e -- моё-имя`
    ```

    3. Запустить `pnpm test:e2e -- _template` — шаблон должен пройти как реальный тест (доказательство что он работающий, не псевдокод).

  </action>
  <verify>
    <automated>cd astore-erp && test -f src/__tests__/e2e/_template.e2e.test.ts && test -f src/__tests__/README.md && grep -q "createTestStore" src/__tests__/e2e/_template.e2e.test.ts && grep -q "toEqualDecimal" src/__tests__/e2e/_template.e2e.test.ts && grep -q "docs/E2E-TESTING.md" src/__tests__/README.md && pnpm test:e2e -- _template</automated>
  </verify>
  <acceptance_criteria>
    - `src/__tests__/e2e/_template.e2e.test.ts` exists
    - Template contains literal `createTestStore`, `toEqualDecimal`, `ARRANGE`, `ACT`, `ASSERT`
    - Template содержит как минимум 2 `it(` блока
    - `src/__tests__/README.md` exists и содержит литералы `e2e/`, `helpers/`, `docs/E2E-TESTING.md`
    - `pnpm test:e2e -- _template` exits 0 (шаблон сам по себе — рабочий тест)
  </acceptance_criteria>
  <done>
    Шаблон работает как настоящий тест, README объясняет структуру, разработчик может скопировать шаблон и стартовать.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: < 10-минут проверка onboarding</name>
  <what-built>
    - `docs/E2E-TESTING.md` — полное руководство
    - `src/__tests__/README.md` — index
    - `src/__tests__/e2e/_template.e2e.test.ts` — копируемый шаблон
  </what-built>
  <how-to-verify>
    Симулировать новый разработчика. Запустить таймер на 10 минут. Не открывая никакой документации до этого момента:

    1. Открыть `docs/E2E-TESTING.md`
    2. Прочитать раздел Quick Start
    3. Скопировать шаблон: `cp src/__tests__/e2e/_template.e2e.test.ts src/__tests__/e2e/checkpoint-verify.e2e.test.ts`
    4. Изменить тест: например, проверить что `createTestStoreProduct` с `quantity: 5` сохраняет `quantity === 5`
    5. Запустить: `pnpm test:e2e -- checkpoint-verify`
    6. Убедиться что тест зелёный

    **Критерий успеха:** все 6 шагов сделаны за < 10 минут БЕЗ открытия исходников helpers/fixtures.ts (только README + Quick Start).

    После проверки удалить временный файл: `rm src/__tests__/e2e/checkpoint-verify.e2e.test.ts`

    Если затратили > 10 минут — обновить документацию (что было непонятно) и повторить.

  </how-to-verify>
  <resume-signal>Введите "approved" если onboarding < 10 минут, или опишите что было непонятно для улучшения docs.</resume-signal>
</task>

</tasks>

<verification>
1. `pnpm test:e2e -- _template` — зелёный
2. `pnpm test:e2e -- example` — зелёный
3. Quick Start проверен таймером
</verification>

<success_criteria>

- Документация полная и работающая
- Шаблон копируется и сразу запускается
- < 10-минут onboarding доказан
  </success_criteria>

<output>
Создать `.planning/phases/07-test-infrastructure-decimal-foundation/07-05-SUMMARY.md`.
</output>
</content>
</invoke>
