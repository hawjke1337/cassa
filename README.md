# astore ERP — касса + учёт для розничного магазина электроники

Внутренняя ERP-система: касса, склад, ремонты, trade-in, мотивация сотрудников, зарплаты, отчёты.

**Стек:** Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Prisma 7 · PostgreSQL 16 · NextAuth · shadcn/ui + Tailwind · Vitest + Playwright · pnpm · Docker Compose

---

## Quick start

### Требования

- Node.js 20+
- pnpm 9+
- Docker (для Postgres) — либо локальный Postgres 16

### Установка

```bash
pnpm install
cp .env.example .env
docker-compose up -d db           # Postgres на localhost:5432
pnpm prisma migrate deploy        # применить миграции
pnpm prisma db seed               # dev-сид (товары, роли, тестовые юзеры)
pnpm dev                           # http://localhost:3000
```

Дефолтный admin для dev-окружения: `admin` / `admin123`.

### Production seed (первый запуск)

```bash
SEED_ALLOW_PROD=true NODE_ENV=production pnpm prisma db seed
# → выдаст temp-пароль admin-{16hex} в stdout ОДИН РАЗ
# → залогиниться, сменить пароль (Phase 18 UI force-flow)
```

Без `SEED_ALLOW_PROD=true` в production сид падает с `Refusing to seed in production`.

---

## Основные команды

| Команда              | Что делает                          |
| -------------------- | ----------------------------------- |
| `pnpm dev`           | dev-сервер (Turbopack, hot reload)  |
| `pnpm build`         | production-сборка                   |
| `pnpm typecheck`     | `tsc --noEmit` (zero errors target) |
| `pnpm test`          | unit + integration (Vitest)         |
| `pnpm test:e2e`      | E2E против реальной БД              |
| `pnpm prisma studio` | GUI для БД                          |

Pre-push hook (`.husky/pre-push`) запускает `pnpm typecheck` — push блокируется при ошибках.

---

## Структура

```
astore-erp/
├── src/
│   ├── app/                  # Next.js App Router (routes, layouts, pages)
│   ├── actions/              # Server Actions (business logic, validation)
│   ├── components/           # shadcn/ui + domain components
│   ├── lib/                  # auth, db, guards, utilities
│   └── __tests__/            # integration + E2E
├── prisma/
│   ├── schema.prisma         # 40+ моделей (Sale, Repair, TradeIn, Shift, Payment, User, Role…)
│   ├── migrations/           # миграции истории
│   ├── seed.ts               # dev + prod-safe seed
│   └── __tests__/            # seed-guard тесты
├── docker-compose.yml        # Postgres + app
└── .planning/                # ← ЗДЕСЬ ВСЯ ДОКУМЕНТАЦИЯ ПРОЕКТА
```

---

## Документация (.planning/)

Проект ведётся по методологии [GSD (Get Shit Done)](https://get-shit-done.dev/) — каждая фаза проходит цикл **discuss → research → plan → execute → verify**.

| Файл                          | Что внутри                                           |
| ----------------------------- | ---------------------------------------------------- |
| `.planning/PROJECT.md`        | Vision, цели, milestone-и                            |
| `.planning/REQUIREMENTS.md`   | Все требования с traceability по фазам               |
| `.planning/ROADMAP.md`        | Все 19 фаз: что сделано, что впереди                 |
| `.planning/STATE.md`          | Текущая позиция, последняя сессия                    |
| `.planning/phases/NN-<name>/` | По каждой фазе: CONTEXT, PLAN, SUMMARY, VERIFICATION |

### Что уже сделано

**v1.0 (Phases 1–16, завершено 2026-04):**

- Касса: продажи, возвраты, trade-in, ремонты
- Склад: приход, остатки, перемещения
- Пользователи: роли, права, смены
- Мотивация: схемы начислений, расчёт зарплат, дашборд сотрудника
- Поставщики + долги
- Финансы: движение денег, смены, отчёты
- IMEI/SN tracking

**v1.2 Production Hardening (в процессе):**

- ✅ Phase 17 — Build & Seed Safety (0 typecheck errors, prod-safe seed, CI gate)
- ⏳ Phase 18 — Secure Deploy Foundation
- ⏳ Phase 19 — Observability

Детали каждой фазы — в `.planning/phases/NN-<name>/NN-VERIFICATION.md`.

---

## Что посмотреть в первую очередь

Если хочешь понять структуру кода — начни с:

- `prisma/schema.prisma` — модель данных (весь бизнес-домен)
- `src/actions/pos.ts` — логика кассы
- `src/actions/repairs.ts` — логика ремонтов
- `src/app/(dashboard)/layout.tsx` — структура UI

Если хочешь понять процесс разработки:

- `.planning/ROADMAP.md` — что и в каком порядке делалось
- `.planning/phases/16-final-polish/` — последняя фаза v1.0 (как выглядит "готовая" фаза)
- `.planning/phases/17-build-seed-safety/` — свежая фаза v1.2

---

## Qwik references

- Railway для Postgres: не используется — self-hosted VPS (Россия)
- Оплата в системе: только наличные при получении (v1 scope)
- Доставка: только самовывоз (v1 scope)
- Стандарт качества: production-grade, не MVP
