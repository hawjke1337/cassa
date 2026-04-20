# E2E Testing — Реальная БД

> Полное руководство по E2E-тестам ePRM на реальной PostgreSQL.
> Цель: любой разработчик (или Claude в новой сессии) пишет работающий тест за < 10 минут.

---

## Quick Start (< 10 минут)

### Предусловия

- PostgreSQL 17 запущен локально на `localhost:5432`
- Креды: `astore:astore_dev_2026` (см. `.env.test`)
- `pnpm install` выполнен

### Первый запуск

```bash
pnpm db:test:create     # создать БД astore_erp_test (idempotent)
pnpm test:e2e           # запустить все E2E тесты — должно быть 22+ зелёных
```

> Миграции **НЕ нужны**. Schema каждого worker создаётся на лету через `prisma db push` при старте теста (см. раздел [Архитектура](#архитектура)).

### Создание нового теста за 5 минут

**1. Скопировать шаблон:**

```bash
cp src/__tests__/e2e/_template.e2e.test.ts src/__tests__/e2e/моя-фича.e2e.test.ts
```

**2. Написать тест:**

```ts
import { describe, it, expect } from "vitest"
import { db } from "../helpers/db"
import {
  createTestStore,
  createTestUser,
  createTestProduct,
  createTestStoreProduct,
} from "../helpers/fixtures"

describe("Моя фича", () => {
  it("создаёт продажу с правильным итогом", async () => {
    // ARRANGE
    const store = await createTestStore()
    const user = await createTestUser({ storeId: store.id })
    const product = await createTestProduct()
    const sp = await createTestStoreProduct({
      productId: product.id,
      storeId: store.id,
      sellPrice: "1499.99",
      quantity: 10,
    })

    // ACT
    const fetched = await db.storeProduct.findUnique({ where: { id: sp.id } })

    // ASSERT
    expect(fetched?.sellPrice).toEqualDecimal("1499.99")
  })
})
```

**3. Запустить:**

```bash
pnpm test:e2e -- моя-фича
```

Готово. Тест зелёный — можно идти дальше.

---

## Архитектура

### Schema-per-worker изоляция

Каждый Vitest worker (`pool: 'forks'`) получает свой PostgreSQL schema:

- Worker 0 → `test_w0`
- Worker 1 → `test_w1`
- Worker N → `test_wN`

**Lifecycle (см. `src/__tests__/setup-db.ts`):**

1. **`beforeAll`** — `CREATE SCHEMA test_wN` + `prisma db push --url=...?options=-c search_path=test_wN` (генерирует DDL из `schema.prisma`).
2. **`beforeEach`** — `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` всех таблиц схемы через admin pg Pool.
3. **`afterAll`** — `DROP SCHEMA test_wN CASCADE` для cleanup.

Изоляция **полная** — параллельные тесты в разных worker'ах не пересекаются.

### TRUNCATE между тестами — не транзакционный rollback

`beforeEach` выполняет `TRUNCATE ... RESTART IDENTITY CASCADE` всех таблиц схемы. Каждый тест начинает с пустой БД.

Это **намеренно** не транзакционный rollback. Причины:

- Транзакционный rollback ломается на raw SQL, savepoints, DDL внутри тестируемого кода.
- ePRM использует raw SQL в `counters.ts`, `SELECT FOR UPDATE` в locking-логике — всё это **нужно** ловить в реальной БД.
- TRUNCATE даёт чистый snapshot без интерференции с production-кодом.

### PrismaPg `{ schema }` adapter option

Test client (`src/__tests__/helpers/db.ts`) использует:

```ts
new PrismaClient({
  adapter: new PrismaPg({ connectionString }, { schema: testSchema }),
})
```

Важно: `?schema=...` URL-параметр **игнорируется** PrismaPg. Только явный `{ schema }` адаптер option работает.

### `SET LOCAL search_path` в `$transaction`

Raw SQL (`$queryRaw`, `$executeRaw`) не auto-prefix-ится схемой. Внутри `$transaction` — стандартный `search_path` сбрасывается на `public`. Поэтому test `db` обёрнут Proxy'ем, который вставляет `SET LOCAL search_path TO "test_wN", public` первым statement в каждой транзакции.

`SET LOCAL` scope-ится только текущей tx — без leakage на pool.

> Тестам **не нужно** ничего знать про этот workaround — просто `import { db } from '../helpers/db'`.

---

## Команды

| Команда                      | Что делает                                |
| ---------------------------- | ----------------------------------------- |
| `pnpm test:e2e`              | Все E2E один прогон                       |
| `pnpm test:e2e:watch`        | Watch mode для E2E                        |
| `pnpm test:e2e -- имя-файла` | Запустить тесты, имя которых матчит       |
| `pnpm test:unit`             | Только unit-тесты (без БД, быстро)        |
| `pnpm test`                  | Все проекты (unit + e2e)                  |
| `pnpm db:test:create`        | Создать БД `astore_erp_test` (idempotent) |
| `pnpm db:test:migrate`       | `prisma migrate deploy` для test БД       |
| `pnpm typecheck`             | TypeScript check без эмиссии              |

---

## Fixtures

Все фабрики в `src/__tests__/helpers/fixtures.ts`. Они **идемпотентные** — каждый вызов создаёт уникальную запись через `Date.now() + counter`.

**Денежные поля принимаются как `string`** — это критично для precision:

```ts
const sp = await createTestStoreProduct({
  productId: product.id,
  storeId: store.id,
  sellPrice: "1499.99", // ← string, НЕ number!
  costPrice: "999.50",
  quantity: 10,
})
```

### Доступные фабрики

| Фабрика                                                                             | Возвращает     | Обязательные параметры                                      |
| ----------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| `createTestStore(overrides?)`                                                       | `Store`        | —                                                           |
| `createTestUser({ storeId? })`                                                      | `User`         | — (`storeId` опционален, создаёт `UserStore` link)          |
| `createTestCategory({ isSerialized? })`                                             | `Category`     | —                                                           |
| `createTestProduct({ categoryId? })`                                                | `Product`      | — (`categoryId` опционален — создаст одноразовую категорию) |
| `createTestStoreProduct({ productId, storeId, sellPrice?, costPrice?, quantity? })` | `StoreProduct` | `productId`, `storeId`                                      |

### Пример полного цикла

```ts
const store = await createTestStore()
const user = await createTestUser({ storeId: store.id })
const category = await createTestCategory({ isSerialized: false })
const product = await createTestProduct({ categoryId: category.id })
const sp = await createTestStoreProduct({
  productId: product.id,
  storeId: store.id,
  sellPrice: "1499.99",
  costPrice: "999.50",
  quantity: 10,
})
```

Если нужна модель которой нет в фабриках — создавайте напрямую через `db.<model>.create({ data: ... })`.

---

## Decimal в тестах

### Сравнение денежных полей — `toEqualDecimal`

Custom matcher из `src/__tests__/setup-decimal-matcher.ts` сравнивает через `Decimal.equals()` — корректно для всех форм одного и того же числа:

```ts
// ✅ ПРАВИЛЬНО
expect(sale.finalAmount).toEqualDecimal("1499.99")
expect(sale.finalAmount).toEqualDecimal("1499.990") // та же сумма
expect(commission).toEqualDecimal(sum(mul("1499.99", "0.005"), "0.01"))

// ❌ НЕПРАВИЛЬНО — структурное сравнение ломается на 0.30 vs 0.3
expect(sale.finalAmount).toEqual(new Prisma.Decimal("1499.99"))
```

### Арифметика — через `@/lib/money`

```ts
import { sum, sub, mul, div, toMoney } from "@/lib/money"

const subtotal = sum(mul("1499.99", 3), "0.01") // 4499.98
const expected = sub(subtotal, "100.00") // 4399.98
expect(actual.totalAmount).toEqualDecimal(expected)
```

**Никогда** не используйте `Number(decimalField)` — ESLint money-guard заблокирует на hotspot файлах. На чистый Decimal ↔ number boundary используйте `.toNumber()` метод.

См. полный API в `src/lib/money.ts`: `toMoney`, `sum`, `sub`, `mul`, `div`, `toClient`, `fromClient`, `isMoney`.

---

## Что НЕ делать

- **НЕ использовать `test.concurrent`** — внутри одного worker делит schema → race conditions в тестах
- **НЕ хардкодить даты в `new Date('2026-01-01')`** для current-time логики — используйте mocks или относительные даты
- **НЕ делать cleanup вручную** — TRUNCATE beforeEach делает это автоматически
- **НЕ импортировать `db` из `@/lib/db`** в e2e тестах — только из `helpers/db.ts` (test-scoped с правильным schema + tx wrapper)
- **НЕ использовать `Number()` на денежных полях** — ESLint заблокирует, используйте `@/lib/money` или `.toNumber()`
- **НЕ передавать `number` для денежных параметров фабрик** — только `string` (`sellPrice: '1499.99'`, не `1499.99`)

---

## Troubleshooting

| Симптом                                      | Решение                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `connection refused localhost:5432`          | Запустить PostgreSQL локально                                         |
| `database "astore_erp_test" does not exist`  | `pnpm db:test:create`                                                 |
| `relation "..." does not exist` в test logs  | Schema setup упал. Удалить `test_w*` вручную или перезапустить        |
| `schema "test_w0" already exists`            | Прошлый run упал на `afterAll`. `DROP SCHEMA test_w0 CASCADE` в psql  |
| `Cannot find module '@/lib/money'`           | `pnpm install` + `npx prisma generate`                                |
| Тест медленнее 500мс                         | Скорее всего лишние запросы — пересмотреть фикстуры                   |
| Flaky test между прогонами                   | Скорее всего global state или `test.concurrent` — оба запрещены       |
| `Counter table does not exist` в transaction | Используете `db` из `@/lib/db` вместо `helpers/db` — поправить import |
| `toEqualDecimal is not a function`           | Setup file не подгружен — проверить `vitest.config.ts` `setupFiles`   |

### Удалить все тестовые схемы вручную

```bash
psql postgresql://astore:astore_dev_2026@localhost:5432/astore_erp_test -c "
  DO \$\$
  DECLARE r record;
  BEGIN
    FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test_w%'
    LOOP
      EXECUTE 'DROP SCHEMA ' || quote_ident(r.schema_name) || ' CASCADE';
    END LOOP;
  END \$\$;
"
```

---

## CI

На каждый push GitHub Actions запускает E2E с `postgres:17-alpine` service:

- Workflow: `.github/workflows/ci.yml`
- Branch protection: `docs/CI-BRANCH-PROTECTION.md`
- Пайплайн: `lint` → `typecheck` → `test:unit` → `test:e2e`

Если CI красный — посмотрите logs job'а `test:e2e`. Чаще всего это:

1. Pre-existing flaky test (попробуйте перезапустить).
2. Кто-то добавил `test.concurrent` (запрещено — см. выше).
3. Реальный регрессионный баг — починить или откатить.

---

## Дальше

- **Шаблон для копирования:** `src/__tests__/e2e/_template.e2e.test.ts`
- **Эталон работающей инфраструктуры:** `src/__tests__/e2e/example.e2e.test.ts`
- **Реальные E2E:** `src/__tests__/e2e/sales-decimal.e2e.test.ts`, `motivation-precision.e2e.test.ts`, `shifts-cash-reconciliation.e2e.test.ts`
- **Helpers:** `src/__tests__/helpers/`
- **Money helpers:** `src/lib/money.ts` + `src/lib/money.test.ts`
- **Index тестов:** `src/__tests__/README.md`
