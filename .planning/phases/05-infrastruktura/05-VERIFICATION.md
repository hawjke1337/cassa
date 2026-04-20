---
phase: 05-infrastruktura
verified: 2026-04-05T14:00:00Z
status: gaps_found
score: 7/10 must-haves verified
re_verification: false
gaps:
  - truth: "После CRUD мутации в catalog/settings/suppliers/customers данные обновляются без ручного F5"
    status: partial
    reason: "settings.ts импортирует revalidatePath но не вызывает его ни разу — import есть, вызовов нет. 9 мутирующих функций (createStore, updateStore, toggleStoreActive, createUser, updateUser, toggleUserActive, resetUserPassword, updateUserStores, updateUserRoles) не вызывают revalidatePath."
    artifacts:
      - path: "src/actions/settings.ts"
        issue: "revalidatePath импортирован (line 3) но ни разу не вызван. Grep: 1 строка (import), 0 вызовов."
    missing:
      - "Добавить revalidatePath('/dashboard/settings') после каждой из 9 мутирующих функций в settings.ts: createStore, updateStore, toggleStoreActive, createUser, updateUser, toggleUserActive, resetUserPassword, updateUserStores, updateUserRoles"
  - truth: "REQUIREMENTS.md статусы актуализированы"
    status: failed
    reason: "REQUIREMENTS.md показывает INFRA-01, INFRA-02, INFRA-03, INFRA-08 как [ ] (unchecked) и все 8 требований в таблице как 'Pending'. Фактически INFRA-01, -02, -03, -04, -05, -06, -07 реализованы. INFRA-08 — частично (settings.ts не доделан)."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "INFRA-01, INFRA-02, INFRA-03 не отмечены как выполненные. Tracking table показывает 'Pending' для всех INFRA-*."
    missing:
      - "Обновить REQUIREMENTS.md: отметить INFRA-01, INFRA-02, INFRA-03 как [x] и строки таблицы как Done"
      - "INFRA-08 оставить [ ] до исправления settings.ts"
---

# Phase 5: Infrastruktura Verification Report

**Phase Goal:** Система имеет автоматические тесты, graceful error handling и production-ready деплой
**Verified:** 2026-04-05T14:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                       | Status   | Evidence                                                                                                         |
| --- | ------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | npx vitest run завершается за < 30 секунд и все тесты зелёные                               | VERIFIED | 134 тестов, 649ms, 23 файла — все зелёные                                                                        |
| 2   | Integration тесты покрывают createSale, createReturn, confirmReceive                        | VERIFIED | 17 integration тестов: 6 createSale + 5 createReturn + 6 confirmReceive                                          |
| 3   | Тесты используют mock Prisma client, не реальную БД                                         | VERIFIED | vi.mock используется в каждом файле; динамический import паттерн                                                 |
| 4   | Ошибка на любой странице показывает Alert с кнопкой "Попробовать снова"                     | VERIFIED | 14 error.tsx + global-error.tsx, все содержат Alert + reset button                                               |
| 5   | Загрузка страниц с таблицами показывает скелетоны                                           | VERIFIED | 8 loading.tsx со Skeleton компонентами                                                                           |
| 6   | После CRUD мутации в catalog/settings/suppliers/customers данные обновляются без ручного F5 | PARTIAL  | catalog (7 calls), suppliers (4 calls), customers (2 calls) — OK. settings.ts: import есть, вызовов НЕТ          |
| 7   | getSalesReport и getProfitReport используют SQL-агрегацию, не findMany по всей таблице      | VERIFIED | aggregate/groupBy/$queryRaw используются; findMany остался только в других функциях (getInventoryReport и т.д.)  |
| 8   | Docker Compose запускает систему с healthcheck, prisma migrate deploy при старте            | VERIFIED | HEALTHCHECK в Dockerfile, entrypoint.sh с migrate deploy, service_healthy в docker-compose                       |
| 9   | next.config.ts содержит poweredByHeader: false и security headers                           | VERIFIED | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — все 4                             |
| 10  | git push не проходит без Prettier форматирования staged файлов                              | VERIFIED | .husky/pre-commit вызывает lint-staged; .prettierrc настроен; package.json содержит prepare + lint-staged config |

**Score:** 9/10 truths verified (1 partial = gap)

---

## Required Artifacts

### Plan 05-01 (INFRA-01)

| Artifact                                            | Expected                                       | Status   | Details                                                                            |
| --------------------------------------------------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `src/__tests__/create-sale-integration.test.ts`     | Integration тесты для createSale с vi.mock     | VERIFIED | 6 тестов, 5 vi.mock вызовов, dynamic import createSale из @/actions/sales          |
| `src/__tests__/create-return-integration.test.ts`   | Integration тесты для createReturn с vi.mock   | VERIFIED | 5 тестов, 5 vi.mock вызовов, dynamic import createReturn из @/actions/sales        |
| `src/__tests__/confirm-receive-integration.test.ts` | Integration тесты для confirmReceive с vi.mock | VERIFIED | 6 тестов, 12 vi.mock вызовов, dynamic import confirmReceive из @/actions/inventory |

### Plan 05-02 (INFRA-02, INFRA-03, INFRA-08)

| Artifact                                  | Expected                            | Status   | Details                                                          |
| ----------------------------------------- | ----------------------------------- | -------- | ---------------------------------------------------------------- |
| `src/app/(dashboard)/catalog/error.tsx`   | Error boundary, "use client", Alert | VERIFIED | "use client", Alert, reset button                                |
| `src/app/global-error.tsx`                | Fallback error boundary с `<html>`  | VERIFIED | Содержит html тег                                                |
| `src/app/(dashboard)/catalog/loading.tsx` | Loading skeleton с Skeleton         | VERIFIED | Skeleton компонент                                               |
| `src/actions/catalog.ts`                  | revalidatePath после мутаций        | VERIFIED | 7 вызовов revalidatePath("/dashboard/catalog")                   |
| `src/actions/settings.ts`                 | revalidatePath после мутаций        | STUB     | import есть, 0 вызовов — 9 мутирующих функций без revalidatePath |
| `src/actions/suppliers.ts`                | revalidatePath после мутаций        | VERIFIED | 4 вызова revalidatePath("/dashboard/suppliers")                  |
| `src/actions/customers.ts`                | revalidatePath после мутаций        | VERIFIED | 2 вызова revalidatePath("/dashboard/customers")                  |

### Plan 05-03 (INFRA-04, INFRA-05, INFRA-06, INFRA-07)

| Artifact                            | Expected                                    | Status   | Details                                                              |
| ----------------------------------- | ------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `src/actions/reports.ts`            | SQL-агрегация (aggregate/groupBy/$queryRaw) | VERIFIED | 24 совпадения; getSalesReport и getProfitReport полностью переписаны |
| `src/__tests__/reports-sql.test.ts` | Тесты проверяют aggregate usage             | VERIFIED | 5 тестов, все зелёные                                                |
| `next.config.ts`                    | poweredByHeader: false + security headers   | VERIFIED | poweredByHeader: false, 4 security headers                           |
| `src/app/api/health/route.ts`       | Health check endpoint                       | VERIFIED | SELECT 1 запрос, 200/503 ответ                                       |
| `Dockerfile`                        | HEALTHCHECK, entrypoint.sh CMD              | VERIFIED | HEALTHCHECK + CMD ["./entrypoint.sh"]                                |
| `entrypoint.sh`                     | prisma migrate deploy + node server.js      | VERIFIED | set -e, migrate deploy, exec node server.js                          |
| `.env.example`                      | DATABASE_URL и другие env vars              | VERIFIED | DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NODE_ENV                |
| `.prettierrc`                       | semi, singleQuote, printWidth               | VERIFIED | semi: false, printWidth: 100, trailingComma: "all"                   |
| `.husky/pre-commit`                 | lint-staged                                 | VERIFIED | npx lint-staged                                                      |

---

## Key Link Verification

| From                                                | To                         | Via                           | Status    | Details                                                         |
| --------------------------------------------------- | -------------------------- | ----------------------------- | --------- | --------------------------------------------------------------- |
| `src/__tests__/create-sale-integration.test.ts`     | `src/actions/sales.ts`     | dynamic import createSale     | WIRED     | `await import("@/actions/sales")` вызывается в каждом тесте     |
| `src/__tests__/create-return-integration.test.ts`   | `src/actions/sales.ts`     | dynamic import createReturn   | WIRED     | `await import("@/actions/sales")` вызывается в каждом тесте     |
| `src/__tests__/confirm-receive-integration.test.ts` | `src/actions/inventory.ts` | dynamic import confirmReceive | WIRED     | `await import("@/actions/inventory")` вызывается в каждом тесте |
| `src/app/(dashboard)/catalog/error.tsx`             | `@/components/ui/alert`    | import Alert                  | WIRED     | import Alert, AlertDescription, AlertTitle                      |
| `src/actions/catalog.ts`                            | `next/cache`               | revalidatePath                | WIRED     | 7 вызовов revalidatePath("/dashboard/catalog")                  |
| `src/actions/settings.ts`                           | `next/cache`               | revalidatePath                | NOT_WIRED | import есть, но revalidatePath НЕ ВЫЗЫВАЕТСЯ                    |
| `src/actions/suppliers.ts`                          | `next/cache`               | revalidatePath                | WIRED     | 4 вызова revalidatePath("/dashboard/suppliers")                 |
| `Dockerfile`                                        | `entrypoint.sh`            | CMD entrypoint                | WIRED     | `CMD ["./entrypoint.sh"]` на последней строке                   |
| `src/actions/reports.ts`                            | `@prisma/client`           | SQL aggregation               | WIRED     | aggregate, $queryRaw, groupBy — 24 вхождения                    |
| `.husky/pre-commit`                                 | `package.json`             | lint-staged                   | WIRED     | npx lint-staged; lint-staged config в package.json              |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                          | Status    | Evidence                                                            |
| ----------- | ----------- | ------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------- |
| INFRA-01    | 05-01       | Vitest — unit/integration тесты для критичной бизнес-логики                          | SATISFIED | 23 test файла, 134 теста, 649ms runtime                             |
| INFRA-02    | 05-02       | error.tsx в каждом route segment (ошибки != белый экран)                             | SATISFIED | 14 error.tsx + global-error.tsx, все с Alert + reset                |
| INFRA-03    | 05-02       | loading.tsx в ключевых route segments                                                | SATISFIED | 8 loading.tsx с Skeleton компонентами                               |
| INFRA-04    | 05-03       | Отчёты: SQL-агрегация вместо загрузки всех данных в память                           | SATISFIED | getSalesReport и getProfitReport — aggregate/$queryRaw/groupBy      |
| INFRA-05    | 05-03       | Docker: healthcheck, prisma migrate deploy при старте, env variables                 | SATISFIED | HEALTHCHECK, entrypoint.sh, .env.example, service_healthy в compose |
| INFRA-06    | 05-03       | next.config: poweredByHeader: false, security headers                                | SATISFIED | 4 security headers + poweredByHeader: false                         |
| INFRA-07    | 05-03       | Prettier + Husky + lint-staged                                                       | SATISFIED | .prettierrc, .husky/pre-commit, lint-staged в package.json          |
| INFRA-08    | 05-02       | revalidatePath/revalidateTag после мутаций в catalog, settings, suppliers, customers | BLOCKED   | settings.ts: 9 мутирующих функций без вызова revalidatePath         |

**Заметка о REQUIREMENTS.md:** Файл показывает INFRA-01, INFRA-02, INFRA-03 как `[ ]` (не выполнено) — несмотря на то, что реализация присутствует в коде. INFRA-04-07 корректно отмечены `[x]`. Tracking table показывает все INFRA как "Pending". Это — несинхронизированная документация, не проблема кода.

---

## Anti-Patterns Found

| File                      | Line | Pattern                                        | Severity | Impact                                                                                                                             |
| ------------------------- | ---- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/actions/settings.ts` | 3    | `import { revalidatePath }` без единого вызова | Blocker  | После создания/изменения/удаления магазинов и пользователей UI не обновляется автоматически — пользователь видит устаревшие данные |

---

## Human Verification Required

### 1. Error Boundary Visual Appearance

**Test:** Открыть любую страницу дашборда, принудительно вызвать ошибку (временно бросить ошибку в server component)
**Expected:** Красный Alert с заголовком "Произошла ошибка", описанием и кнопкой "Попробовать снова"
**Why human:** Визуальный рендеринг Next.js error boundaries нельзя проверить grep-ом

### 2. Loading Skeleton Display

**Test:** Открыть /dashboard/catalog при медленном соединении или добавить delay в server component
**Expected:** Скелетоны (серые полосы) вместо пустого белого экрана во время загрузки
**Why human:** Поведение React Suspense при загрузке требует живого браузера

### 3. Settings Page Revalidation After Fix

**Test:** После исправления settings.ts — создать нового пользователя, убедиться что список обновился без F5
**Expected:** Таблица пользователей обновляется немедленно после создания
**Why human:** Поведение Next.js кеширования требует проверки в браузере

### 4. Docker Health Check

**Test:** `docker compose up` и наблюдать за `docker compose ps` статусом
**Expected:** db и app сервисы показывают `(healthy)` через ~30 секунд после старта
**Why human:** Docker CLI недоступен на dev-машине, проверить при деплое

---

## Gaps Summary

**1 критический gap** блокирует полное достижение цели фазы:

**INFRA-08 (частично):** `src/actions/settings.ts` содержит `import { revalidatePath }` но ни разу не вызывает его. Все 9 мутирующих функций (createStore, updateStore, toggleStoreActive, createUser, updateUser, toggleUserActive, resetUserPassword, updateUserStores, updateUserRoles) завершают БД-операцию и возвращают результат без инвалидации Next.js кеша. UI настроек будет показывать устаревшие данные после любых CRUD операций.

Это классический "wiring gap" — импорт есть, функция не подключена.

**Catalog, suppliers, customers** — корректно реализованы (7, 4, 2 вызовов соответственно).

**Все остальные цели фазы** достигнуты: 134 теста зеленые за < 1 сек, 15 error boundaries, 8 loading skeletons, SQL-оптимизированные отчеты, production-grade Docker, security headers, Prettier/Husky pipeline.

---

_Verified: 2026-04-05T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
