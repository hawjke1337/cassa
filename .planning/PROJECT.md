# ePRM — POS-система и ERP для a:store

## What This Is

POS-система и ERP для сети розничных магазинов электроники (ремонт техники, продажа аксессуаров, trade-in). Управление кассой, каталогом, складом, заказами, ремонтами, мотивацией сотрудников, отчётностью. 5 магазинов, ~10 пользователей (продавцы, мастера, менеджеры, владелец). Next.js 16 + Prisma 7 + PostgreSQL + shadcn/ui.

## Core Value

Продавец может быстро и безошибочно оформить продажу, возврат, приём на ремонт и trade-in — с корректным учётом остатков, серийных номеров и денежных средств.

## Requirements

### Validated

Реализовано и работает (из аудита кодовой базы):

- ✓ **Каталог:** товары с SKU, штрихкодом, деревом категорий, брендами — existing
- ✓ **Серийные единицы:** IMEI/SN трекинг с историей движения — existing
- ✓ **POS-касса:** продажа, корзина, множественные способы оплаты (наличные, карта, СБП, перевод, кредит) — existing
- ✓ **Возвраты:** полный и частичный возврат с выбором способа — existing
- ✓ **Заказы:** создание, статусы (NEW→ORDERED→ARRIVED→COMPLETED), предоплаты — existing
- ✓ **Склад:** приёмка товара, перемещения между магазинами, списание, инвентаризация — existing
- ✓ **Ремонты:** заказ-наряды, статусы, мастера, оплата — existing
- ✓ **Trade-In:** приём б/у техники, оценка, привязка к продаже — existing
- ✓ **Гарантия:** гарантийные обращения по серийным номерам — existing
- ✓ **Смены:** открытие/закрытие, кассовые операции (внесение/изъятие) — existing
- ✓ **Мотивация:** JSON-формулы, группы товаров, назначения, расчёт зарплат — existing
- ✓ **Печать:** чеки продаж, приёмки, ремонтов, ценники, акты trade-in, шаблоны — existing
- ✓ **Отчёты:** продажи, прибыль, движение денежных средств, по продавцам, по фондам — existing
- ✓ **RBAC:** роли, permissions, мульти-магазин — existing
- ✓ **Auth:** NextAuth 5 с логин/пароль — existing
- ✓ **Дашборд:** продажи, выручка, средний чек, активные заказы, ремонты — existing

### Validated (v1.0)

v1.0 milestone завершён: 6 фаз, 17 планов, 144+ unit/static тестов. Все формальные требования (SEC, AUTH, DATA, DB, ORD, INFRA, UX-01..UX-15) закрыты.

После завершения v1.0 проведено ручное QA + multi-agent аудит (5 параллельных агентов: Inventory, Security, Data Integrity, Reports, UX) — найдено **100 багов**, многие критичные. Корневая причина: тесты с моками не ловили нарушения целостности (raw SQL, race conditions, неполный учёт returns в reports).

### Current Milestone: v1.2 Production Hardening

**Goal:** Закрыть production-readiness gap'ы — безопасный деплой на VPS с TLS, автобэкапами, мониторингом ошибок и чистой сборкой. После v1.2 приложение готово к реальной эксплуатации.

**Target features:**

- Typecheck errors (35) устранены; seed защищён NODE_ENV guard
- `docker-compose.prod.yml` + reverse proxy (caddy) + HTTPS автопровизия
- Автобэкапы PostgreSQL (pg_dump в cron, retention policy)
- Sentry error tracking + structured logging (pino) вместо console.\*
- `.env.production.example` с полным списком секретов
- Rate limit: Redis-backed ИЛИ задокументированное ограничение single-instance deploy
- Nice-to-have: CSP headers, `/api/metrics` Prometheus, PgBouncer pool, review $queryRawUnsafe

### Validated (v1.1)

v1.1 milestone завершён 2026-04-18: 10 фаз (7-16), 40 планов, все INV-01..09 + UX2-01..17 + 80+ security/financial требований закрыты. Final UAT через Playwright — все 9 human-verification items прошли.

### Previous Milestone: v1.1 Financial Integrity & Security

**Goal:** Закрыть 100 багов из QA — финансовая целостность, безопасность, точность отчётов, race conditions, реальная production-готовность ePRM.

**Target features:**

- Order/Sale flow с корректной обработкой предоплат (невозвратные)
- Race conditions устранены через SELECT FOR UPDATE везде
- Reports корректны (RETURNED исключены, returns вычитаются, банковские комиссии)
- Repair как полноценная Sale (выручка видна, запчасти списываются)
- Security holes закрыты (IDOR, soft delete bypass, RBAC UI)
- Долги поставщикам от закупочной цены + UI оплаты + сводка
- Личный кабинет сотрудника с расшифровкой ЗП
- Data integrity (Decimal для денег, UTC timezone, varchar limits)
- Inventory edge cases (audit cleanup, transfer locking, category change)
- UX накопленный долг (BUG-002..016, 082..093)

**E2E стратегия:** Каждая фаза ОБЯЗАТЕЛЬНО пишет E2E тесты на реальной БД (паттерн `e2e-real-db.test.ts`). Моков недостаточно — это правило вынесено как ключевое решение для v1.1.

### Active (v1.2)

См. `.planning/REQUIREMENTS.md` — полный список REQ-IDs. Категории:

- **BUILD** — Typecheck errors, seed safety (NODE_ENV guard)
- **DEPLOY** — docker-compose.prod.yml, reverse proxy, TLS, автобэкапы
- **OBS** — Sentry, structured logging, /api/metrics
- **SEC3** — Secrets template, secure cookies, rate limit Redis, CSP, $queryRawUnsafe review
- **PERF** — PgBouncer connection pooling

### Out of Scope

- Онлайн-оплата (ЮKassa и пр.) — будет в E-Commerce
- Интеграция с маркетплейсами — не нужна
- Доставка (СДЭК, Почта) — только самовывоз
- Мобильное приложение — PWA позже
- Парсинг цен — отдельный проект (Price Parser)
- Интеграция с E-Commerce — после стабилизации ePRM
- i18n — только русский язык

## Context

- **Бизнес:** сеть из 5 магазинов электроники (розница + ремонт)
- **Пользователи:** ~10 (владелец, менеджеры, продавцы, мастера)
- **Существующий код:** 90 страниц, 51 Prisma-модель, 26 server action-файлов
- **Проблемы:** 21 критичная + 43 высоких из полного аудита (8 агентов, 8 ракурсов)
- **Нет тестов:** 0 файлов тестов — полное отсутствие автоматизации
- **Будет частью экосистемы:** ePRM ↔ E-Commerce (Medusa.js) ↔ Price Parser (Crawlee)

## Constraints

- **Tech stack:** Next.js 16 + Prisma 7 + PostgreSQL + shadcn/ui — уже выбран, менять нельзя
- **Backward compatibility:** существующая БД astore_erp с данными — миграции без потерь
- **next-auth:** 5.0.0-beta.30 — бета, но менять сложно (глубокая интеграция)
- **Качество:** НЕ MVP — production-grade, Awwwards-уровень подхода
- **Язык:** всё на русском
- **Деплой:** VPS Россия + Docker Compose

## Key Decisions

| Decision                                     | Rationale                                    | Outcome                        |
| -------------------------------------------- | -------------------------------------------- | ------------------------------ |
| Стабилизация перед новыми фичами             | 21 критичная проблема — бизнес теряет деньги | ✓ Good (v1.0 закрыл 17 планов) |
| Vitest для тестирования                      | Быстрый, совместим с Next.js, не нужен jest  | ✓ Good                         |
| SQL-агрегация в отчётах                      | Текущий подход (всё в RAM) не масштабируется | ✓ Good (Phase 5)               |
| Средневзвешенная costPrice                   | Перезапись вместо средней — вся маржа врёт   | ✓ Good (Phase 2)               |
| Серверная валидация всех цен                 | Клиент передаёт цены — дыра в безопасности   | ✓ Good (Phase 1)               |
| **v1.1: E2E тесты обязательны**              | Моки в v1.0 пропустили 100 багов             | — Pending                      |
| **v1.1: Предоплата заказа невозвратная**     | Магазин закупает под клиента, несёт риски    | — Pending                      |
| **v1.1: Долг поставщику от закупочной цены** | Сейчас от цены клиенту — обнуляет прибыль    | — Pending                      |
| **v1.1: Repair → Sale при DELIVERED**        | Доход ремонтов невидим в отчётах             | — Pending                      |
| **v1.1: Decimal.js для денег (или копейки)** | Float-арифметика накапливает погрешности     | — Pending                      |

---

_Last updated: 2026-04-18 — v1.1 завершён (16 фаз, 57 планов, 100%), начат v1.2 Production Hardening_
