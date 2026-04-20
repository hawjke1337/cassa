# src/\_\_tests\_\_/

Index тестовой инфраструктуры ePRM. Полное руководство по E2E — в [`docs/E2E-TESTING.md`](../../docs/E2E-TESTING.md).

## Структура

```
src/__tests__/
├── e2e/                          # E2E тесты на реальной PostgreSQL
│   ├── _template.e2e.test.ts     # ← КОПИРУЕМЫЙ ШАБЛОН
│   ├── example.e2e.test.ts       # Эталон работающей инфраструктуры
│   ├── sales-decimal.e2e.test.ts # Реальные precision-тесты
│   ├── shifts-cash-reconciliation.e2e.test.ts
│   └── motivation-precision.e2e.test.ts
├── helpers/
│   ├── db.ts                     # Test-scoped Prisma client (схема + tx wrapper)
│   └── fixtures.ts               # createTestStore/User/Category/Product/StoreProduct
├── setup-db.ts                   # Schema-per-worker lifecycle (CREATE → push → TRUNCATE → DROP)
├── setup-decimal-matcher.ts      # toEqualDecimal custom matcher
└── README.md                     # ← вы здесь
```

> Старые integration-тесты (`src/**/*-integration.test.ts`) — мигрируются на E2E pattern постепенно в фазах 8–16.

## Запуск

```bash
pnpm test:e2e               # все E2E (реальная БД)
pnpm test:e2e -- имя        # запустить конкретный (по имени файла)
pnpm test:e2e:watch         # watch mode для E2E
pnpm test:unit              # unit-тесты, без БД, быстро
pnpm test                   # всё подряд
```

**Первый запуск:**

```bash
pnpm db:test:create     # создать БД astore_erp_test (idempotent)
pnpm test:e2e
```

## Создание нового теста (за < 5 минут)

1. Скопировать шаблон:
   ```bash
   cp src/__tests__/e2e/_template.e2e.test.ts src/__tests__/e2e/моё-имя.e2e.test.ts
   ```
2. Отредактировать `describe` / `it` блоки под свою фичу.
3. Запустить:
   ```bash
   pnpm test:e2e -- моё-имя
   ```

## Полное руководство

См. [`docs/E2E-TESTING.md`](../../docs/E2E-TESTING.md):

- Quick Start (< 10 минут)
- Архитектура (schema-per-worker, TRUNCATE, PrismaPg)
- Fixtures API
- Decimal в тестах + `toEqualDecimal`
- Что НЕ делать
- Troubleshooting

## Money helpers

Денежная арифметика — только через [`src/lib/money.ts`](../lib/money.ts):

```ts
import { sum, sub, mul, div, toMoney } from "@/lib/money"
```

ESLint money-guard блокирует `Number(decimalField)` на hotspot файлах.
