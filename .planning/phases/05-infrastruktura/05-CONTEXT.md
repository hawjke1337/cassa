# Phase 5: Инфраструктура - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Production-ready инфраструктура: расширить тестовое покрытие, добавить error/loading boundaries на все маршруты, оптимизировать отчёты через SQL-агрегацию, hardened Docker setup, security headers, Prettier + Husky + lint-staged, revalidation после мутаций.

</domain>

<decisions>
## Implementation Decisions

### Vitest и тесты (INFRA-01)
- 112 тестов уже есть из Phases 1-4 (unit + static analysis)
- Дополнить integration-тестами для критичных server actions (createSale, createReturn, confirmReceive)
- НЕ запускать реальную БД в тестах — mock Prisma client для integration тестов
- Цель: покрыть критичную бизнес-логику, < 30 секунд runtime
- Тесты для motivation-calculation (самая сложная формула) — уже частично есть

### Error boundaries (INFRA-02)
- error.tsx в КАЖДОМ route segment: dashboard, POS, orders, inventory, reports, shifts, repairs, trade-in, settings, motivation, catalog
- Стиль: shadcn Alert + кнопка "Попробовать снова" (reset())
- Минимальный контент: иконка ошибки, "Произошла ошибка", описание из error.message (если safe), кнопка retry
- global-error.tsx в app/ для uncaught ошибок (fallback)
- НЕ показывать stack trace в production

### Loading boundaries (INFRA-03)
- loading.tsx в ключевых route segments: dashboard, POS, orders, inventory, reports
- Стиль: скелетоны (Skeleton из shadcn/ui) — не спиннеры
- Для таблиц: skeleton rows (3-5 строк)
- Для дашборда: skeleton cards
- Не добавлять loading.tsx в мелкие вложенные маршруты (overkill)

### SQL-агрегация отчётов (INFRA-04)
- Текущий reports.ts загружает ВСЕ данные в память и считает JS-циклами
- Перевести на Prisma aggregate/groupBy или $queryRaw для сложных отчётов
- Приоритет: getFinancialReport (самый тяжёлый — загружает все продажи/возвраты/списания)
- Цель: отчёт за год < 3 секунд

### Docker hardening (INFRA-05)
- Healthcheck: HTTP check на /api/health (создать route)
- prisma migrate deploy при старте контейнера (entrypoint script)
- Env variables: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL — без хардкода
- .env.example с описанием всех переменных
- Multi-stage build (если нет) для уменьшения образа

### Security headers (INFRA-06)
- next.config: `poweredByHeader: false`
- Security headers через next.config.headers():
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
- Не добавлять CSP пока (сложно с inline styles от shadcn)

### Prettier + Husky + lint-staged (INFRA-07)
- Prettier: стандартный конфиг (semi: false или true — consistency важнее конкретного выбора)
- Husky: pre-commit hook
- lint-staged: `*.{ts,tsx}` → prettier --write + eslint --fix
- НЕ форматировать весь проект сразу (огромный diff) — только staged files
- Первый коммит: конфиги, потом постепенно форматируется при изменениях

### Revalidation после мутаций (INFRA-08)
- revalidatePath/revalidateTag после ВСЕХ мутаций в: catalog, settings, suppliers, customers
- Сейчас только 1 файл использует revalidation
- Паттерн: `revalidatePath('/dashboard/catalog')` после CRUD операций на Product
- Для settings: `revalidatePath('/dashboard/settings')`
- Для suppliers/customers: `revalidatePath('/dashboard/suppliers')` и `/dashboard/customers`

### Claude's Discretion
- Точный набор route segments для error.tsx (не все 14 маршрутов могут быть нужны)
- Skeleton дизайн (количество строк, ширина блоков)
- Prettier конфиг (semi, singleQuote, printWidth) — любой consistency лучше никакого
- Нужен ли ESLint в pre-commit или только Prettier

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (INFRA-01..08).

### Ключевые файлы
- `src/actions/reports.ts` — текущие отчёты для оптимизации (INFRA-04)
- `next.config.ts` — security headers (INFRA-06)
- `Dockerfile` + `docker-compose.yml` — Docker hardening (INFRA-05)
- `src/app/(dashboard)/` — все route segments для error/loading (INFRA-02, INFRA-03)
- `vitest.config.ts` — тестовая инфраструктура (INFRA-01)
- `src/actions/catalog.ts`, `src/actions/settings.ts`, `src/actions/suppliers.ts` — revalidation targets (INFRA-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Vitest уже настроен (vitest.config.ts, 112 тестов)
- shadcn/ui Skeleton, Alert компоненты — для error/loading boundaries
- Docker stack уже работает (docker-compose.yml + Dockerfile)
- Prisma aggregate/groupBy API — для SQL отчётов

### Established Patterns
- Server actions: requirePermission → auth → validation → business logic
- shadcn/ui для всего UI — error/loading должны следовать тому же стилю
- Toast для ошибок на клиенте — error.tsx для uncaught ошибок

### Integration Points
- 0 error.tsx, 0 loading.tsx — нужно создать с нуля
- reports.ts: 3 main report functions (financial, daily, supplier)
- next.config.ts — пустой, нужно добавить headers + poweredByHeader
- 1 файл с revalidation — нужно добавить в ~10 action файлов

</code_context>

<specifics>
## Specific Ideas

- error.tsx одинаковый шаблон для всех route segments — copy-paste с минимальными отличиями
- loading.tsx: разные скелетоны для таблиц vs дашборда vs форм
- Prettier: НЕ форматировать весь проект сразу — только staged через lint-staged

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-infrastruktura*
*Context gathered: 2026-04-05 via auto-mode*
