# Phase 7: Test Infrastructure & Decimal Foundation - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Multi-agent research synthesis (без интерактивного интервью — пользователь делегировал техническое решение)

<domain>
## Phase Boundary

Создать фундамент для всего milestone v1.1: (1) единый паттерн E2E тестов на реальной БД с автоматической изоляцией, фикстурами и CI, (2) перевод денежных расчётов с `Number(...)` на точную арифметику через `Prisma.Decimal`. Не реализуем бизнес-логику фаз 8-16 — только инфраструктуру и миграцию hotspot-файлов.

**В скоупе:**

- E2E test framework с schema-per-worker изоляцией
- GitHub Actions CI pipeline (lint, unit, e2e)
- `src/lib/money.ts` — типизированные хелперы для Decimal-арифметики
- ESLint guard против `Number()` на денежных полях
- Миграция 5 hotspot-файлов: `sales.ts`, `shifts.ts`, `orders.ts`, `motivation-calculation.ts`, payments
- Документация: шаблон E2E теста + README для разработчика

**Не в скоупе (отложено в Phase 8-16 по мере касания):**

- Миграция остальных 36 файлов с `Number()` (`reports.ts`, `inventory.ts`, `trade-in.ts`, `repairs.ts`, компонентов и т.д.)
- Реальные бизнес-фиксы (FIN-_, LOCK-_, REP-\* и т.д.)
- Coverage thresholds в CI (избыточно для маленькой команды на старте)

</domain>

<decisions>
## Implementation Decisions

### Decimal arithmetic strategy

**Выбор библиотеки: `Prisma.Decimal` напрямую**

- Использовать `Prisma.Decimal` (ре-экспорт `decimal.js-light` из `@prisma/client`)
- НЕ добавлять отдельный `decimal.js` — дублирование бандла + риск двух несовместимых классов (`instanceof` ломается)
- НЕ переходить на integer-копейки — ломается на мотивационных формулах с процентами (`0.5%` от `1499.99` → дробь), и schema уже в `Decimal(12,2)`

**Сериализация Server Actions → Client: `string` на границе**

- Все Server Actions конвертируют `Prisma.Decimal` → `string` через `.toFixed(2)` перед возвратом
- Branded TypeScript тип: `type Money = string & { __brand: 'Money' }` — TS не даст случайно сделать `price * quantity` на клиенте
- Клиент форматирует через `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`, никакой арифметики на клиенте
- НЕ использовать `superjson` — добавляет runtime-обёртку и плохо дружит с Server Actions в Next.js 16

**Helper модуль: `src/lib/money.ts`**
Экспорты:

- `toMoney(input: Decimal | string | number): Decimal`
- `sum(...values: Decimal[]): Decimal`
- `mul(a: Decimal, b: Decimal | number): Decimal`
- `sub(a: Decimal, b: Decimal): Decimal`
- `div(a: Decimal, b: Decimal | number): Decimal`
- `toClient(value: Decimal): Money` — `.toFixed(2)` + brand
- `fromClient(value: Money): Decimal` — для редких случаев чтения формы

**Migration strategy: гибридная (постепенная, но с hard boundary)**

- Phase 7 мигрирует 5 hotspot-файлов: `sales.ts` (52 calls), `shifts.ts` (35), `orders.ts` (29), `motivation-calculation.ts` (13), `repairs.ts` (9) — критичные для денег
- Остальные 36 файлов — по мере касания в фазах 8-16
- ESLint правило `no-restricted-syntax` блокирует `Number(` на whitelist денежных полей (`sellPrice`, `costPrice`, `total`, `amount`, `discount`, `bonus`, `commission`, `finalAmount`, `prepaidAmount`, `*Cash`, ...) — гарантия что новый код не деградирует
- Big-bang refactor 284 calls за один PR — отклонён (нет ревью, гарантированные регрессии)

### Test database lifecycle

**Изоляция: schema-per-worker + TRUNCATE beforeEach**

- Отдельная БД `astore_erp_test` (НЕ dev `astore_erp`)
- Каждый Vitest worker получает свой Postgres schema (`test_w0`, `test_w1`, ...) через `search_path`
- `TRUNCATE ... RESTART IDENTITY CASCADE` перед каждым тестом — порядок FK решает CASCADE
- НЕ transaction-rollback (ломается с raw SQL, savepoints, DDL — критично для нашего паттерна "ловить raw SQL баги")
- НЕ Testcontainers (5-15с cold start = плохой DX для TDD)

**Параллелизм: включён, через `process.env.VITEST_POOL_ID`**

- `vitest.config.ts`: `pool: 'forks'`, `singleFork: false`, `setupFiles: ['./src/__tests__/setup-db.ts']`
- Имя schema генерится как `test_w${process.env.VITEST_POOL_ID}` — встроенная переменная Vitest
- НЕ использовать `test.concurrent` внутри файла — делит schema одного worker

**Шаблон теста для разработчика (<10 минут на onboarding)**

- Два файла-хелпера в `src/__tests__/helpers/db.ts` и `src/__tests__/setup-db.ts` (~60 строк)
- Разработчик пишет: `import { db } from './helpers/db'` → `test('...', async () => { await db.order.create(...) })` — никакого `createdIds`, никакого cleanup
- README с одним примером и командами `pnpm test:e2e`, `pnpm test:e2e --watch`

**Целевая скорость DX**

- Простой E2E тест: 30-80мс
- Средний (5-10 запросов): 100-300мс
- Suite 100 тестов на 4 воркерах: 15-40с
- Cold start (migrate deploy × N): 3-8с
- Если тест > 500мс — это проблема теста, не инфраструктуры

**Очистка существующего паттерна**

- `src/__tests__/e2e-real-db.test.ts` — переписать на новый pattern, удалить `createdIds[]` boilerplate
- `confirm-receive-integration.test.ts`, `create-sale-integration.test.ts`, `create-return-integration.test.ts` — постепенно мигрировать на новый pattern

### CI pipeline (GitHub Actions)

**3 параллельных job в `.github/workflows/ci.yml`:**

1. **lint** (`Lint & Typecheck`) — eslint + `tsc --noEmit`, ~1-2 мин
2. **unit** (`Unit Tests`) — `vitest run --project unit`, ~1-2 мин
3. **e2e** (`E2E Tests`) — Postgres 17 service container + `prisma migrate deploy` + `prisma db seed` + `vitest run --project e2e`, ~5-8 мин

**Postgres service:**

- `postgres:17-alpine` (GA, alpine ~40MB)
- `POSTGRES_DB=astore_erp_test`, `POSTGRES_USER=astore`, `POSTGRES_PASSWORD=astore_ci`
- Health-check `pg_isready`
- `DATABASE_URL` — hardcoded в `env:` workflow (НЕ секрет — эфемерная БД, живёт минуты)

**Branch protection (Settings → Branches для `main`):**

- Все 3 checks required
- Require PR review (1 approver)
- Require branches up to date
- Dismiss stale approvals
- Coverage threshold НЕ настраиваем (избыточно для команды <3 человек, замедляет feedback loop, добавим позже)

**Кеширование:**

- pnpm store — `actions/setup-node@v5` с `cache: 'pnpm'` (автоматически по `pnpm-lock.yaml`)
- Next.js `.next/cache` — только в e2e job, ключ = `pnpm-lock.yaml` + хэш исходников + restore-keys
- Prisma client — НЕ кэшируем (`prisma generate` ~3с, кэш создаёт больше проблем)
- `node_modules` — НЕ кэшируем (pnpm hardlinks быстрее)

**Concurrency:** `cancel-in-progress: true` для отмены устаревших runs при новом push в PR.

**Версии actions (актуально на апрель 2026):**

- `actions/checkout@v5`, `actions/setup-node@v5`, `actions/cache@v4`, `actions/upload-artifact@v4`
- `pnpm/action-setup@v4` (pnpm 9.x)
- `ubuntu-24.04` (explicit, не `latest`)

**Дополнения в `package.json`:**

- Скрипты: `lint`, `typecheck`, `test:unit`, `test:e2e`, `test` (всё)
- `prisma.seed`: `tsx prisma/seed.ts` (должен быть идемпотентным через `upsert`)

### Documentation & onboarding

- `src/__tests__/README.md` — паттерн E2E теста, команды, troubleshooting
- `src/lib/money.ts` — JSDoc на каждую функцию + примеры
- Запись в `Obsidian Mind/Decisions/Лог решений.md` — Decision 22 (Decimal strategy) и Decision 23 (E2E lifecycle)
- Обновить `Obsidian Mind/Projects/ePRM — Касса и учёт.md` — пометка что Phase 7 в работе

### Vitest tests for Decimal

**Pattern для Decimal-сравнений:**

```ts
expect(result.equals(new Prisma.Decimal("0.30"))).toBe(true)
```

- НЕ использовать `.toEqual(new Decimal('0.30'))` — структурное сравнение ломается на `0.30` vs `0.3`
- Создать кастомный matcher в `vitest.setup.ts`:

```ts
expect.extend({
  toEqualDecimal(received, expected) {
    const exp = new Prisma.Decimal(expected)
    return {
      pass: received.equals(exp),
      message: () => `expected ${received} to equal ${exp}`,
    }
  },
})
```

### Claude's Discretion

- Точные имена файлов хелперов (`db.ts` vs `prisma.ts` vs `test-db.ts`)
- Конкретный набор exports в `lib/money.ts` (можно дополнить по ходу)
- Имена ESLint правил и whitelist полей — расширять по мере обнаружения
- Структура `vitest.config.ts` projects (unit vs e2e разделение)
- Точные ID и данные в seed.ts для тестов
- Формат сообщений в CI badges, если добавляются

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning

- `.planning/ROADMAP.md` §"Phase 7" — Goal, Success Criteria, Requirements
- `.planning/REQUIREMENTS.md` §"E2E Testing (TEST2)" — TEST2-01, TEST2-02, TEST2-03
- `.planning/REQUIREMENTS.md` §"Data Integrity 2 (DATA2)" — DATA2-02 (Decimal.js requirement)
- `.planning/STATE.md` — текущий статус v1.1

### Existing test infrastructure

- `src/__tests__/e2e-real-db.test.ts` — текущий паттерн с PrismaPg adapter и `createdIds[]` cleanup (нужно переписать)
- `src/__tests__/confirm-receive-integration.test.ts` — интеграционный тест (для миграции на новый pattern)
- `src/__tests__/create-sale-integration.test.ts` — интеграционный тест (для миграции)
- `src/__tests__/create-return-integration.test.ts` — интеграционный тест (для миграции)
- `vitest.config.ts` — текущая конфигурация (минимальная)

### Decimal hotspot files (priority migration in Phase 7)

- `src/actions/sales.ts` — 52 `Number()` calls, returns Sale с 5 Decimal полями
- `src/actions/shifts.ts` — 35 calls, **критично**: cash reconciliation формула (lines 35-41, 5 операций в одной формуле — risk audit failure)
- `src/actions/orders.ts` — 29 calls, returns CustomOrder с totalAmount/prepaidAmount/finalAmount
- `src/actions/motivation-calculation.ts` — 13 calls, мотивационные формулы с процентами
- `src/actions/repairs.ts` — 9 calls

### Schema (43 Decimal fields)

- `prisma/schema.prisma` — все поля с `@db.Decimal(12, 2)`. Группировка: Sale(5), SaleItem(4), Payment(1), Return(1), StoreProduct(2), PriceHistory(2), CustomOrder(5), CustomOrderItem(2), Repair(3), StockReceive(1), StockReceiveItem(1), StockWriteOffItem(1), SupplierDebt(1), TradeIn(2), Shift(4), Payroll(5), CashOperation(1)

### Existing utilities (минимальные)

- `src/lib/format.ts` — `formatMoney()` принимает `number` (нужно расширить для `Decimal | Money`)
- НЕТ `src/lib/money.ts` / `decimal.ts` / `calc.ts` — создаём в Phase 7

### Lessons from prior phases

- `Obsidian Mind/Decisions/Урок — Raw SQL и тестирование.md` — почему raw SQL обходит Prisma и моки бесполезны (обоснование E2E на реальной БД)
- `Obsidian Mind/Decisions/Лог решений.md` — лог архитектурных решений
- `~/.claude/projects/-Users-pushkarev-PROD-astore-shop/memory/feedback_raw_sql_testing.md` — правило тестирования
- `.planning/phases/05-infrastruktura/05-VALIDATION.md` — отчёт о текущем тестовом состоянии (153 теста на момент завершения v1.0)

### Configuration

- `package.json` — текущие скрипты (`dev`, `build`, `start`, `lint`), нужны: `typecheck`, `test`, `test:unit`, `test:e2e`, `prisma.seed`
- НЕТ `.github/workflows/` — создаём `ci.yml` с нуля

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **PrismaPg adapter pattern** (`@prisma/adapter-pg`): уже работает в `e2e-real-db.test.ts`, оставляем — нужен только для подключения через connection string
- **Vitest 4.1.2**: конфигурация минимальная (`vitest.config.ts`), есть алиас `@/`, environment node — расширяем `setupFiles` и `pool`
- **Prisma 7.4.2 schema** (`@db.Decimal(12, 2)`): фундамент уже готов — точность хранится в Postgres, проблема только в TS-runtime
- **`Prisma.Decimal` класс**: уже импортируется через `@prisma/client`, не нужно ничего ставить
- **`src/lib/format.ts`**: функция `formatMoney()` — расширяем на `Decimal | Money | number` input
- **27 существующих test файлов**: бóльшая часть на моках — оставляем, мигрируем только integration/e2e файлы

### Established Patterns

- **Server Actions с Number() конвертацией**: антипаттерн, но широко используется (284 места) — нужно lint-gate
- **Hardcoded ID в seed**: `seed-store-central`, `cmmjd65am00004s9kqn1rboug` (admin) — оставляем подход, переносим в `astore_erp_test`
- **Try/catch cleanup в `afterAll`**: текущий хрупкий pattern — заменяем на TRUNCATE CASCADE
- **PnPm workspace**: один проект, lockfile в корне `astore-erp/`

### Integration Points

- `vitest.config.ts` — добавляем `pool: 'forks'`, `setupFiles`, optionally `projects` для разделения unit/e2e
- `package.json` — добавляем скрипты + `prisma.seed`
- `.github/workflows/ci.yml` — создаём с нуля
- `prisma/seed.ts` — должен стать идемпотентным (upsert)
- `eslint.config.*` — добавляем `no-restricted-syntax` правило с whitelist полей
- `src/lib/money.ts` — новый файл, импортируется из всех `src/actions/*.ts`
- `tsconfig.json` — возможно нужно `"strict": true` если ещё не включено (проверить)

### Risk Hotspots (приоритет в Phase 7)

- **`src/actions/shifts.ts:35-41`**: cash reconciliation — 5 операций в одной формуле, потеря копейки = audit failure
- **`src/actions/sales.ts`**: 52 `Number()` calls, `createSale()` возвращает 5 Decimal полей через Number() — серийный production endpoint
- **`src/actions/motivation-calculation.ts`**: формулы с процентами (BUG-078) — float-погрешность = неправильная ЗП

### Scope Numbers (для планирования)

- 284 `Number()` calls в 41 файле
- 161 в `src/actions/` (57%), 76 в `src/app/` (27%), 41 в `src/components/` (14%)
- 18 Server Actions — serialization boundaries
- 43 Decimal-полей в schema — все остаются как есть
- ~15-20 arithmetic sites нуждаются в миграции в Phase 7

</code_context>

<specifics>
## Specific Ideas

- Пользователь делегировал техническое решение — никаких ручных интервью. Multi-agent research → синтез → CONTEXT.md.
- Стиль кодирования: production-grade (НЕ MVP), TDD обязательно, security review для критичного кода
- Подход: гибрид big-bang + постепенно — инфраструктура + 5 hotspot-файлов сейчас, остальное по фазам
- Lint-gate как механизм защиты от деградации — критично для долгого milestone (10 фаз)
- **Принцип:** "если новый код может писать `Number(price)` — мы проиграли через 6 месяцев"
- Документация в Obsidian Mind обязательна (правило проекта)

</specifics>

<deferred>
## Deferred Ideas

- **Coverage threshold в CI** — добавить когда команда > 3 человек или когда будет конкретная цель (например, "actions/ ≥ 80%")
- **Testcontainers** — рассмотреть для CI если schema-per-worker окажется flaky на GitHub Actions (Plan B)
- **superjson для Server Actions** — рассмотреть в Phase 16 если ручная сериализация Decimal станет болью (сейчас branded type решает)
- **Миграция оставшихся 36 файлов с `Number()`** — постепенно в фазах 8-16 по мере касания
- **`reports.ts` миграция** (23 calls) — Phase 10 (Reports Correctness & Banking Fees) — там и так трогается
- **`inventory.ts` миграция** (17 calls) — Phase 16 (Inventory Edge Cases)
- **`trade-in.ts` миграция** (9 calls) — Phase 11 (Repair as Sale) — там трогается
- **Performance benchmarks** для E2E suite — добавить в Phase 16 если станет медленно
- **Visual regression testing** — отдельный milestone, не v1.1
- **Real-time CI feedback в IDE** — VS Code extension, vNext

</deferred>

---

_Phase: 07-test-infrastructure-decimal-foundation_
_Context gathered: 2026-04-08_
_Method: Multi-agent research synthesis (4 parallel agents: Decimal strategy, E2E lifecycle, CI pipeline, Codebase audit)_
